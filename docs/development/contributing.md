# Contributing

## Branching

`main` (production) ← `develop` ← `feat/<topic>`. Squash-merge features;
conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).

## Definition of done

A change is done when:

1. It has tests (TS: vitest; Python: pytest) that fail without it.
2. `npm run typecheck && npm test && npm run build` pass.
3. `python -m pytest` passes in every touched service.
4. Schema changes bump `SCENE_SCHEMA_VERSION` and add a migration + a
   "opens the previous version" test.
5. New user-visible behaviour is described in `docs/`.
6. No secret, no real credential, no customer data in the diff.

## Code layout rules

* `packages/scene-core` has no React and no DOM. It must run in Node, the
  browser and a test runner.
* `packages/editor` holds pure state machines (history, selection, apply). No
  fetching, no rendering.
* `apps/web` components fetch through `lib/api.ts`; a component never calls
  `fetch` directly.
* `services/api` routers stay thin: validation in `schemas.py`, rules in
  `services/`, persistence in `repositories.py`.
* Workers never write to the database directly; they report through the API.

## Adding an edit operation

1. Add the variant to `EditOperation` in `packages/scene-core/src/types.ts`.
2. Add `OP_TARGET_TYPES` and preservation mapping in `edit-plan.ts`.
3. Add the apply branch in `packages/editor/src/operations.ts` **and**
   `services/api/app/services/scene_ops.py`.
4. Add the Blender mapping if it affects geometry/lighting.
5. Tests: plan validation, apply, undo, and one API test.

## Review checklist

* Does the change let a model touch the scene without validation? (must not)
* Does it preserve unrelated objects, ids and revisions? (must)
* Does it degrade honestly when a service is missing? (must)
* Is any licence claim in this diff backed by a source? (must)
