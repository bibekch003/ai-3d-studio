# Feature flags

Flags are environment variables read at build time (web) or start time (API).
None of them enable a feature whose backing service is missing; they only
*reveal* a capability that is already deployed.

| Flag | Default | Effect when false |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_GPU_JOBS` | `false` | 4K/GPU render presets are labelled and disabled |
| `NEXT_PUBLIC_ENABLE_SEGMENTATION` | `false` | Segmentation panel hidden; SAM adapter unused |
| `ALLOW_DEV_AUTH` | `true` (dev only) | API requires a Supabase JWT; hard-disabled in production |
| `PLANNER_PROVIDER` | `deterministic` | Only the rule planner runs |
| `ADAPTER_*_URL` | empty | The adapter reports "not configured"; jobs fail rather than fake output |

Rules:

1. A flag never changes the scene schema.
2. A flag never hides an error — it disables the affordance.
3. Production must set `ALLOW_DEV_AUTH=false`; the API refuses dev auth in
   production even if the variable says otherwise.
