"""AI 3D Studio API.

Routers stay thin: validation in schemas, policy in services, persistence behind
a repository. Long-running work (Blender renders, model inference) is queued for
workers, never executed inside a request.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import get_settings
from .errors import error_body, install_error_handlers
from .repositories import get_repository
from .routers import ai, auth, health, jobs, meta, projects, scenes
from .security import RateLimiter

logging.basicConfig(
    level=get_settings().log_level.upper(),
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("ai3d.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    repository = get_repository(settings)
    app.state.repository = repository
    app.state.limiter = RateLimiter(settings.rate_limit_per_minute)
    logger.info("API starting: env=%s repository=%s", settings.environment, type(repository).__name__)
    yield
    await repository.close()
    logger.info("API stopped")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AI 3D Studio API",
        version=__version__,
        description=(
            "Scene graph, AI edit planning, versioning and render orchestration for AI 3D Studio.\n\n"
            "Every AI edit is planned, validated against the live scene, then applied atomically "
            "with an audit record. Renders are queued for a Blender worker."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["authorization", "content-type", "x-request-id"],
        expose_headers=["x-request-id", "x-ratelimit-remaining"],
    )

    @app.middleware("http")
    async def observability_and_limits(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        limiter: RateLimiter | None = getattr(request.app.state, "limiter", None)
        remaining = None
        if limiter is not None and request.url.path.startswith("/api/"):
            key = request.headers.get("authorization", "")[:40] or (request.client.host if request.client else "anon")
            allowed, remaining = limiter.check(f"http:{key}")
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content=error_body("rate_limited", "Rate limit exceeded; retry in a minute"),
                    headers={"x-request-id": request_id},
                )
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        if remaining is not None:
            response.headers["x-ratelimit-remaining"] = str(remaining)
        duration_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "request method=%s path=%s status=%s duration_ms=%.1f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    install_error_handlers(app)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(projects.router)
    app.include_router(scenes.router)
    app.include_router(ai.router)
    app.include_router(jobs.router)
    app.include_router(meta.router)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"service": "ai-3d-studio-api", "version": __version__, "docs": "/docs"}

    return app


app = create_app()
