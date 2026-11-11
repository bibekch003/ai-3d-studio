"""Request/response models. Validation happens here, before any handler runs."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=2, max_length=80)]
Prompt = Annotated[str, Field(min_length=3, max_length=2000)]


class ProjectCreate(BaseModel):
    name: Name
    description: Annotated[str, Field(max_length=500)] = ""
    fps: Literal[24, 25, 30, 60] = 24


class ProjectPatch(BaseModel):
    name: Name | None = None
    description: Annotated[str, Field(max_length=500)] | None = None


class SceneSave(BaseModel):
    scene: dict[str, Any]
    expected_revision: int | None = None


class ObjectPatch(BaseModel):
    """Direct (non-AI) property edit from the inspector."""

    operations: list[dict[str, Any]] = Field(min_length=1, max_length=50)
    label: str = "Manual edit"


class PlanRequest(BaseModel):
    scene_id: str
    prompt: Prompt
    preserve: list[str] = Field(default_factory=list, max_length=12)
    scope: list[str] = Field(default_factory=list, max_length=200)


class ApplyRequest(BaseModel):
    scene_id: str
    plan: dict[str, Any]
    label: str | None = None


class DirectorRequest(BaseModel):
    prompt: Prompt
    fps: Literal[24, 25, 30, 60] = 24
    seconds: Annotated[int, Field(ge=2, le=120)] = 10


class SelectRequest(BaseModel):
    scene_id: str
    query: Annotated[str, Field(min_length=2, max_length=120)]
    mode: Literal["replace", "add", "toggle"] = "replace"


class RenderRequest(BaseModel):
    scene_id: str
    engine: Literal["eevee", "cycles"] = "eevee"
    resolution: Literal["1920x1080", "2560x1440", "3840x2160"] = "1920x1080"
    fps: Literal[24, 25, 30, 60] = 24
    samples: Annotated[int, Field(ge=1, le=8192)] = 64
    frame_range: tuple[int, int] = (0, 240)
    format: Literal["mp4", "png_sequence", "exr_sequence", "blend"] = "mp4"

    @model_validator(mode="after")
    def _check_supported(self) -> RenderRequest:
        # Never advertise a combination the worker cannot produce.
        if self.resolution == "3840x2160" and self.engine == "eevee":
            raise ValueError("4K is only offered with the Cycles worker")
        if self.fps == 60 and self.engine == "cycles":
            raise ValueError("60 fps is only offered for EEVEE previews in this release")
        if self.frame_range[1] <= self.frame_range[0]:
            raise ValueError("frame_range end must be greater than start")
        return self


class ExportRequest(BaseModel):
    scene_id: str
    include_textures: bool = True


class JobProgress(BaseModel):
    """Posted by a worker; authenticated with the service token, not a user JWT."""

    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    progress: Annotated[float, Field(ge=0, le=1)] = 0.0
    message: Annotated[str, Field(max_length=2000)] = ""
    output_url: Annotated[str, Field(max_length=2000)] | None = None


class AssetCreate(BaseModel):
    project_id: str | None = None
    kind: Literal["model", "texture", "hdri", "audio", "video", "image"]
    name: Name
    format: Annotated[str, Field(min_length=1, max_length=16)]
    size_bytes: Annotated[int, Field(ge=0, le=2_000_000_000)]
    licence: Annotated[str, Field(min_length=1, max_length=200)]

    @field_validator("format")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class FeedbackCreate(BaseModel):
    message: Annotated[str, Field(min_length=3, max_length=2000)]
    project_id: str | None = None
    sentiment: Literal["bug", "idea", "praise", "other"] = "other"
