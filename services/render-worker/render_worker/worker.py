"""Queue worker for renders and .blend exports.

Contract
--------
The API pushes a JSON payload onto `ai3d:jobs:render`:

    {"job_id": "...", "kind": "render"|"export", "scene": {...document...},
     "settings": {"engine": "eevee", "format": "mp4", "frame_range": [0,240], ...}}

The worker runs Blender headless, publishes progress on
`ai3d:events:<job_id>` and posts the final status back to the API with the
service token. If Redis or Blender is missing it exits loudly rather than
pretending a job ran.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

QUEUE_KEY = os.environ.get("JOB_QUEUE_NAMESPACE", "ai3d") + ":jobs:render"
BLENDER_BIN = os.environ.get("BLENDER_BIN", "/usr/bin/blender")
WORK_DIR = Path(os.environ.get("RENDER_WORK_DIR", "/tmp/ai3d-renders"))
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
JOB_TIMEOUT = int(os.environ.get("JOB_TIMEOUT_SECONDS", "3600"))


def _publish(redis: Any, job_id: str, payload: dict[str, Any]) -> None:
    try:
        redis.publish(f"ai3d:events:{job_id}", json.dumps(payload))
    except Exception:  # pragma: no cover - progress is best effort
        pass


def _report(job_id: str, status: str, progress: float, message: str, output_url: str | None = None) -> None:
    if not SERVICE_TOKEN:
        print(f"[worker] SERVICE_TOKEN unset; cannot report job {job_id}", file=sys.stderr)
        return
    try:
        with httpx.Client(timeout=10) as client:
            client.post(
                f"{API_BASE}/api/v1/jobs/{job_id}/progress",
                headers={"x-service-token": SERVICE_TOKEN},
                json={"status": status, "progress": progress, "message": message, "output_url": output_url},
            )
    except httpx.HTTPError as exc:  # pragma: no cover
        print(f"[worker] report failed for {job_id}: {exc}", file=sys.stderr)


def run_blender(scene: dict[str, Any], job_id: str, kind: str, settings: dict[str, Any]) -> dict[str, Any]:
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    scene_file = job_dir / "scene.json"
    scene_file.write_text(json.dumps(scene), encoding="utf-8")

    out_blend = job_dir / ("export.blend" if kind == "export" else "render.blend")
    command = [BLENDER_BIN, "--background", "--python", str(Path(__file__).with_name("blender_job.py")), "--", str(scene_file), str(out_blend)]

    if kind == "render":
        render_dir = job_dir / "frames"
        command += ["--render", str(render_dir)]
        if settings.get("format") == "png_sequence" and settings.get("still"):
            command += ["--still", str(settings["still"])]

    started = time.time()
    completed = subprocess.run(command, capture_output=True, text=True, timeout=JOB_TIMEOUT, check=False)
    elapsed = time.time() - started
    (job_dir / "blender.log").write_text(completed.stdout + "\n" + completed.stderr, encoding="utf-8")

    if completed.returncode != 0:
        raise RuntimeError(f"Blender exited {completed.returncode}; see {job_dir / 'blender.log'}")

    result_file = job_dir / "result.json"
    result = json.loads(result_file.read_text(encoding="utf-8")) if result_file.exists() else {"ok": True}
    result["elapsed_seconds"] = round(elapsed, 2)
    result["job_dir"] = str(job_dir)

    if kind == "render" and settings.get("format") == "mp4":
        result["video"] = encode_mp4(job_dir / "frames", job_dir / "output.mp4", int(settings.get("fps", 24)))
    return result


def encode_mp4(frames_dir: Path, out_file: Path, fps: int) -> str | None:
    """Encode the PNG sequence with ffmpeg when it is available."""
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return None
    command = [
        ffmpeg,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(frames_dir / "frame_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(out_file),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    return str(out_file) if completed.returncode == 0 else None


def process_payload(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload["job_id"]
    kind = payload.get("kind", "render")
    _report(job_id, "running", 0.05, "Blender started")
    result = run_blender(payload["scene"], job_id, kind, payload.get("settings", {}))
    _report(job_id, "succeeded", 1.0, f"Finished in {result['elapsed_seconds']}s", result.get("video") or result.get("blend"))
    return result


def main() -> int:
    try:
        import redis  # type: ignore
    except ImportError:
        print("[worker] redis package missing: pip install redis", file=sys.stderr)
        return 2
    if not Path(BLENDER_BIN).exists():
        print(f"[worker] Blender not found at {BLENDER_BIN}", file=sys.stderr)
        return 2

    client = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    print(f"[worker] listening on {QUEUE_KEY}")
    while True:
        item = client.brpop(QUEUE_KEY, timeout=5)
        if item is None:
            continue
        _, raw = item
        try:
            payload = json.loads(raw)
            process_payload(payload)
        except Exception as exc:  # pragma: no cover - worker resilience
            job_id = "unknown"
            try:
                job_id = json.loads(raw)["job_id"]
            except Exception:
                pass
            _report(job_id, "failed", 0.0, f"{exc.__class__.__name__}: {exc}")
            print(f"[worker] job {job_id} failed: {exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
