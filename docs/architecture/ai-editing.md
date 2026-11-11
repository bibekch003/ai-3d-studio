# AI editing pipeline

## Contract

```ts
interface EditPlan {
  id: string;
  prompt: string;
  summary: string;
  targets: PlanTarget[];          // resolved object ids, with reasons
  operations: EditOperation[];    // structured, enumerable, validated
  preserve: { properties: string[]; object_ids: string[] };
  confidence: number;             // 0..1, drives the confirmation gate
  warnings: string[];
  requires_confirmation: boolean;
  producer: { kind: "deterministic" | "llm" | "human"; model_id: string | null };
  estimated_cost_usd: number;
}
```

Operations are a closed set (`set_transform`, `set_material`, `set_character`,
`set_camera`, `set_light`, `set_environment`, `set_global_style`,
`replace_geometry`, `add_object`, `remove_object`, `reparent`, `add_animation`,
`add_keyframe`, `set_shot`, `set_visibility`, `set_locked`, `rename`,
`set_geometry_param`). There is no `eval`, no generated Python, no arbitrary
script field. If a capability needs a new operation, it gets a schema, a
validator rule, an apply branch and tests.

## The five gates

1. **Resolution** — every target is an existing object id. No id, no edit.
2. **Type fitness** — `set_camera` on a `prop` is rejected.
3. **Locks** — `locked` objects reject the plan; `protected` objects warn and
   require an explicit override.
4. **Preservation** — the plan cannot promise to keep something it changes.
   Character edits are checked per attribute, so "change his hairstyle but
   preserve his face" is legal while "change his hair, preserve identity" is not.
5. **Atomicity** — `applyPlan()` applies to a copy; one failure returns the
   original document untouched.

## Preservation semantics

| Preserved | Blocks |
| --- | --- |
| `face` | expression / facial blendshape edits |
| `hair` | hairstyle and hair colour edits |
| `identity` | any appearance edit on a character |
| `materials` | `set_material` |
| `transform` | `set_transform` |
| `camera` | `set_camera` |
| `lighting` | `set_light` |
| `environment` | `set_environment` |
| `hierarchy` | `reparent` |
| `animation` | `add_animation`, `add_keyframe` |

## Deterministic vs model planners

The default planner is a rule engine (`packages/scene-core/src/planner.ts`,
mirrored in `services/ai-orchestrator/ai_orchestrator/planner.py`). It is
labelled `producer.kind = "deterministic"` in the API response and in the UI —
it is not an LLM and is never described as one.

A model planner is allowed behind the same contract: it must return an
`EditPlan`, it must resolve real ids (it may call `POST /ai/select` to do so),
and it still passes all five gates. `PLANNER_PROVIDER` selects it; when it is
unset the deterministic planner runs.

### Parity

The TypeScript and Python planners are intentionally mirrored. Keep them in
step by changing both when a rule changes; the shared behaviour is pinned by
tests on both sides (`packages/scene-core/tests/planner.test.ts`,
`services/ai-orchestrator/tests/test_planner.py`). The server planner is
authoritative — the browser copy exists so the studio still works with no
backend, and the UI says "local rule engine" when it is used.

## Director

`planScene(prompt)` returns cast, props, environment, beats and shots plus the
operations to build the set. Characters are **named roles to be cast**, not
generated bodies: the plan lists them, the character service resolves them.
Shots are ordinary `Shot` objects, editable in the UI before anything is
applied.

## Cost and rate control

Plans are cheap; inference is not. `POST /ai/edit/plan` and
`POST /ai/director/plan` are rate limited per principal, `estimated_cost_usd` is
carried on the plan, and generation work is queued so a burst cannot exhaust a
GPU worker synchronously.
