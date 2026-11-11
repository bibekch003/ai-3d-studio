"""Runtime configuration. Everything is environment driven; no secrets in code."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    database_url: str = "memory://"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    supabase_storage_bucket: str = "project-assets"

    allow_dev_auth: bool = True
    dev_auth_user_id: str = "00000000-0000-4000-8000-000000000001"

    service_token: str = ""
    redis_url: str = "redis://localhost:6379/0"
    job_queue_namespace: str = "ai3d"

    blender_bin: str = "/usr/bin/blender"
    render_work_dir: str = "/tmp/ai3d-renders"

    planner_provider: str = "deterministic"
    planner_model: str = ""
    planner_base_url: str = ""
    planner_api_key: str = ""

    max_scene_objects: int = 5000
    max_upload_mb: int = 512
    rate_limit_per_minute: int = 120
    job_timeout_seconds: int = 3600

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def dev_auth_enabled(self) -> bool:
        """Dev auth can never be enabled in production, whatever the env says."""
        return self.allow_dev_auth and not self.is_production

    @property
    def use_memory_repository(self) -> bool:
        return self.database_url.startswith("memory://") or self.database_url == ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
