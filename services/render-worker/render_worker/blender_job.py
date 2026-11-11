"""Entrypoint executed *inside* Blender:

    blender --background --python blender_job.py -- <scene.json> <out.blend> [--render <dir>] [--still <frame>]

It builds the scene from the app document, saves an editable .blend and can
render a still or the full frame range. Exit code 0 means the artefacts exist.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) < 2:
        print("usage: blender_job.py <scene.json> <out.blend> [--render dir] [--still frame]", file=sys.stderr)
        return 2

    scene_path = Path(argv[0])
    out_blend = Path(argv[1])
    render_dir = None
    still_frame = None
    if "--render" in argv:
        render_dir = Path(argv[argv.index("--render") + 1])
    if "--still" in argv:
        still_frame = int(argv[argv.index("--still") + 1])

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import bpy  # type: ignore  # noqa: F401  (only importable inside Blender)

    from scene_build import build_scene  # noqa: PLC0415

    document = json.loads(scene_path.read_text(encoding="utf-8"))
    summary = build_scene(bpy, document)

    out_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))

    rendered: list[str] = []
    if render_dir is not None:
        render_dir.mkdir(parents=True, exist_ok=True)
        scene = bpy.context.scene
        scene.render.filepath = str(render_dir / "frame_")
        scene.render.image_settings.file_format = "PNG"
        if still_frame is not None:
            scene.frame_set(still_frame)
            bpy.ops.render.render(write_still=True)
            rendered.append(str(render_dir / f"frame_{still_frame:04d}.png"))
        else:
            bpy.ops.render.render(animation=True)
            rendered = sorted(str(p) for p in render_dir.glob("frame_*.png"))

    result = {
        "ok": True,
        "blend": str(out_blend),
        "rendered": rendered,
        "summary": summary,
        "blender_version": bpy.app.version_string,
    }
    (out_blend.parent / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:  # pragma: no cover - Blender-side failure path
        traceback.print_exc()
        out_dir = os.environ.get("AI3D_WORK_DIR", ".")
        Path(out_dir, "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
        raise SystemExit(1)
