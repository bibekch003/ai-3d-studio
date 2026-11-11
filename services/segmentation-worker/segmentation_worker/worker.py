"""SAM 2.1 segmentation worker.

The model is Apache-2.0 licensed, but it is not bundled: point ADAPTER_SAM2_URL
at an inference host (or a local service wrapping the checkpoints). Until then
this worker reports the capability as unavailable instead of returning masks it
did not compute.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx

QUEUE_KEY = os.environ.get("JOB_QUEUE_NAMESPACE", "ai3d") + ":jobs:segmentation"
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
ENDPOINT = os.environ.get("ADAPTER_SAM2_URL", "").strip()

ORCHESTRATOR = Path(__file__).resolve().parents[2] / "ai-orchestrator"
if ORCHESTRATOR.exists():
    sys.path.insert(0, str(ORCHESTRATOR))

from ai_orchestrator.adapters import get_adapter  # noqa: E402


def report(job_id: str, status: str, progress: float, message: str, output_url: str | None = None) -> None:
    if not SERVICE_TOKEN:
        print(f"[segmentation] SERVICE_TOKEN unset; cannot report {job_id}", file=sys.stderr)
        return
    try:
        with httpx.Client(timeout=10) as client:
            client.post(
                f"{API_BASE}/api/v1/jobs/{job_id}/progress",
                headers={"x-service-token": SERVICE_TOKEN},
                json={"status": status, "progress": progress, "message": message, "output_url": output_url},
            )
    except httpx.HTTPError as exc:  # pragma: no cover
        print(f"[segmentation] report failed: {exc}", file=sys.stderr)


def process(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload.get("job_id", "unknown")
    adapter = get_adapter("segmentation")
    if not adapter.configured:
        report(job_id, "failed", 0.0, "SAM 2.1 endpoint is not configured (ADAPTER_SAM2_URL); no mask was produced.")
        return {"ok": False, "reason": "adapter_unconfigured"}

    report(job_id, "running", 0.2, "SAM 2.1 promptable segmentation")
    result = adapter.generate(payload.get("request", {}))
    if not result.ok:
        report(job_id, "failed", 0.0, result.message)
        return {"ok": False, "reason": result.message}
    report(job_id, "succeeded", 1.0, "masks ready", result.payload.get("mask_url"))
    return {"ok": True, "payload": result.payload}


def main() -> int:
    if not ENDPOINT:
        print("[segmentation] ADAPTER_SAM2_URL is not set; worker will report jobs as failed", file=sys.stderr)
    try:
        import redis  # type: ignore
    except ImportError:
        print("[segmentation] redis package missing", file=sys.stderr)
        return 2

    client = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    print(f"[segmentation] listening on {QUEUE_KEY}")
    while True:
        item = client.brpop(QUEUE_KEY, timeout=5)
        if item is None:
            continue
        _, raw = item
        try:
            process(json.loads(raw))
        except Exception as exc:  # pragma: no cover
            print(f"[segmentation] failed: {exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
