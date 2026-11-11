import pytest

from app.config import Settings
from app.security import RateLimiter, decode_token


def test_dev_auth_is_impossible_in_production() -> None:
    settings = Settings(environment="production", allow_dev_auth=True, supabase_jwt_secret="secret")
    assert settings.dev_auth_enabled is False


def test_dev_auth_allowed_locally() -> None:
    settings = Settings(environment="development", allow_dev_auth=True)
    assert settings.dev_auth_enabled is True


def test_missing_token_is_rejected_when_dev_auth_is_off(monkeypatch) -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOW_DEV_AUTH", "false")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    from app.config import get_settings

    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/projects")
    get_settings.cache_clear()
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "missing_token"


def test_bad_token_is_rejected() -> None:
    from app.errors import ApiError

    settings = Settings(environment="development", supabase_jwt_secret="test-secret")
    with pytest.raises(ApiError) as exc:
        decode_token("not-a-jwt", settings)
    assert exc.value.code == "invalid_token"
    assert exc.value.status_code == 401


def test_rate_limiter_blocks_after_limit() -> None:
    limiter = RateLimiter(limit_per_minute=3)
    for _ in range(3):
        allowed, _ = limiter.check("user")
        assert allowed is True
    allowed, remaining = limiter.check("user")
    assert allowed is False
    assert remaining == 0
