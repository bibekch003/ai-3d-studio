# GitHub Pages — static demo deployment

## What this deploys, precisely

A **fully static build of the web app**: landing page, projects, dashboard,
character studio, assets, animation, rendering UI, library, settings, and the
full 3D studio (viewport, click-to-edit, AI edit panel, timeline, history).

Because there is no API on Pages, the app runs in its **demo workspace** mode:
the scene comes from `@ai3d/scene-core`'s bundled demo, edits are planned by the
local deterministic rule engine, and nothing is persisted across reloads. The UI
already labels this state ("demo workspace", "local rule engine"); no feature
pretends to work.

Not available on Pages, by design:

| Capability | Why |
| --- | --- |
| Saving to an account, projects, versions | needs the FastAPI service + Postgres (the demo can save to this browser instead) |
| Blender renders, `.blend` export | needs the render worker (the demo records a WebM preview from the viewport instead) |
| Model inference (text-to-3D, motion, TTS) | needs GPU workers |
| Sign-in | needs Supabase Auth |

Use Pages for a reviewable demo; use `vercel-supabase.md` for the real stack.

> **Current status:** deployed. The site is built and published from `main` by
> `.github/workflows/deploy-pages.yml`; the first successful run was #17.

## One-time setup

1. Push the repository to GitHub (default branch `main`).
2. **Settings → Pages → Source: GitHub Actions.**
3. Push to `main` (or run *Actions → Deploy static demo → Run workflow*).
4. The site appears at `https://<owner>.github.io/<repo>/`.

`deploy-pages.yml` builds with:

```bash
NEXT_STATIC_EXPORT=true \
NEXT_PUBLIC_BASE_PATH="/<repo>" \
npm run build -w @ai3d/web      # → apps/web/out
```

`basePath` matters: project Pages are served from a subdirectory, so assets and
links need the prefix. If you rename the repository, the workflow derives the
prefix from `github.event.repository.name` automatically.

## Local check before pushing

```bash
cd apps/web
NEXT_STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/ai-3d-studio npm run build
python3 -m http.server 4173 --directory out
# open http://localhost:4173/ai-3d-studio/
```

## Known limitations of the static build

* Deep links work because `trailingSlash: true` emits `studio/index.html`.
* There is no 404 rewrite; an unknown path shows GitHub's 404 page.
* The bundle is ~150 kB first-load plus the three.js chunk (~1 MB) — acceptable
  for a demo, which is why the studio route is the only heavy one.
