from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from ..config import Settings, get_settings
from ..errors import ApiError
from ..repositories import Repository, get_repository
from ..schemas import ProjectCreate, ProjectPatch
from ..security import CurrentPrincipal

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def repo(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.get("", summary="List projects for the current user")
async def list_projects(principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> list[dict]:
    projects = await repository.list_projects(principal.user_id)
    return [p.as_dict() for p in projects]


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a project with a starter scene")
async def create_project(
    body: ProjectCreate, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> dict:
    project = await repository.create_project(principal.user_id, body.name, body.description)
    return project.as_dict()


@router.get("/{project_id}", summary="Get one project")
async def get_project(project_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)) -> dict:
    project = await repository.get_project(principal.user_id, project_id)
    return project.as_dict()


@router.patch("/{project_id}", summary="Rename or re-describe a project")
async def patch_project(
    project_id: str, body: ProjectPatch, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> dict:
    project = await repository.get_project(principal.user_id, project_id)
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    return project.as_dict()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a project")
async def delete_project(
    project_id: str, principal: CurrentPrincipal, repository: Repository = Depends(repo)
) -> Response:
    if not isinstance(repository, type(repository)):  # pragma: no cover - defensive
        raise ApiError(500, "repository_error", "Repository unavailable")
    await repository.delete_project(principal.user_id, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
