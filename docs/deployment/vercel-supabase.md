# Deployment runbook — temporary public deployment

> **Status in this repository: not deployed.** No credentials were available and
> no external account was touched. Everything below is the exact procedure for
> the owner to run; nothing here is claimed as already done.

## 0. What you need

| Item | Free tier? | Notes |
| --- | --- | --- |
| GitHub repo | yes | source of truth |
| Vercel account | yes (Hobby) | frontend + preview deploys |
| Supabase project | yes (Free) | Postgres, Auth, Storage |
| Container host for API | Render / Fly.io / Railway free-ish tiers | must run a long-lived process |
| Redis | Upstash free tier | job queue |
| GPU host | **paid** | only for 4K Cycles or model inference |

Limits to plan around: Supabase Free pauses after a week of inactivity and caps
storage at 500 MB; Vercel Hobby forbids commercial use; free container tiers
sleep after idle. None of these are suitable for real customers — they are for
a reviewable demo.

## 1. Create the repository

```bash
git init -b main
git add .
git commit -m "feat: AI 3D Studio scaffold"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/<owner>/ai-3d-studio.git
git push -u origin main
git checkout -b develop && git push -u origin develop
```

Branch model: `main` = production, `develop` = integration, `feat/*` = work.
CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every
PR; deployment workflows only run from `main`.

## 2. Supabase

1. Create a project, copy the **pooled** connection string (port 6543).
2. Run migrations in the SQL editor, in order:
   `0001_init.sql` → `0002_rls.sql` → `0003_indexes.sql` → `seeds/model_registry.sql`.
3. Auth → Providers → Email: enable. Set the site URL to your Vercel domain.
4. Storage → create bucket `project-assets` (private).
5. Copy: project URL, anon key (public), service role key (server only),
   JWKS URL `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.

Verify RLS before inviting anyone:

```sql
-- as an authenticated user, this must return only your projects
select id, name from projects;
-- and this must fail
select * from model_registry where false;
```

## 3. Vercel

1. Import the GitHub repo. Root directory: `apps/web`.
2. Framework preset: Next.js. Build command `npm run build`, install
   `npm install` (workspaces resolve from the repo root automatically).
3. Environment variables (Production + Preview):
   `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PRODUCT_NAME`,
   `NEXT_PUBLIC_ENABLE_GPU_JOBS=false`.
4. Deploy. Preview deployments are created per branch automatically.

## 4. API host

Dockerfile: `infrastructure/docker/Dockerfile.api`. Command:
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Environment: `ENVIRONMENT=production`, `ALLOW_DEV_AUTH=false`,
`DATABASE_URL` (pooled), `SUPABASE_JWKS_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`REDIS_URL`, `SERVICE_TOKEN` (random 32+ bytes), `CORS_ORIGINS=https://<vercel-domain>`.

Health check path: `/healthz`. Start command must not be serverless.

## 5. Workers

Render worker image: `infrastructure/docker/Dockerfile.render-worker` (installs
Blender 5.2 LTS). Run one instance; set `BLENDER_BIN`, `REDIS_URL`,
`API_BASE_URL`, `SERVICE_TOKEN`. It needs a persistent volume for
`RENDER_WORK_DIR` or an upload step to Supabase Storage.

## 6. Verify the live deployment

```bash
curl -s https://<api-host>/healthz            # {"status":"ok"}
curl -s https://<api-host>/readyz             # repository: postgres, dev_auth: false
curl -s -o /dev/null -w "%{http_code}" https://<vercel-domain>/studio   # 200
```

Then in the browser: open `/studio`, click the apple, apply
"Make the table look like old oak wood.", confirm the table material changes,
press Ctrl+Z, confirm it reverts, and check `/api/v1/jobs` returns your job.

## 7. Rollback

| Failure | Rollback |
| --- | --- |
| Bad frontend deploy | Vercel → Deployments → previous → **Promote to Production** |
| Bad API deploy | redeploy the previous image tag (`git revert` + push, or host UI) |
| Bad migration | migrations are additive; restore from Supabase PITR or apply a compensating migration. Never edit an applied migration |
| Bad model enablement | flip the model back to `disabled` in `model_registry` and unset `ADAPTER_*_URL`; workers then fail closed |

## 8. What must not be committed

`SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_TOKEN`, `PLANNER_API_KEY`, database URLs,
`.env*` files (except `.env.example`), any customer scene document. `gitleaks`
runs in CI; the build fails on a detected secret.
