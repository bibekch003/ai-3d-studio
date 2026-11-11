from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from .. import __version__
from ..config import Settings, get_settings

router = APIRouter(tags=["system"])


@router.get("/healthz", summary="Liveness probe")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@router.get("/readyz", summary="Readiness probe")
async def readyz(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    return {
        "status": "ready",
        "environment": settings.environment,
        "repository": "memory" if settings.use_memory_repository else "postgres",
        "dev_auth": settings.dev_auth_enabled,
    }


@router.get("/metrics", response_class=PlainTextResponse, summary="Prometheus-style counters")
async def metrics() -> str:
    # Deliberately minimal: no per-user labels, so this is safe to scrape.
    return "\n".join(
        [
            "# HELP ai3d_up Service liveness",
            "# TYPE ai3d_up gauge",
            "ai3d_up 1",
            "# HELP ai3d_info Build info",
            '# TYPE ai3d_info gauge',
            f'ai3d_info{{version="{__version__}"}} 1',
        ]
    )
