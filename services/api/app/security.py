"""Authentication, authorisation and rate limiting.

Supabase issues the JWTs; this service only verifies them. In local development
a dev principal can be minted, but that path is hard-disabled in production.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, Header, Request

from .config import Settings, get_settings
from .errors import ApiError

_jwks_cache: dict[str, object] = {"fetched_at": 0.0, "keys": None}


@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str | None = None
    role: str = "authenticated"
    is_dev: bool = False


def _fetch_jwks(settings: Settings) -> dict:
    now = time.time()
    if _jwks_cache["keys"] and now - float(_jwks_cache["fetched_at"]) < 3600:
        return _jwks_cache["keys"]  # type: ignore[return-value]
    if not settings.supabase_jwks_url:
        raise ApiError(500, "auth_misconfigured", "SUPABASE_JWKS_URL is not set")
    with httpx.Client(timeout=10) as client:
        response = client.get(settings.supabase_jwks_url)
        response.raise_for_status()
        keys = response.json()
    _jwks_cache.update({"fetched_at": now, "keys": keys})
    return keys


def decode_token(token: str, settings: Settings) -> Principal:
    try:
        if settings.supabase_jwks_url:
            keys = _fetch_jwks(settings)
            header = jwt.get_unverified_header(token)
            key = next((k for k in keys.get("keys", []) if k.get("kid") == header.get("kid")), None)
            if key is None:
                raise ApiError(401, "invalid_token", "Signing key not found")
            claims = jwt.decode(token, jwt.algorithms.RSAAlgorithm.from_jwk(key), algorithms=["RS256"], audience="authenticated")
        elif settings.supabase_jwt_secret:
            claims = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        else:
            raise ApiError(500, "auth_misconfigured", "Neither SUPABASE_JWKS_URL nor SUPABASE_JWT_SECRET is configured")
    except ApiError:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "token_expired", "Session expired; sign in again") from exc
    except jwt.PyJWTError as exc:
        raise ApiError(401, "invalid_token", "Token could not be verified") from exc

    return Principal(
        user_id=str(claims.get("sub")),
        email=claims.get("email"),
        role=str(claims.get("role", "authenticated")),
    )


async def current_principal(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> Principal:
    if authorization and authorization.lower().startswith("bearer "):
        return decode_token(authorization.split(" ", 1)[1].strip(), settings)
    if settings.dev_auth_enabled:
        return Principal(user_id=settings.dev_auth_user_id, email="dev@localhost", is_dev=True)
    raise ApiError(401, "missing_token", "Authorization header with a bearer token is required")


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]


class RateLimiter:
    """Fixed-window per principal/IP limiter.

    In-process only: correct for a single instance. Horizontal scale moves this
    to Redis (see docs/architecture/overview.md#rate-limiting).
    """

    def __init__(self, limit_per_minute: int) -> None:
        self.limit = limit_per_minute
        self.window = 60.0
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> tuple[bool, int]:
        now = time.monotonic()
        bucket = self.hits[key]
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False, 0
        bucket.append(now)
        return True, self.limit - len(bucket)
