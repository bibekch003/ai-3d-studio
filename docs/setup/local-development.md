# Local development

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node | ≥ 20 (tested 20.20) | Next.js 14.2 |
| Python | ≥ 3.11 (tested 3.12) | API, workers, orchestrator |
| Docker | optional | Postgres + Redis, or run `memory://` |
| Blender | 5.2 LTS recommended | only for renders/exports |

## 1. Web app

```bash
npm install
cp .env.example .env.local        # set NEXT_PUBLIC_API_BASE_URL if you run the API
npm run dev                       # http://localhost:3000
```

The studio works with **no backend**: it loads the bundled demo scene from
`@ai3d/scene-core` and plans edits with the local rule engine. The UI labels
this state ("demo workspace", "local rule engine") rather than pretending.

## 2. API

```bash
cd services/api
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
DATABASE_URL=memory:// uvicorn app.main:app --reload --port 8000
```

`memory://` keeps projects and scenes in process memory — perfect for a demo,
lost on restart. For Postgres:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai3dstudio"
export SERVICE_TOKEN="dev-service-token"
pip install -e ".[postgres]"
psql "$DATABASE_URL" -f ../../database/migrations/0001_init.sql
psql "$DATABASE_URL" -f ../../database/migrations/0002_rls.sql
psql "$DATABASE_URL" -f ../../database/migrations/0003_indexes.sql
psql "$DATABASE_URL" -f ../../database/seeds/model_registry.sql
```

Then point the web app at it:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
```

## 3. Workers

```bash
# renders (needs Blender on PATH)
cd services/render-worker
pip install -e .
BLENDER_BIN=/usr/bin/blender SERVICE_TOKEN=dev-service-token python -m render_worker.worker

# generation (needs an adapter endpoint; otherwise jobs fail honestly)
cd services/generation-worker && pip install -e . && SERVICE_TOKEN=dev-service-token python -m generation_worker.worker
```

## 4. Tests

```bash
npm test                       # scene-core + editor (48 tests)
npm run typecheck              # all workspaces
npm run build                  # Next.js production build

cd services/api && python -m pytest -q                 # 32 tests
cd services/ai-orchestrator && python -m pytest -q     # 14 tests
cd services/render-worker && python -m pytest -q       # 7 tests
```

## 5. Common problems

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Can't resolve './types.js'` | workspace TS consumed without extension aliasing | keep `resolve.extensionAlias` in `next.config.mjs` |
| Studio shows "demo workspace" | `NEXT_PUBLIC_API_BASE_URL` unset | set it and restart the dev server |
| `401 missing_token` | `ALLOW_DEV_AUTH=false` | send a Supabase JWT or enable dev auth locally |
| Render job stuck `queued` | no worker consuming Redis | start `render_worker.worker` |
| `4K (needs GPU worker)` disabled | `NEXT_PUBLIC_ENABLE_GPU_JOBS=false` | enable only with a GPU host provisioned |
