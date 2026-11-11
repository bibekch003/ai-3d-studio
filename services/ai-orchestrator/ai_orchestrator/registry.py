"""Model registry: what may be enabled, and on what terms.

Licence facts recorded here were checked against primary sources on 2026-11-11.
Re-verify before enabling a model for commercial work; licences change.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelRecord:
    id: str
    name: str
    family: str
    task: str
    version: str
    licence: str
    commercial_use: str  # allowed | restricted | unknown | forbidden
    hardware: str
    status: str  # available | adapter_only | disabled
    notes: str
    docs_url: str | None = None


MODEL_REGISTRY: list[ModelRecord] = [
    ModelRecord(
        id="planner.deterministic",
        name="Built-in rule planner",
        family="planner",
        task="instruction-to-edit-plan",
        version="1.0.0",
        licence="MIT (this repository)",
        commercial_use="allowed",
        hardware="CPU, no weights",
        status="available",
        notes="Deterministic rule engine; labelled as such in every plan it produces.",
    ),
    ModelRecord(
        id="blender",
        name="Blender",
        family="engine",
        task="scene-build-and-render",
        version="5.2 LTS (5.3 stable, released 2026-11-10)",
        licence="GPL-2.0-or-later (application); outputs belong to the author",
        commercial_use="allowed",
        hardware="CPU; GPU optional for Cycles",
        status="available",
        notes="Headless via bpy. Pin the container image per release train; 5.3 is one day old, so 5.2 LTS is the production default.",
        docs_url="https://www.blender.org/releases/",
    ),
    ModelRecord(
        id="sam2",
        name="SAM 2.1",
        family="segmentation",
        task="promptable-image-and-video-segmentation",
        version="2.1",
        licence="Apache-2.0 (code, weights, demo)",
        commercial_use="allowed",
        hardware="CUDA GPU, 8-16 GB VRAM",
        status="adapter_only",
        notes="Only used for imported images/video. Native 3D scenes select by object id instead.",
        docs_url="https://github.com/facebookresearch/sam2",
    ),
    ModelRecord(
        id="hunyuan3d-2.1",
        name="Hunyuan3D 2.1",
        family="image-to-3D",
        task="text-and-image-to-3D-asset",
        version="2.1",
        licence="Tencent Hunyuan 3D 2.1 Community License",
        commercial_use="restricted",
        hardware="CUDA GPU, 24 GB+ VRAM",
        status="adapter_only",
        notes="Territory excludes EU, UK and South Korea; >1M MAU requires written Tencent approval; output may not be used to improve other models.",
        docs_url="https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1",
    ),
    ModelRecord(
        id="trellis2",
        name="TRELLIS.2",
        family="image-to-3D",
        task="image-to-3D-asset-with-PBR",
        version="4B",
        licence="MIT (model and code); nvdiffrast / nvdiffrec carry their own terms",
        commercial_use="restricted",
        hardware="CUDA GPU, 16-24 GB VRAM",
        status="adapter_only",
        notes="Audit the mesh-extraction path: the rendering dependencies are licensed separately from the model.",
        docs_url="https://github.com/microsoft/TRELLIS.2",
    ),
    ModelRecord(
        id="motion.reserved",
        name="Motion model (reserved)",
        family="motion",
        task="text-to-motion",
        version="-",
        licence="Not selected",
        commercial_use="unknown",
        hardware="TBD",
        status="disabled",
        notes="Adapter interface reserved; placeholder clips are procedural and labelled as such.",
    ),
    ModelRecord(
        id="speech.reserved",
        name="Speech / lip-sync (reserved)",
        family="speech",
        task="tts-and-viseme-alignment",
        version="-",
        licence="Not selected",
        commercial_use="unknown",
        hardware="TBD",
        status="disabled",
        notes="Voice cloning disabled by default; consent records required per voice.",
    ),
]
