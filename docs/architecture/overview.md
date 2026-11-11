# Architecture overview

## The one idea

**The scene document is the product.** A shot is not a video and not a Blender
file: it is a versioned, validated JSON document owned by this application.
Everything else — the browser editor, the AI planner, the render worker, the
`.blend` export — is a view of or a projection from that document.

Consequences that shape the whole codebase:

| Decision | Why |
| --- | --- |
| Object ids are stable and human-debuggable (`obj_apple`, `chr_boy_hair`) | Selection, edits, animation targets, audit logs and Blender object names all use the same key |
| Blender rebuilds the scene from the document on every job | No hidden state drifts; a render is reproducible from a revision |
| AI never mutates a scene directly | It emits an `EditPlan` that is validated against the live graph first |
| History stores full snapshots | Undo is exact, branching is cheap, a failed apply is recoverable |
| Nothing generative is bundled | Model licences change; adapters keep that decision outside the code |

## Services

```
browser (Next.js 14, R3F)
   │  REST + SSE
   ▼
api (FastAPI)  ──▶  Postgres / Supabase (RLS)      scene documents, versions, audit
   │  enqueue (Redis)
   ├──▶ render-worker        (Blender headless: EEVEE / Cycles, .blend export)
   ├──▶ generation-worker    (model adapters: text-to-3D, texture, motion)
   └──▶ segmentation-worker  (SAM 2.1 for imported images and video)
```

* **api** — validation, authorisation, plan/apply, versioning, job creation. It
  never renders and never runs inference inline.
* **ai-orchestrator** — importable library (not a network hop in v1): the
  deterministic planner, the scene director, the adapter registry. Split into
  its own service when planning needs its own scaling profile.
* **workers** — long-running, queue-driven, horizontally scalable. GPU only
  where a task needs it.

## Request flow for an AI edit

1. `POST /api/v1/ai/edit/plan` → planner returns an `EditPlan` (no mutation).
2. `validate_plan()` checks every target exists, is unlocked, is the right type,
   and that the plan does not break its own preservation promises.
3. Client shows targets, operations, warnings and confidence.
4. `POST /api/v1/ai/edit/apply` re-validates (the client is not trusted),
   applies atomically, writes a `scene_versions` row and an `edit_operations`
   audit row, then returns the new document.

## Why a monorepo

The scene schema is shared by TypeScript (editor, validation) and Python
(server validation, Blender builder). Keeping them in one repository with one
CI run is what stops the two implementations drifting silently; the mirrored
rule tables are listed in `docs/architecture/ai-editing.md#parity`.

## Failure behaviour

| Failure | Behaviour |
| --- | --- |
| Planner returns an invalid plan | 422 with the exact validation errors; scene untouched |
| Save races another save | 409 `revision_conflict`; client reloads, nothing is overwritten |
| Blender crashes | Job marked `failed` with the log path; scene untouched |
| Adapter not configured | Job fails with the missing env var named; no fake asset |
| Redis down | API still serves reads; job creation returns 503 from the queue layer |

## Rate limiting

`app/security.py` implements a fixed-window limiter in process memory. That is
correct for one instance and wrong for many: when the API scales horizontally,
move the bucket to Redis (`INCR` + `EXPIRE` on `rl:<principal>:<minute>`) behind
the same `RateLimiter.check()` interface.

## What is deliberately not here

* No model weights, no GPU code paths executed in this build.
* No server-side video editing (audio muxing is delegated to ffmpeg in the
  worker, which is optional and reported when absent).
* No collaborative editing (CRDT/OT) yet — the revision counter plus 409
  conflicts is the v1 contract; see `docs/architecture/scene-graph.md#concurrency`.
