"""Consumes generation jobs and drives a model adapter.

This worker never fabricates output. If the adapter for the requested task is
not configured (no endpoint, no licence approval), the job fails with a message
that names the missing configuration, and the asset is not created.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

QUEUE_KEY = os.environ.get("JOB_QUEUE_NAMESPACE", "ai3d") + ":jobs:generation"
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
ORCHESTRATOR = Path(__file__).resolve().parents[2] / "ai-orchestrator"
if ORCHESTRATOR.exists():
    sys.path.insert(0, str(ORCHESTRATOR))

from ai_orchestrator.adapters import get_adapter  # noqa: E402


def report(job_id: str, status: str, progress: float, message: str, output_url: str | None = None) -> None:
    if not SERVICE_TOKEN:
        print(f"[generation] SERVICE_TOKEN unset; cannot report {job_id}", file=sys.stderr)
        return
    try:
        with httpx.Client(timeout=10) as client:
            client.post(
                f"{API_BASE}/api/v1/jobs/{job_id}/progress",
                headers={"x-service-token": SERVICE_TOKEN},
                json={"status": status, "progress": progress, "message": message, "output_url": output_url},
            )
    except httpx.HTTPError as exc:  # pragma: no cover
        print(f"[generation] report failed: {exc}", file=sys.stderr)


def process(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload["job_id"]
    task = payload.get("task", "text_to_3d")
    adapter = get_adapter(task)

    if not adapter.configured:
        report(job_id, "failed", 0.0, f"Adapter for {task} is not configured; no asset was generated.")
        return {"ok": False, "reason": "adapter_unconfigured"}

    report(job_id, "running", 0.1, f"{adapter.model_id} inference started")
    result = adapter.generate(payload.get("request", {}))
    if not result.ok:
        report(job_id, "failed", 0.0, result.message)
        return {"ok": False, "reason": result.message}

    report(job_id, "succeeded", 1.0, f"{adapter.model_id} finished", result.payload.get("output_url"))
    return {"ok": True, "payload": result.payload, "model_id": result.model_id, "licence": result.licence_note}


def main() -> int:
    try:
        import redis  # type: ignore
    except ImportError:
        print("[generation] redis package missing", file=sys.stderr)
        return 2

    client = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    print(f"[generation] listening on {QUEUE_KEY}")
    while True:
        item = client.brpop(QUEUE_KEY, timeout=5)
        if item is None:
            continue
        _, raw = item
        payload = json.loads(raw)
        try:
            process(payload)
        except Exception as exc:  # pragma: no cover
            report(payload.get("job_id", "unknown"), "failed", 0.0, f"{exc.__class__.__name__}: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
