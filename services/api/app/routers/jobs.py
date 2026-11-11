from __future__ import annotations

import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse

from ..config import Settings, get_settings
from ..errors import ApiError
from ..repositories import Repository, get_repository
from ..schemas import ExportRequest, JobProgress, RenderRequest
from ..security import CurrentPrincipal

router = APIRouter(tags=["jobs"])


def repo(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.post("/api/v1/render/jobs", status_code=202, summary="Queue a render")
async def create_render(
    body: RenderRequest,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
    settings: Settings = Depends(get_settings),
) -> dict:
    scene = await repository.get_scene(principal.user_id, body.scene_id)
    project_id = scene["project_id"]
    message = (
        f"{body.engine.upper()} {body.resolution} {body.fps}fps "
        f"frames {body.frame_range[0]}-{body.frame_range[1]} -> {body.format}"
    )
    job = await repository.create_job(principal.user_id, project_id, "render", message, body.scene_id)
    return job.as_dict()


@router.post("/api/v1/export/blend", status_code=202, summary="Export an editable Blender project")
async def export_blend(
    body: ExportRequest, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> dict:
    scene = await repository.get_scene(principal.user_id, body.scene_id)
    job = await repository.create_job(
        principal.user_id,
        scene["project_id"],
        "export",
        f"Blender project export (textures: {'yes' if body.include_textures else 'no'})",
        body.scene_id,
    )
    return {"job": job.as_dict()}


@router.get("/api/v1/jobs", summary="List jobs for the current user")
async def list_jobs(principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> list[dict]:
    jobs = await repository.list_jobs(principal.user_id)
    return [job.as_dict() for job in jobs]


@router.get("/api/v1/jobs/{job_id}", summary="Get one job")
async def get_job(job_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> dict:
    job = await repository.get_job(principal.user_id, job_id)
    return job.as_dict()


@router.post("/api/v1/jobs/{job_id}/cancel", summary="Cancel a queued or running job")
async def cancel_job(job_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> dict:
    job = await repository.cancel_job(principal.user_id, job_id)
    return job.as_dict()


@router.post("/api/v1/jobs/{job_id}/progress", summary="Worker progress callback")
async def job_progress(
    job_id: str,
    body: JobProgress,
    x_service_token: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
    repository: Repository = Depends(repo),
) -> dict:
    if not settings.service_token or x_service_token != settings.service_token:
        raise ApiError(401, "invalid_service_token", "Worker callback requires a valid service token")
    job = await repository.update_job_status(job_id, body.status, body.progress, body.message, body.output_url)
    return job.as_dict()


@router.get("/api/v1/jobs/{job_id}/events", summary="Server-sent progress stream")
async def job_events(
    job_id: str,
    request: Request,
    principal: CurrentPrincipal,
    repository: Repository = Depends(repo),
) -> StreamingResponse:
    await repository.get_job(principal.user_id, job_id)

    async def stream():
        last = None
        for _ in range(600):  # ~5 minutes at 2s cadence
            if await request.is_disconnected():
                return
            job = await repository.get_job(principal.user_id, job_id)
            payload = json.dumps(
                {"id": job.id, "status": job.status, "progress": job.progress, "message": job.message}
            )
            if payload != last:
                last = payload
                yield f"event: progress\ndata: {payload}\n\n"
            if job.status in {"succeeded", "failed", "cancelled"}:
                yield "event: done\ndata: {}\n\n"
                return
            await asyncio.sleep(2)

    return StreamingResponse(stream(), media_type="text/event-stream")
