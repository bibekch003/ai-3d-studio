## What changed

<!-- one paragraph, plain language -->

## Why

<!-- the user problem, not the implementation -->

## Checks

- [ ] `npm run typecheck && npm test && npm run build`
- [ ] `python -m pytest` in every touched service
- [ ] Schema change? bumped `SCENE_SCHEMA_VERSION`, added a migration + test
- [ ] New operation? added to TS *and* Python apply paths, with tests
- [ ] No secrets, no customer data, no fabricated model output
- [ ] Docs updated
