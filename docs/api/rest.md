# REST API

Base: `/api/v1`. Interactive docs: `/docs` (Swagger) and `/redoc` from the
running service; the OpenAPI document is at `/openapi.json`.

## Authentication

`Authorization: Bearer <supabase-jwt>` — verified against the project JWKS
(`SUPABASE_JWKS_URL`, RS256) or a shared secret (`SUPABASE_JWT_SECRET`, HS256).
`sub` is the user id; every query is scoped to it.

Local development may run with `ALLOW_DEV_AUTH=true`, which mints a fixed
development principal. That path is refused when `ENVIRONMENT=production`.

Worker callbacks use a separate credential: `X-Service-Token` matched against
`SERVICE_TOKEN`. It grants exactly one operation (`POST /jobs/{id}/progress`).

## Error envelope

```json
{ "error": { "code": "plan.target_locked", "message": "\"Red apple\" is locked", "details": [] } }
```

Codes are stable and machine-readable: `validation_failed`, `unauthorized`,
`invalid_token`, `forbidden`, `not_found`, `project_not_found`,
`scene_not_found`, `revision_conflict`, `scene_invalid`, `operation_failed`,
`plan_invalid`, `plan.target_locked`, `job_not_cancellable`, `job_cancelled`,
`rate_limited`, `internal_error`.

## Endpoints

### System
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | liveness |
| GET | `/readyz` | repository + auth mode |
| GET | `/metrics` | Prometheus text, no per-user labels |

### Auth
| GET | `/auth/me` | current principal |

### Projects
| GET | `/projects` | projects the caller is a member of |
| POST | `/projects` | creates project **and** a starter scene |
| GET | `/projects/{id}` | |
| PATCH | `/projects/{id}` | rename / re-describe |
| DELETE | `/projects/{id}` | cascades scenes, versions, jobs |

### Scenes
| GET | `/scenes/{id}` | full document |
| PUT | `/scenes/{id}` | `{scene, expected_revision}` → 409 on conflict |
| POST | `/scenes/{id}/objects:apply` | `{operations[], label}` direct edits |
| GET | `/scenes/{id}/versions` | newest first |
| POST | `/scenes/{id}/versions/{vid}:restore` | restores as a new revision |

### AI
| POST | `/ai/edit/plan` | `{scene_id, prompt, preserve[], scope[]}` → plan + validation |
| POST | `/ai/edit/apply` | `{scene_id, plan}` → new scene, touched ids, audit |
| POST | `/ai/director/plan` | `{prompt, fps, seconds}` → cast, beats, shots, operations |
| POST | `/ai/select` | `{scene_id, query}` → ranked object ids |
| GET | `/ai/adapters` | configured/unconfigured model adapters + licence notes |

### Jobs
| POST | `/render/jobs` | 202 + job |
| POST | `/export/blend` | 202 + job |
| GET | `/jobs` | caller's jobs |
| GET | `/jobs/{id}` | |
| POST | `/jobs/{id}/cancel` | 409 if already terminal |
| POST | `/jobs/{id}/progress` | worker only (service token) |
| GET | `/jobs/{id}/events` | SSE progress stream |

### Meta
| GET | `/models` | model registry with licence status |
| GET | `/usage/summary` | usage vs plan limits |
| GET | `/assets` | assets (empty until storage is configured) |

## Conventions

* Timestamps are ISO 8601 with UTC offset.
* Ids are opaque strings; scene object ids are stable and appear in URLs only
  inside request bodies.
* Mutating AI endpoints are rate limited per principal (a third of the global
  limit by default) and return `429` with `Retry-After` semantics described in
  the message.
* Pagination is not needed yet: projects and jobs are bounded per user. When it
  is, it will be cursor-based (`?cursor=…&limit=…`) rather than offset.
