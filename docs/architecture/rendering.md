# Rendering and export

## Two paths

**Browser preview (works with no backend).** The studio captures the WebGL
drawing buffer with `canvas.captureStream()` and `MediaRecorder` while the
timeline plays, producing a WebM file; `toDataURL` produces PNG stills. This is
honest about being viewport quality: no ray tracing, denoising or motion blur.
It exists so "render" produces a real file before any worker is connected.

**Blender (authoritative).**

```
scene document (jsonb)
   → render job (queued in Redis)
   → render-worker: blender --background --python blender_job.py -- scene.json out.blend
   → build_scene(): materials, meshes, empties, cameras, lights, parenting, keyframes, colour management
   → .blend saved  (+ optional PNG frames → ffmpeg mp4)
   → progress reported to the API with the service token
```

## Mapping rules

| Scene | Blender |
| --- | --- |
| `obj_apple` | object named `obj_apple` (round-trip safe) |
| primitive geometry | `primitive_*_add` with params, then transform |
| `material_id` | Principled BSDF material named by material id |
| camera object | camera datablock, lens/sensor/DoF, active camera set |
| light object | light datablock, watts, colour (linear), size, spot angle |
| `parent_id` | `obj.parent = parent` |
| transform clips | `location` / `rotation_euler` / `scale` keyframes |
| pose clips | **not baked** without an armature — reported in `warnings` |
| `asset` geometry | proxy empty + warning until the asset cache is wired |
| `procedural` geometry | proxy empty + warning (no generator implementation yet) |

Colours are converted sRGB → linear (`hex_to_linear_rgb`), because handing
sRGB floats to Blender is the classic way to get washed-out renders.

## Engine ids

EEVEE was renamed (`BLENDER_EEVEE_NEXT` in 4.2+, `BLENDER_EEVEE` in 5.x).
`_pick_engine()` reads the enum from the running build instead of hardcoding an
id, so an image upgrade does not silently break every render.

## Supported presets (advertised only when real)

| Resolution | EEVEE | Cycles |
| --- | --- | --- |
| 1920×1080 | ✅ | ✅ |
| 2560×1440 | ✅ | ✅ |
| 3840×2160 | ❌ (needs GPU worker) | ✅ GPU only |
| 60 fps | ✅ previews | ❌ in this release |

`RenderRequest` rejects unsupported combinations with 422, and the UI labels
gated options instead of offering them.

## Export

`.blend` export runs the same builder and returns the file. Textures are
included when the asset cache is mounted; otherwise the export carries material
values and the object graph, and the response says so.
