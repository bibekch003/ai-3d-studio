# Seeds

| File | Purpose | Safe to re-run |
| --- | --- | --- |
| `model_registry.sql` | Reference data for every candidate model, with licence status. | Yes (`on conflict do update`) |

Demo content is **not** seeded into production: `POST /api/v1/projects` creates a
starter scene from `services/api/app/scene_fixtures.py`, which keeps the demo
document versioned with the code instead of drifting in SQL.
