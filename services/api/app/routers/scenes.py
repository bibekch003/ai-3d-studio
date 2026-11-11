from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..errors import ApiError
from ..repositories import Repository, get_repository
from ..schemas import ObjectPatch, SceneSave
from ..security import CurrentPrincipal
from ..services.scene_ops import OperationError, apply_operations, validate_scene_shape

router = APIRouter(prefix="/api/v1/scenes", tags=["scenes"])


def repo(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.get("/{scene_id}", summary="Load a scene document")
async def get_scene(scene_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> dict:
    scene = await repository.get_scene(principal.user_id, scene_id)
    return {"scene": scene}


@router.put("/{scene_id}", summary="Save a scene with optimistic concurrency")
async def save_scene(
    scene_id: str,
    body: SceneSave,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
    settings: Settings = Depends(get_settings),
) -> dict:
    if body.scene.get("id") != scene_id:
        raise ApiError(400, "scene_id_mismatch", "Path id and document id differ")
    problems = validate_scene_shape(body.scene, settings.max_scene_objects)
    if problems:
        raise ApiError(422, "scene_invalid", "Scene failed validation", problems)
    saved = await repository.save_scene(principal.user_id, body.scene, body.expected_revision)
    return {"scene": saved}


@router.post("/{scene_id}/objects:apply", summary="Apply direct (non-AI) object operations")
async def apply_object_operations(
    scene_id: str,
    body: ObjectPatch,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
    settings: Settings = Depends(get_settings),
) -> dict:
    scene = await repository.get_scene(principal.user_id, scene_id)
    try:
        updated, touched = apply_operations(scene, body.operations)
    except OperationError as exc:
        raise ApiError(422, "operation_failed", str(exc)) from exc
    problems = validate_scene_shape(updated, settings.max_scene_objects)
    if problems:
        raise ApiError(422, "scene_invalid", "Edit produced an invalid scene", problems)
    saved = await repository.save_scene(principal.user_id, updated, scene["revision"])
    return {"scene": saved, "touched": touched, "label": body.label}


@router.get("/{scene_id}/versions", summary="List scene versions")
async def list_versions(scene_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> list[dict]:
    versions = await repository.list_versions(principal.user_id, scene_id)
    return [
        {
            "id": v.id,
            "scene_id": v.scene_id,
            "revision": v.revision,
            "label": v.label,
            "created_at": v.created_at,
        }
        for v in versions
    ]


@router.post("/{scene_id}/versions/{version_id}:restore", summary="Restore a previous version")
async def restore_version(
    scene_id: str, version_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> dict:
    scene = await repository.restore_version(principal.user_id, scene_id, version_id)
    return {"scene": scene}
