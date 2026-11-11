"""Replaceable model adapters.

Every generative capability sits behind this interface. An adapter that is not
configured returns ok=False with a clear message: the UI then shows the feature
as unavailable. No adapter ever fabricates a successful result, and none is
enabled without a registry entry recording its licence.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

import httpx


@dataclass
class AdapterResult:
    ok: bool
    model_id: str
    task: str
    payload: dict[str, Any] = field(default_factory=dict)
    message: str = ""
    licence_note: str = ""
    cost_usd: float = 0.0


@runtime_checkable
class ModelAdapter(Protocol):
    task: str
    model_id: str
    configured: bool

    def generate(self, request: dict[str, Any]) -> AdapterResult: ...


class DisabledAdapter:
    """Stands in for a capability with no configured provider."""

    def __init__(self, task: str, model_id: str, reason: str, licence_note: str = "") -> None:
        self.task = task
        self.model_id = model_id
        self.reason = reason
        self.licence_note = licence_note
        self.configured = False

    def generate(self, request: dict[str, Any]) -> AdapterResult:
        return AdapterResult(
            ok=False,
            model_id=self.model_id,
            task=self.task,
            message=f"{self.task} is not configured: {self.reason}",
            licence_note=self.licence_note,
        )


class HttpAdapter:
    """Talks to a self-hosted or hosted inference endpoint over HTTPS."""

    def __init__(
        self,
        task: str,
        model_id: str,
        endpoint_env: str,
        licence_note: str,
        timeout_s: float = 120.0,
        cost_per_call_usd: float = 0.0,
    ) -> None:
        self.task = task
        self.model_id = model_id
        self.endpoint = os.environ.get(endpoint_env, "").strip()
        self.endpoint_env = endpoint_env
        self.licence_note = licence_note
        self.timeout_s = timeout_s
        self.cost_per_call_usd = cost_per_call_usd
        self.configured = bool(self.endpoint)

    def generate(self, request: dict[str, Any]) -> AdapterResult:
        if not self.configured:
            return AdapterResult(
                ok=False,
                model_id=self.model_id,
                task=self.task,
                message=f"{self.task} is not configured (set {self.endpoint_env}).",
                licence_note=self.licence_note,
            )
        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                response = client.post(self.endpoint, json={"model": self.model_id, **request})
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:  # pragma: no cover - network path
            return AdapterResult(
                ok=False,
                model_id=self.model_id,
                task=self.task,
                message=f"{self.task} provider failed: {exc.__class__.__name__}",
                licence_note=self.licence_note,
            )
        return AdapterResult(
            ok=True,
            model_id=self.model_id,
            task=self.task,
            payload=body,
            licence_note=self.licence_note,
            cost_usd=self.cost_per_call_usd,
        )


def _build_adapters() -> dict[str, ModelAdapter]:
    return {
        "text_to_3d": DisabledAdapter(
            "text_to_3d",
            "hunyuan3d-2.1",
            "no GPU inference host is configured; set ADAPTER_HUNYUAN3D_URL after reviewing its licence",
            licence_note="Tencent Hunyuan 3D 2.1 Community License: territory excludes EU/UK/South Korea; >1M MAU needs Tencent approval",
        ),
        "image_to_3d": DisabledAdapter(
            "image_to_3d",
            "trellis2-4b",
            "no GPU inference host is configured; set ADAPTER_HUNYUAN3D_URL or a TRELLIS endpoint",
            licence_note="TRELLIS.2 model and code MIT; renderer dependencies (nvdiffrast/nvdiffrec) are separately licensed",
        ),
        "texture": HttpAdapter(
            "texture",
            "texture-diffusion",
            "ADAPTER_TEXTURE_URL",
            licence_note="Verify the chosen texture model licence before commercial use",
        ),
        "segmentation": HttpAdapter(
            "segmentation",
            "sam2.1",
            "ADAPTER_SAM2_URL",
            licence_note="SAM 2.1 code and checkpoints Apache-2.0",
        ),
        "motion": DisabledAdapter(
            "motion",
            "unselected",
            "no motion model has passed licence review",
            licence_note="Not selected",
        ),
        "speech": HttpAdapter(
            "speech",
            "tts-unselected",
            "ADAPTER_TTS_URL",
            licence_note="Voice cloning disabled by default; requires recorded consent",
        ),
        "video": DisabledAdapter(
            "video",
            "unselected",
            "video generation is an optional separate workflow and is not enabled",
            licence_note="Not selected",
        ),
    }


ADAPTERS: dict[str, ModelAdapter] = _build_adapters()


def get_adapter(task: str) -> ModelAdapter:
    adapter = ADAPTERS.get(task)
    if adapter is None:
        return DisabledAdapter(task, "unselected", f'no adapter is registered for task "{task}"')
    return adapter


def adapter_status() -> list[dict[str, Any]]:
    return [
        {
            "task": a.task,
            "model_id": a.model_id,
            "configured": a.configured,
            "licence_note": getattr(a, "licence_note", ""),
            "message": f'not configured: {getattr(a, "reason", "")}' if not a.configured else "configured",
        }
        for a in ADAPTERS.values()
    ]
