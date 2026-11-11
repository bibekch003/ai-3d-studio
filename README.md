# AI 3D Studio

**Describe a shot. Direct it like a film. Then click anything to change it.**

A browser-based AI filmmaking platform where the primary output is an **editable,
structured 3D scene** — not a generated video. A written scene becomes a scene
graph of characters, props, sets, lights, cameras and an animation timeline, with
every object addressable by a stable id. Natural-language edits compile to
validated operations, preview their targets, and apply atomically with undo.

> Provisional name. Branding is configuration: set `NEXT_PUBLIC_PRODUCT_NAME`.

---

## What is actually built (and what is not)

This repository is a working application, not a mock-up. Being precise about the
line matters more than a long feature list.

| Capability | State |
| --- | --- |
| Scene graph, schema 1.1, validation, migrations | **working** (TS + Python), tested |
| Three.js studio: raycast selection, hover, gizmo, context inspector | **working** in the browser |
| Natural-language edit planner (deterministic rule engine) | **working**, TS + Python, tested |
| Plan validation gates (targets, types, locks, preservation, atomicity) | **working**, tested both sides |
| Non-destructive history: undo/redo, jump, variations, per-object versions | **working**, tested |
| AI Scene Director: cast, props, environment, beats, shots, build ops | **working**, tested |
| FastAPI service: projects, scenes, versions, plans, jobs, SSE, rate limits | **working**, 35 tests |
| Postgres schema with Row Level Security | **written and CI-applied**; not run against a live Supabase project here |
| Blender scene builder (materials, meshes, cameras, lights, keyframes) | **written and unit-tested**; Blender itself is not installed in this environment |
| Render worker, generation worker, segmentation worker | **written**; need Redis, Blender and/or model endpoints to run |
| Text-to-3D, motion, lip-sync, video generation models | **not bundled** — adapters only, disabled until licensed and configured |
| Deployment to Vercel/Supabase/container host | **not performed** — runbook in `docs/deployment/vercel-supabase.md` |

Nothing in the UI fakes model output. When a capability is unavailable the
affordance is disabled and says why.

---

## Quickstart

```bash
npm install
npm run dev            # http://localhost:3000 — studio works with no backend
```

Open `/studio`. Click the apple, the table, the boy's hair, a light or the
camera, then use **AI edit**:

```
Make the table look like old oak wood.
Change his hairstyle but preserve his face.
Change the lighting to a sunset atmosphere.
```

The plan panel lists the target objects, the operations, the preserved
properties and any warnings before anything changes. Apply, then `Ctrl+Z`.

### With the API

```bash
cd services/api
pip install -e ".[dev]"
DATABASE_URL=memory:// uvicorn app.main:app --reload --port 8000
```

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
```

Details: [`docs/setup/local-development.md`](docs/setup/local-development.md).

---

## Architecture in one screen

```
apps/web                 Next.js 14 · React Three Fiber · Zustand · TanStack Query
packages/scene-core      scene document, zod schema, validation, migrations, planner, director
packages/editor          apply operations, atomic plan application, history, selection
packages/ui              design system
packages/shared-types    API contract types

services/api             FastAPI · Pydantic · repositories (memory | Postgres)
services/ai-orchestrator planner, director, model adapters, model registry
services/render-worker   Blender: EEVEE / Cycles / .blend export
services/generation-worker   model adapters behind a queue
services/segmentation-worker SAM 2.1 for imported images and video

database/migrations      schema, RLS policies, indexes  (0001 → 0003)
database/seeds           model registry reference data
infrastructure/docker    API, web, render-worker images
docs/                    architecture · api · setup · deployment · development
```

**Why the scene document is authoritative:** the editor, the AI planner, the
audit log, the Blender builder and the `.blend` export all read the same
document. Blender is a production engine, not the database.

Read more: [`docs/architecture/overview.md`](docs/architecture/overview.md) ·
[`scene-graph.md`](docs/architecture/scene-graph.md) ·
[`ai-editing.md`](docs/architecture/ai-editing.md) ·
[`rendering.md`](docs/architecture/rendering.md).

---

## Click-to-edit: how it actually works

1. **Selection** — `raycast → object id` from the Three.js scene, or the
   hierarchy tree, or `POST /ai/select` ("the apple") which ranks scene objects
   by name, tag and path. Multi-select, subtree select, category select, lock,
   hide.
2. **Instruction** — "change his hairstyle but preserve his face".
3. **Plan** — a rule engine resolves `chr_boy_hair` → walks ancestors → finds
   `chr_boy` → emits `set_character{hair}` and records `preserve: ["face"]`.
4. **Validation** — target exists, is a character, is not locked, and the plan
   does not break its own preservation promise.
5. **Preview** — affected objects, operations, warnings, confidence.
6. **Apply** — atomic, revision-bumped, snapshotted, audited with the prompt.
7. **Undo** — exact snapshot restore, or branch a variation instead.

Vision models are used only for *imported* images and video. A scene that
already has object ids does not need segmentation — using it there would be
slower and less accurate.

---

## Tests

```bash
npm run typecheck      # all TS workspaces
npm test               # scene-core 31 + editor 17
npm run build          # Next.js production build (17 routes)

cd services/api           && python -m pytest -q   # 35
cd services/ai-orchestrator && python -m pytest -q # 14
cd services/render-worker && python -m pytest -q   # 7
```

CI (`.github/workflows/ci.yml`) runs all of the above plus a Postgres job that
applies every migration and asserts RLS is enabled on every public table.

---

## Model licensing

Open weights are **not** a commercial licence. The registry
(`services/ai-orchestrator/ai_orchestrator/registry.py`,
`database/seeds/model_registry.sql`, `GET /api/v1/models`) records licence,
territory and usage restrictions per model. Facts verified 2026-11-11:

* **SAM 2.1** — Apache-2.0 (code, checkpoints, demo) → usable.
* **Hunyuan3D 2.1** — Tencent Hunyuan 3D 2.1 Community License: excludes the EU,
  UK and South Korea; written approval above 1M MAU; outputs may not train other
  models → restricted, adapter only.
* **TRELLIS.2** — MIT model/code, but renderer dependencies carry their own
  terms → restricted until the mesh path is audited.
* **Blender** — 5.2 LTS is the production pin (5.3 went stable 2026-11-10);
  the application is GPL, your renders are yours.

Process for adopting anything new: [`docs/development/improvement-policy.md`](docs/development/improvement-policy.md).

---

## Live demo (GitHub Pages)

A static build of the app is published from `main` by
`.github/workflows/deploy-pages.yml`. It runs the studio, planner, director and
inspector entirely in the browser against the bundled demo scene — no API, no
persistence, and the UI says so. Full-stack deployment (Postgres, renders,
model workers) is the separate runbook below.

See [`docs/deployment/github-pages.md`](docs/deployment/github-pages.md).

## Deployment

Not deployed from here: no credentials were used and no external account was
touched. The runbook covers repo creation, Supabase migrations and RLS checks,
Vercel configuration, the container host, workers, verification commands and
rollback: [`docs/deployment/vercel-supabase.md`](docs/deployment/vercel-supabase.md).

---

## Roadmap (deliberately sequenced)

1. Character library + rigged asset pipeline (casting a plan's roles).
2. Asset cache so `asset` geometry renders in Blender instead of a proxy.
3. Armature export for pose clips; motion-model adapter behind licence review.
4. Redis-backed rate limiting and a multi-instance job scheduler.
5. Collaborative editing (CRDT over per-object operations).
6. Billing enforcement wired to `usage_records` and `subscriptions`.

## Licence

MIT for this repository; third-party models and engines keep their own terms —
see `LICENSE` and the model registry.
