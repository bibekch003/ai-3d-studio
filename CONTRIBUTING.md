# Contributing

See [`docs/development/contributing.md`](docs/development/contributing.md) for
branching, the definition of done, code layout rules and the review checklist.

Quick version:

```bash
npm run typecheck && npm test && npm run build
cd services/api && ruff check app tests && python -m pytest -q
```

Never commit secrets, customer scene documents, or fabricated model output.
