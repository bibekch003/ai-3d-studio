# Scene graph and document model

Schema id: `ai3d.scene/1.1`. TypeScript: `packages/scene-core/src/types.ts`.
Python fixture: `services/api/app/scene_fixtures.py`.

## Document

```jsonc
{
  "schema_version": "1.1",
  "id": "scn_…", "project_id": "prj_…", "name": "Boy, table, apple",
  "revision": 12,
  "settings": { "fps": 24, "duration_frames": 240, "resolution": {"width":1920,"height":1080},
                "render_engine": "eevee", "samples": 64, "denoise": true,
                "color_management": {"view_transform":"AgX","look":"Medium High Contrast"} },
  "environment": { "kind":"interior", "preset_id":"room.domestic.small",
                   "time_of_day":"afternoon", "weather":"clear",
                   "sky": {"kind":"procedural","color":"#9fb7d4"},
                   "atmosphere": {"fog_density":0}, "global_style":"cinematic" },
  "objects": [ /* SceneObject[] */ ],
  "materials": [ /* PbrMaterial[] */ ],
  "animations": [ /* AnimationClip[] */ ],
  "shots": [ /* Shot[] */ ],
  "active_camera_id": "cam_main",
  "metadata": {}
}
```

## Object

Every object carries: `id`, `name`, `type`, `parent_id`, `transform`,
`geometry`, `material_id`, `material_overrides`, `texture_refs`,
`animation_refs`, `visible`, `locked`, `protected`, `tags`, `version`,
`metadata`, plus a typed payload for its kind (`character`, `camera`, `light`,
`audio`, `particles`).

Character hierarchy (the case that breaks naive editors):

```
chr_boy                 character   identity_id, rig, wardrobe, expression
├── chr_boy_head        body_part
│   ├── chr_boy_face    body_part
│   ├── chr_boy_eyes    body_part
│   └── chr_boy_hair    body_part   ← "change his hair" resolves here
├── chr_boy_body        body_part
│   └── chr_boy_clothing
├── chr_boy_arm_l/r     body_part
│   └── chr_boy_hand_r  body_part   ← grasp socket for the apple
└── chr_boy_legs        body_part
```

Selecting `chr_boy` selects the root only; `selectSubtree()` adds all
descendants. An AI instruction naming "his hair" resolves to
`chr_boy_hair` and then walks ancestors to find the character that owns it —
so the edit lands on `set_character` (identity-preserving) rather than on the
hair mesh in isolation.

## Validation rules

Structural (zod / Pydantic) then graph invariants:

* unique ids; parent exists; no self-parent; no cycles
* `camera` objects have camera settings, `light` objects have light settings,
  `character` objects have character state
* `active_camera_id` and shot cameras exist
* animation targets exist; clip ranges are ordered; clips past the scene
  duration are warnings, not errors
* ≤ 5000 objects (configurable)
* material references resolve (warning, not error: a scene can reference a
  library material that has not been loaded yet)

`validateScene()` returns `{ok, errors, warnings}`; the editor blocks on errors
and shows warnings.

## Versioning and migrations

`migrateScene()` runs an ordered chain of pure functions keyed by version
(`1.0 → 1.1` today). Rules:

1. A migration never changes an object id.
2. A migration is idempotent where possible.
3. A document from a newer schema is **refused**, not guessed at.
4. A document older than `MIN_SUPPORTED_SCHEMA_VERSION` is refused with an
   upgrade message.

Adding a field means: bump `SCENE_SCHEMA_VERSION`, add a migration, add a test
that opens a document from the previous version.

## Concurrency

`revision` is monotonic per scene. `PUT /scenes/{id}` takes
`expected_revision`; a mismatch returns 409 and writes nothing. That is the v1
contract — simple, correct, and honest about not being real-time
collaboration. A CRDT layer would replace `objects[]` with per-object ops logs;
the id scheme already supports it.

## Projection tables

`scenes.document` is authoritative. `scene_objects`, `cameras`, `lights`,
`animations`, `animation_tracks`, `keyframes` mirror it so the database can
answer "how many props does this project have" without parsing JSON. The API
writes both inside one transaction. If they ever disagree, the document wins
and a reconciliation job rebuilds the projection.
