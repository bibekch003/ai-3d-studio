"""Persistence layer.

Two implementations behind one protocol:
  * MemoryRepository  - used by tests and by `DATABASE_URL=memory://` local runs
  * PostgresRepository - Supabase/Postgres via asyncpg, matching database/migrations

Both are async so routers never care which one is active.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

from .config import Settings
from .errors import ApiError
from .scene_fixtures import demo_scene


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


@dataclass
class Project:
    id: str
    owner_id: str
    name: str
    description: str = ""
    fps: int = 24
    default_resolution: str = "1920x1080"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    scene_count: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "name": self.name,
            "description": self.description,
            "fps": self.fps,
            "default_resolution": self.default_resolution,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "scene_count": self.scene_count,
        }


@dataclass
class SceneVersion:
    id: str
    scene_id: str
    revision: int
    label: str
    created_at: str
    snapshot: dict[str, Any]


@dataclass
class Job:
    id: str
    project_id: str
    kind: str
    status: str = "queued"
    progress: float = 0.0
    message: str = ""
    scene_id: str | None = None
    output_url: str | None = None
    error: str | None = None
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "scene_id": self.scene_id,
            "kind": self.kind,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "output_url": self.output_url,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class Repository(Protocol):
    async def list_projects(self, user_id: str) -> list[Project]: ...
    async def create_project(self, user_id: str, name: str, description: str) -> Project: ...
    async def get_project(self, user_id: str, project_id: str) -> Project: ...
    async def delete_project(self, user_id: str, project_id: str) -> None: ...
    async def get_scene(self, user_id: str, scene_id: str) -> dict[str, Any]: ...
    async def save_scene(self, user_id: str, scene: dict[str, Any], expected_revision: int | None) -> dict[str, Any]: ...
    async def list_versions(self, user_id: str, scene_id: str) -> list[SceneVersion]: ...
    async def restore_version(self, user_id: str, scene_id: str, version_id: str) -> dict[str, Any]: ...
    async def create_job(self, user_id: str, project_id: str, kind: str, message: str, scene_id: str | None) -> Job: ...
    async def list_jobs(self, user_id: str) -> list[Job]: ...
    async def get_job(self, user_id: str, job_id: str) -> Job: ...
    async def cancel_job(self, user_id: str, job_id: str) -> Job: ...
    async def update_job_status(
        self, job_id: str, status: str, progress: float, message: str, output_url: str | None
    ) -> Job: ...
    async def count_ai_edits(self, user_id: str) -> int: ...
    async def record_edit(self, user_id: str, scene_id: str, plan: dict[str, Any], touched: list[str]) -> None: ...
    async def close(self) -> None: ...


class MemoryRepository:
    """Process-local store. Data is lost on restart; used for dev and tests."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self.projects: dict[str, Project] = {}
        self.scenes: dict[str, dict[str, Any]] = {}
        self.versions: dict[str, list[SceneVersion]] = {}
        self.jobs: dict[str, Job] = {}
        self.edits: list[dict[str, Any]] = []
        self.owners: dict[str, str] = {}

    async def list_projects(self, user_id: str) -> list[Project]:
        return [p for p in self.projects.values() if p.owner_id == user_id]

    async def create_project(self, user_id: str, name: str, description: str) -> Project:
        async with self._lock:
            project = Project(id=_uuid(), owner_id=user_id, name=name, description=description)
            self.projects[project.id] = project
            scene = demo_scene(scene_id=_uuid(), project_id=project.id)
            scene["name"] = f"{name} — scene 1"
            self.scenes[scene["id"]] = scene
            self.owners[scene["id"]] = user_id
            self.versions[scene["id"]] = [
                SceneVersion(id=_uuid(), scene_id=scene["id"], revision=0, label="Created", created_at=_now(), snapshot=scene)
            ]
            project.scene_count = 1
            return project

    async def get_project(self, user_id: str, project_id: str) -> Project:
        project = self.projects.get(project_id)
        if project is None or project.owner_id != user_id:
            raise ApiError(404, "project_not_found", "Project not found")
        return project

    async def delete_project(self, user_id: str, project_id: str) -> None:
        await self.get_project(user_id, project_id)
        async with self._lock:
            self.projects.pop(project_id, None)
            for scene_id, scene in list(self.scenes.items()):
                if scene["project_id"] == project_id:
                    self.scenes.pop(scene_id, None)
                    self.versions.pop(scene_id, None)

    async def get_scene(self, user_id: str, scene_id: str) -> dict[str, Any]:
        scene = self.scenes.get(scene_id)
        if scene is None or self.owners.get(scene_id) != user_id:
            raise ApiError(404, "scene_not_found", "Scene not found")
        return scene

    async def save_scene(self, user_id: str, scene: dict[str, Any], expected_revision: int | None) -> dict[str, Any]:
        current = await self.get_scene(user_id, scene["id"])
        if expected_revision is not None and current["revision"] != expected_revision:
            raise ApiError(409, "revision_conflict", "The scene was modified by someone else; reload before saving")
        async with self._lock:
            self.scenes[scene["id"]] = scene
            self.versions.setdefault(scene["id"], []).append(
                SceneVersion(
                    id=_uuid(),
                    scene_id=scene["id"],
                    revision=scene["revision"],
                    label=f"Saved revision {scene['revision']}",
                    created_at=_now(),
                    snapshot=scene,
                )
            )
            return scene

    async def list_versions(self, user_id: str, scene_id: str) -> list[SceneVersion]:
        await self.get_scene(user_id, scene_id)
        return list(reversed(self.versions.get(scene_id, [])))

    async def restore_version(self, user_id: str, scene_id: str, version_id: str) -> dict[str, Any]:
        await self.get_scene(user_id, scene_id)
        version = next((v for v in self.versions.get(scene_id, []) if v.id == version_id), None)
        if version is None:
            raise ApiError(404, "version_not_found", "Version not found")
        restored = dict(version.snapshot)
        restored["revision"] = (await self.get_scene(user_id, scene_id))["revision"] + 1
        restored["updated_at"] = _now()
        return await self.save_scene(user_id, restored, None)

    async def create_job(self, user_id: str, project_id: str, kind: str, message: str, scene_id: str | None) -> Job:
        await self.get_project(user_id, project_id)
        job = Job(id=_uuid(), project_id=project_id, kind=kind, message=message, scene_id=scene_id)
        self.jobs[job.id] = job
        return job

    async def list_jobs(self, user_id: str) -> list[Job]:
        owned = {p.id for p in await self.list_projects(user_id)}
        return [j for j in self.jobs.values() if j.project_id in owned]

    async def get_job(self, user_id: str, job_id: str) -> Job:
        job = self.jobs.get(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job not found")
        await self.get_project(user_id, job.project_id)
        return job

    async def cancel_job(self, user_id: str, job_id: str) -> Job:
        job = await self.get_job(user_id, job_id)
        if job.status in {"succeeded", "failed", "cancelled"}:
            raise ApiError(409, "job_not_cancellable", f"Job is already {job.status}")
        job.status = "cancelled"
        job.updated_at = _now()
        return job

    async def update_job_status(
        self, job_id: str, status: str, progress: float, message: str, output_url: str | None
    ) -> Job:
        job = self.jobs.get(job_id)
        if job is None:
            raise ApiError(404, "job_not_found", "Job not found")
        if job.status == "cancelled" and status != "cancelled":
            raise ApiError(409, "job_cancelled", "Job was cancelled")
        job.status = status
        job.progress = progress
        job.message = message
        job.output_url = output_url
        job.updated_at = _now()
        return job

    async def count_ai_edits(self, user_id: str) -> int:
        return sum(1 for e in self.edits if e["user_id"] == user_id)

    async def record_edit(self, user_id: str, scene_id: str, plan: dict[str, Any], touched: list[str]) -> None:
        self.edits.append(
            {
                "user_id": user_id,
                "scene_id": scene_id,
                "plan_id": plan.get("id"),
                "prompt": plan.get("prompt"),
                "producer": (plan.get("producer") or {}).get("kind"),
                "operations": len(plan.get("operations", [])),
                "touched": touched,
                "at": _now(),
            }
        )

    async def close(self) -> None:
        return None


class PostgresRepository(MemoryRepository):
    """Postgres/Supabase implementation.

    Only the write paths that matter for correctness are overridden; reads that
    are cheap in memory (project membership) still come from SQL. This class is
    exercised against a live database, not in CI - CI runs MemoryRepository.
    """

    def __init__(self, dsn: str) -> None:
        super().__init__()
        self.dsn = dsn
        self._pool: Any = None

    async def _get_pool(self) -> Any:
        if self._pool is None:
            try:
                import asyncpg  # imported lazily so the package stays optional
            except ImportError as exc:  # pragma: no cover
                raise ApiError(
                    500, "database_driver_missing", "Install the 'postgres' extra: pip install .[postgres]"
                ) from exc
            self._pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=10)
        return self._pool

    async def list_projects(self, user_id: str) -> list[Project]:
        pool = await self._get_pool()
        rows = await pool.fetch(
            """
            select p.*, (select count(*) from scenes s where s.project_id = p.id) as scene_count
            from projects p
            join project_members m on m.project_id = p.id
            where m.user_id = $1
            order by p.updated_at desc
            """,
            user_id,
        )
        return [
            Project(
                id=str(r["id"]),
                owner_id=str(r["owner_id"]),
                name=r["name"],
                description=r["description"] or "",
                fps=r["fps"],
                default_resolution=r["default_resolution"],
                created_at=r["created_at"].isoformat(),
                updated_at=r["updated_at"].isoformat(),
                scene_count=r["scene_count"],
            )
            for r in rows
        ]

    async def get_scene(self, user_id: str, scene_id: str) -> dict[str, Any]:
        pool = await self._get_pool()
        row = await pool.fetchrow(
            """
            select s.document from scenes s
            join project_members m on m.project_id = s.project_id
            where s.id = $1 and m.user_id = $2
            """,
            scene_id,
            user_id,
        )
        if row is None:
            raise ApiError(404, "scene_not_found", "Scene not found")
        return row["document"]

    async def save_scene(self, user_id: str, scene: dict[str, Any], expected_revision: int | None) -> dict[str, Any]:
        import json

        pool = await self._get_pool()
        async with pool.acquire() as conn, conn.transaction():
            current = await conn.fetchrow(
                """
                select s.revision from scenes s
                join project_members m on m.project_id = s.project_id
                where s.id = $1 and m.user_id = $2 for update
                """,
                scene["id"],
                user_id,
            )
            if current is None:
                raise ApiError(404, "scene_not_found", "Scene not found")
            if expected_revision is not None and current["revision"] != expected_revision:
                raise ApiError(409, "revision_conflict", "The scene was modified by someone else; reload before saving")
            await conn.execute(
                "update scenes set document = $2::jsonb, revision = $3, updated_at = now() where id = $1",
                scene["id"],
                json.dumps(scene),
                scene["revision"],
            )
            await conn.execute(
                "insert into scene_versions (scene_id, revision, label, document) values ($1, $2, $3, $4::jsonb)",
                scene["id"],
                scene["revision"],
                f"Saved revision {scene['revision']}",
                json.dumps(scene),
            )
        return scene

    async def update_job_status(
        self, job_id: str, status: str, progress: float, message: str, output_url: str | None
    ) -> Job:
        pool = await self._get_pool()
        row = await pool.fetchrow(
            """
            update jobs set status = $2, progress = $3, message = $4, output_url = $5, updated_at = now()
            where id = $1
            returning *
            """,
            job_id,
            status,
            progress,
            message,
            output_url,
        )
        if row is None:
            raise ApiError(404, "job_not_found", "Job not found")
        return Job(
            id=str(row["id"]),
            project_id=str(row["project_id"]),
            kind=row["kind"],
            status=row["status"],
            progress=float(row["progress"]),
            message=row["message"] or "",
            scene_id=str(row["scene_id"]) if row["scene_id"] else None,
            output_url=row["output_url"],
            created_at=row["created_at"].isoformat(),
            updated_at=row["updated_at"].isoformat(),
        )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()


_repository: Repository | None = None


def get_repository(settings: Settings) -> Repository:
    global _repository
    if _repository is None:
        _repository = MemoryRepository() if settings.use_memory_repository else PostgresRepository(settings.database_url)
    return _repository


def reset_repository() -> None:
    """Test helper: drop the singleton so each test file starts clean."""
    global _repository
    _repository = None
