-- Model registry seed. Licence facts verified against primary sources on
-- 2026-11-11. Re-verify before enabling a model for commercial work.
-- "restricted" means: usable only under conditions (territory, MAU caps, or
-- separately licensed dependencies). Never treat open weights as unrestricted.

insert into public.model_registry (id, name, family, task, licence, commercial_use, hardware, status, notes, docs_url)
values
  ('planner.deterministic', 'Built-in rule planner', 'planner', 'instruction-to-edit-plan',
   'MIT (this repository)', 'allowed', 'CPU, no weights', 'available',
   'Deterministic rule engine; labelled as such in every plan it produces.', null),
  ('blender', 'Blender', 'engine', 'scene-build-and-render',
   'GPL-2.0-or-later (application); outputs belong to the author', 'allowed',
   'CPU; GPU optional for Cycles', 'available',
   'Headless via bpy. Blender 5.3 shipped 2026-11-10; production pins 5.2 LTS.',
   'https://www.blender.org/releases/'),
  ('sam2', 'SAM 2.1', 'segmentation', 'promptable-image-and-video-segmentation',
   'Apache-2.0 (code and checkpoints)', 'allowed', 'CUDA GPU, 8-16 GB VRAM', 'adapter_only',
   'Used only for imported images and video. Native 3D scenes select by object id.',
   'https://github.com/facebookresearch/sam2'),
  ('hunyuan3d-2.1', 'Hunyuan3D 2.1', 'image-to-3D', 'text-and-image-to-3D-asset',
   'Tencent Hunyuan 3D 2.1 Community License', 'restricted', 'CUDA GPU, 24 GB+ VRAM', 'adapter_only',
   'Territory excludes EU, UK and South Korea; >1M MAU needs written Tencent approval; output may not be used to improve other models.',
   'https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1'),
  ('trellis2', 'TRELLIS.2', 'image-to-3D', 'image-to-3D-asset-with-PBR',
   'MIT (model and code); nvdiffrast / nvdiffrec carry their own terms', 'restricted',
   'CUDA GPU, 16-24 GB VRAM', 'adapter_only',
   'Audit the mesh-extraction path: rendering dependencies are licensed separately from the model.',
   'https://github.com/microsoft/TRELLIS.2'),
  ('motion.reserved', 'Motion model (reserved)', 'motion', 'text-to-motion',
   'Not selected', 'unknown', 'TBD', 'disabled',
   'Adapter interface reserved; placeholder clips are procedural and labelled.', null),
  ('speech.reserved', 'Speech / lip-sync (reserved)', 'speech', 'tts-and-viseme-alignment',
   'Not selected', 'unknown', 'TBD', 'disabled',
   'Voice cloning disabled by default; consent records required per voice.', null)
on conflict (id) do update
set name = excluded.name,
    family = excluded.family,
    task = excluded.task,
    licence = excluded.licence,
    commercial_use = excluded.commercial_use,
    hardware = excluded.hardware,
    status = excluded.status,
    notes = excluded.notes,
    docs_url = excluded.docs_url,
    updated_at = now();
