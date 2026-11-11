# Model registry

Single source of truth in code: `services/ai-orchestrator/ai_orchestrator/registry.py`
and `database/seeds/model_registry.sql`. Exposed read-only at `GET /api/v1/models`.

| Model | Task | Licence | Commercial use | Status |
| --- | --- | --- | --- | --- |
| Built-in rule planner | instruction → edit plan | MIT (this repo) | allowed | available |
| Blender 5.2 LTS | scene build + render | GPL-2.0-or-later (app); outputs yours | allowed | available |
| SAM 2.1 | promptable image/video segmentation | Apache-2.0 | allowed | adapter only |
| Hunyuan3D 2.1 | text/image → 3D asset | Tencent Hunyuan 3D 2.1 Community License | **restricted** | adapter only |
| TRELLIS.2 (4B) | image → 3D with PBR | MIT (model/code); renderer deps separate | **restricted** | adapter only |
| Motion model | text → motion | not selected | unknown | disabled |
| Speech / lip-sync | TTS + visemes | not selected | unknown | disabled |

## Why "restricted" is not "allowed"

* **Hunyuan3D 2.1** — the licence territory excludes the European Union, the
  United Kingdom and South Korea, requires written approval above 1M monthly
  active users, and forbids using outputs to improve other models. Serving it
  worldwide would breach it.
* **TRELLIS.2** — the model is MIT, but the usual mesh/GLB extraction path pulls
  in renderers under different licences. Shipping the default pipeline
  commercially is a legal question, not a code question.

## Recording a new model

```sql
insert into model_registry (id, name, family, task, licence, commercial_use, hardware, status, notes, docs_url)
values ('vendor-model-x', 'Model X', 'image-to-3D', 'image-to-3D-asset',
        'Vendor Community License v1', 'restricted', 'CUDA 24 GB', 'adapter_only',
        'Territory: worldwide; output may not be used to train competing models.',
        'https://…');
insert into model_versions (model_id, version, licence_snapshot, approved_by, approved_at, notes)
values ('vendor-model-x', '1.0', '<licence text hash>', auth.uid(), now(), 'benchmark attached to PR #123');
```

Then, and only then, set `ADAPTER_*_URL` for the worker.
