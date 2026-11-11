# Build report — 11 November 2026

Status of the AI 3D Studio repository as delivered. Written to be checkable: every
claim below is either a command you can re-run or a file you can open.

## Deployment status

| Target | State |
| --- | --- |
| GitHub repository | **live** — https://github.com/bibekch003/ai-3d-studio (public, 163 files) |
| Static demo on GitHub Pages | **live** — https://bibekch003.github.io/ai-3d-studio/ (workflow run #17, conclusion `success`) |
| Full stack (API + Postgres + workers) | **not deployed** — needs credentials; runbook unchanged |

The Pages build is the browser-only application: studio, planner, director and
inspector run client-side against the bundled demo scene. The build job asserts
`out/index.html` and `out/studio/index.html` exist before deploying, so a green
run means those routes were produced.

## Refinement pass (11 November 2026, second delivery)

Reported problems and what changed:

| Report | Cause | Fix |
| --- | --- | --- |
| "Whatever prompt I type, the boy with apple comes" | The studio always loaded the bundled demo scene; nothing built a scene from a prompt | `buildSceneFromPrompt()` + `buildBlankScene()` in `scene-core`, wired to a scene menu (demo / empty stage / restore saved) and an **AI edit → New scene** tab |
| "The boy comes automatically and is unchangeable" | Same root cause: no scene lifecycle | New scene replaces the document; Ctrl+Z restores; the scene persists across pages |
| "Live animation is not working" | The viewport rendered static transforms — clips were never sampled | `sampleScene(scene, frame)` drives the render tree; playback, scrubbing and keyframe clicks all move the objects |
| "Video is not rendering" | Only the Blender worker could produce video, and it is not connected | In-browser **Record** (WebM via MediaRecorder) and **Still** (PNG) from the studio toolbar, labelled as viewport quality |
| "Most buttons and features don't work" | Several controls called no-op handlers (`applyOps([])`) or nothing at all | Render engine, fps, resolution, duration, samples, denoise, motion blur, environment fields, sky/fog, character staging, scene restore and settings toggles now act and are recorded in history |
| "The web is complex" | Ten flat nav items, advanced panels always visible | Navigation grouped (Create / Produce / Account), beginner mode hides gizmos and the history tab, first-run guide explains three entry points |
| Director "Send to studio" did nothing | The studio never consumed the hand-off | The studio reads the stored plan on mount and builds the scene |

New tests this pass: 15 in `scene-core` (sampling + builder) and 7 in `apps/web`
(scene lifecycle, settings, keyframes). Totals: **46 scene-core, 17 editor, 15
web, 35 API, 16 orchestrator, 7 render-worker — 136 automated tests**.

## Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| TypeScript types (5 workspaces) | `npm run typecheck` | clean |
| Scene core + editor tests | `npm test` | 31 + 17 passing |
| Studio store tests | `npx vitest run` in `apps/web` | 8 passing |
| Production build | `npm run build` | 17 routes prerendered, exit 0 |
| Web lint | `npm run lint -w @ai3d/web` | no warnings or errors |
| API lint | `ruff check app tests` | all checks passed |
| API tests | `python -m pytest -q` in `services/api` | 35 passing |
| Orchestrator tests | `python -m pytest -q` in `services/ai-orchestrator` | 14 passing |
| Render-worker tests | `python -m pytest -q` in `services/render-worker` | 7 passing |
| SQL migrations | `sqlglot` parse of every `.sql` | parses; **not executed against Postgres here** |

Total automated tests: **112**.

## What was executed

* The Next.js application builds and prerenders every route, including the
  studio shell (the viewport is a client component).
* The scene graph, planner, validator, history and selection engines run in
  Node and the browser bundle from the same source.
* The FastAPI service runs in-process against the memory repository; every
  endpoint in `docs/api/rest.md` is exercised by a test except the SSE stream
  (streamed responses are not covered by the test client) and the Postgres
  repository (needs a database).
* The Blender scene builder's pure layer (`build_plan`) is tested: object
  mapping, id naming, parenting, camera/light settings, colour conversion,
  animation export, and honest warnings for assets it cannot build.

## What was not executed, and why

| Item | Reason | What is in the repo |
| --- | --- | --- |
| Deployment to Vercel / Supabase / container host | no credentials, and no external account was touched | `docs/deployment/vercel-supabase.md` with verification and rollback |
| Blender renders | Blender is not installed in this environment | `render_worker/blender_job.py`, `Dockerfile.render-worker`, 7 tests on the pure layer |
| Postgres migrations | no database available | `database/migrations/*.sql`, CI job that applies them and asserts RLS |
| Model inference (text-to-3D, motion, TTS, video) | no licensed model configured; no weights bundled | adapter interface + registry; unconfigured adapters fail with the missing variable named |
| SAM 2.1 segmentation | same | adapter + worker that reports the capability as unavailable |
| GitHub push | no repository authorisation in this session | local git repository with an initial commit; push instructions in the deployment runbook |

## Pinned versions (and why)

| Package | Version | Note |
| --- | --- | --- |
| next | 14.2.35 | 14.2.15 is flagged by npm for a security advisory; 14.2.35 is the patched 14.x |
| react / react-dom | 18.3.1 | R3F 8 requires React 18; moving to React 19 means R3F 9 |
| three / fiber / drei | 0.169 / 8.17 / 9.114 | compatible triple, verified by build |
| Blender | 5.2 LTS | 5.3 became stable 2026-11-10; LTS is the production pin |
| Python | 3.12 | matches the container images |

Upgrading the React/three stack is a deliberate, testable change — not a
dependency bump to take casually.

## Repository shape

```
apps/web                 Next.js application (17 routes)
packages/scene-core      scene document + schema + migrations + planner + director
packages/editor          operations, plan application, history, selection
packages/ui              design system
packages/shared-types    API contract types
services/api             FastAPI service (35 tests)
services/ai-orchestrator planner, director, adapters, registry (14 tests)
services/render-worker   Blender builder + queue worker (7 tests)
services/generation-worker / segmentation-worker
database/                schema, RLS, indexes, seeds
docs/                    architecture, api, setup, deployment, development
infrastructure/          docker images, vercel.json, render.yaml
.github/                 CI, security scanning, deploy workflows, templates
```

## Known gaps, stated plainly

1. **Character casting is manual.** A Director plan names roles; resolving them
   to rigged library characters needs the character service.
2. **Asset and procedural geometry render as proxies.** The document is right;
   the mesh pipeline is not wired to the asset cache yet.
3. **Pose clips are not baked in Blender** without an armature; the builder
   reports this in `warnings` rather than silently dropping it.
4. **Rate limiting is per process**, correct for one API instance only.
5. **Collaboration is not real-time** — optimistic concurrency with 409s.
6. **No billing enforcement**; usage is recorded, limits are displayed.
7. **SSE progress** is implemented but not covered by an automated test.

## First five things the owner should do

1. `npm install && npm run dev`, open `/studio`, try three edits, undo each.
2. Create the GitHub repo and push (`docs/deployment/vercel-supabase.md` §1).
3. Create the Supabase project, run the four SQL files, run the RLS checks.
4. Deploy the API container and the web app; run the §6 verification commands.
5. Decide the first model to license, and record the decision through the
   nine-step gate in `docs/development/improvement-policy.md`.
