# Controlled continuous improvement

The platform is designed to absorb new models and engine releases **without**
letting untrusted code or unlicensed weights reach customers. This is the only
sanctioned path for adopting something new.

## What is monitored

| Area | Watch | Cadence |
| --- | --- | --- |
| Blender | release notes, LTS dates, EEVEE/Cycles API changes | monthly + on release |
| Segmentation | SAM-family releases, licence deltas | quarterly |
| 3D generation | Hunyuan3D, TRELLIS and successors | quarterly |
| Motion / lip-sync | model releases, dataset provenance | quarterly |
| Rendering | GPU driver/CUDA compatibility | on upgrade |
| Licences | any change to a model already enabled | immediately |

## The nine-step gate

1. **Identify** — name, version, task, source URL, checksum.
2. **Licence check** — read the actual licence file, not the README. Record
   territory limits, MAU caps, output restrictions, dependency licences.
3. **Compatibility** — hardware, VRAM, CUDA, Python/Blender versions, output
   format (must land in glTF/GLB or our scene document).
4. **Isolated test** — a scratch container with no customer data, a fixed prompt
   set, and a measured runtime.
5. **Benchmark** — compare against the incumbent on the same prompts: quality
   score, latency, VRAM, failure rate.
6. **Cost** — per-asset and per-minute cost at expected volume.
7. **Recommendation** — written, with the benchmark table attached.
8. **Human approval** — recorded in `model_versions.approved_by`.
9. **Rollback** — the model stays behind `ADAPTER_*_URL`; unsetting the
   variable returns the system to "not configured" instantly.

## Hard rules

* Never execute model-provided code in the API process.
* Never train or fine-tune on customer projects without per-project, revocable,
  logged consent.
* Never deploy an untested model to production; `status` moves
  `disabled → adapter_only → available` and only a human moves it to `available`.
* Never mark a model `allowed` because the weights are downloadable. Open
  weights are not a licence.
* Any licence change on an enabled model is an incident: disable first, review
  second.

## Current state

`database/seeds/model_registry.sql` and
`services/ai-orchestrator/ai_orchestrator/registry.py` hold the same records.
Facts verified 2026-11-11:

* **SAM 2.1** — Apache-2.0 for code, checkpoints and demo.
* **Hunyuan3D 2.1** — Tencent Hunyuan 3D 2.1 Community License: excludes the EU,
  UK and South Korea; written approval required above 1M MAU; output may not be
  used to improve other models.
* **TRELLIS.2** — MIT for model and code, but rendering dependencies
  (nvdiffrast / nvdiffrec) carry their own terms; the mesh-extraction path must
  be audited before commercial use.
* **Blender** — 5.3 became stable on 2026-11-10; 5.2 LTS (supported to July
  2028) is the production pin. Re-test EEVEE engine ids on upgrade.
