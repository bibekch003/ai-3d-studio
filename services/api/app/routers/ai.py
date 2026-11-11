"""AI planning and editing endpoints.

Flow: plan (no mutation) -> client shows targets and operations -> apply (which
re-validates server-side and records an audit row). The client can never apply a
plan that has not passed validation here.
"""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Depends, Request

from ..config import Settings, get_settings
from ..errors import ApiError
from ..repositories import Repository, get_repository
from ..schemas import ApplyRequest, DirectorRequest, PlanRequest, SelectRequest
from ..security import CurrentPrincipal, RateLimiter
from ..services.scene_ops import OperationError, apply_operations, validate_scene_shape

# The orchestrator is a sibling service in this monorepo; import it directly in
# development and as an installed package in containers.
_ORCH = Path(__file__).resolve().parents[3] / "ai-orchestrator"
if _ORCH.exists() and str(_ORCH) not in sys.path:
    sys.path.insert(0, str(_ORCH))

from ai_orchestrator import adapter_status, plan_edit, plan_scene  # noqa: E402
from ai_orchestrator.planner import search_objects, validate_plan  # noqa: E402

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

_limiter: RateLimiter | None = None


def limiter(settings: Settings = Depends(get_settings)) -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter(limit_per_minute=max(10, settings.rate_limit_per_minute // 3))
    return _limiter


def repo(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.post("/edit/plan", summary="Plan a natural-language edit (no mutation)")
async def plan(
    body: PlanRequest,
    request: Request,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
    limiter: RateLimiter = Depends(limiter),
) -> dict:
    allowed, remaining = limiter.check(f"plan:{principal.user_id}")
    if not allowed:
        raise ApiError(429, "rate_limited", "Too many plans this minute; try again shortly")

    scene = await repository.get_scene(principal.user_id, body.scene_id)
    plan_doc = plan_edit(body.prompt, scene, scope=body.scope or None)
    if body.preserve:
        plan_doc["preserve"]["properties"] = sorted(
            set(plan_doc["preserve"]["properties"]) | set(body.preserve)
        )
    validation = validate_plan(plan_doc, scene)
    return {"plan": plan_doc, "validation": validation, "affected": validation["affected"], "remaining": remaining}


@router.post("/edit/apply", summary="Validate and apply a plan, recording an audit entry")
async def apply(
    body: ApplyRequest,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
    settings: Settings = Depends(get_settings),
) -> dict:
    scene = await repository.get_scene(principal.user_id, body.scene_id)
    validation = validate_plan(body.plan, scene)
    if not validation["ok"]:
        raise ApiError(422, "plan_invalid", "Plan failed validation", validation["errors"])

    try:
        updated, touched = apply_operations(scene, body.plan["operations"])
    except OperationError as exc:
        raise ApiError(422, "apply_failed", str(exc)) from exc

    problems = validate_scene_shape(updated, settings.max_scene_objects)
    if problems:
        raise ApiError(422, "scene_invalid", "Plan produced an invalid scene", problems)

    saved = await repository.save_scene(principal.user_id, updated, scene["revision"])
    await repository.record_edit(principal.user_id, body.scene_id, body.plan, touched)
    return {
        "scene": saved,
        "touched": touched,
        "warnings": [w["message"] for w in validation["warnings"]],
        "audit": {
            "plan_id": body.plan.get("id"),
            "prompt": body.plan.get("prompt"),
            "producer": (body.plan.get("producer") or {}).get("kind"),
            "operations": len(body.plan.get("operations", [])),
            "touched": touched,
        },
    }


@router.post("/director/plan", summary="Turn a description into a shot plan")
async def director(
    body: DirectorRequest,
    principal: CurrentPrincipal,
    limiter: RateLimiter = Depends(limiter),
) -> dict:
    allowed, _ = limiter.check(f"director:{principal.user_id}")
    if not allowed:
        raise ApiError(429, "rate_limited", "Too many director plans this minute")
    return plan_scene(body.prompt, fps=body.fps, seconds=body.seconds)


@router.post("/select", summary="Resolve a natural-language reference to object ids")
async def select(
    body: SelectRequest, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> dict:
    scene = await repository.get_scene(principal.user_id, body.scene_id)
    matches = search_objects(scene, body.query, limit=8)
    return {
        "query": body.query,
        "candidates": [
            {"object_id": obj["id"], "name": obj["name"], "type": obj["type"], "score": round(score, 3)}
            for obj, score in matches
        ],
        "recommended": [obj["id"] for obj, score in matches if score >= 0.55][:4],
    }


@router.get("/adapters", summary="Adapter availability and licence notes")
async def adapters() -> dict:
    return {
        "adapters": adapter_status(),
        "note": "An unconfigured adapter reports ok=false; no endpoint fabricates generated output.",
    }
