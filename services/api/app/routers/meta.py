from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..repositories import Repository, get_repository
from ..security import CurrentPrincipal

_ORCH = Path(__file__).resolve().parents[3] / "ai-orchestrator"
if _ORCH.exists() and str(_ORCH) not in sys.path:
    sys.path.insert(0, str(_ORCH))

from ai_orchestrator.registry import MODEL_REGISTRY  # noqa: E402

router = APIRouter(prefix="/api/v1", tags=["meta"])

FREE_LIMITS = {"ai_edits": 200, "render_minutes": 60, "storage_mb": 2048}


@router.get("/models", summary="Model registry with licence status")
async def models() -> list[dict]:
    return [
        {
            "id": record.id,
            "name": record.name,
            "family": record.family,
            "task": record.task,
            "version": record.version,
            "licence": record.licence,
            "commercial_use": record.commercial_use,
            "hardware": record.hardware,
            "status": record.status,
            "notes": record.notes,
            "docs_url": record.docs_url,
        }
        for record in MODEL_REGISTRY
    ]


def repo(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.get("/usage/summary", summary="Usage against plan limits")
async def usage(principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> dict:
    edits = await repository.count_ai_edits(principal.user_id)
    jobs = await repository.list_jobs(principal.user_id)
    render_minutes = sum(1 for job in jobs if job.kind == "render" and job.status == "succeeded") * 4.0
    return {
        "period_start": "2026-11-01T00:00:00+00:00",
        "period_end": "2026-11-30T23:59:59+00:00",
        "ai_edits": edits,
        "render_minutes": round(render_minutes, 1),
        "storage_mb": 0,
        "plan": "free",
        "limits": FREE_LIMITS,
    }


@router.get("/assets", summary="List assets visible to the user")
async def assets(principal: CurrentPrincipal) -> list[dict]:
    # Asset metadata lives in Supabase Storage + the assets table; this endpoint
    # returns an empty list until the storage integration is configured rather
    # than inventing rows.
    return []
