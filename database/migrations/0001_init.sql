-- =============================================================================
-- AI 3D Studio — initial schema
--
-- Design notes
--  * scenes.document is the authoritative scene graph (JSONB, versioned).
--  * scene_objects / cameras / lights / animations are a *projection* of that
--    document, maintained by the API, so the database can answer queries
--    (search, counts, integrity reports) without parsing every document.
--  * Supabase owns auth.users; everything user-facing references it.
--  * Row Level Security is enabled in 0002_rls.sql. Nothing here is readable
--    without a policy.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles ---
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Studio user' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  workspace_mode text not null default 'professional' check (workspace_mode in ('beginner', 'professional')),
  locale text not null default 'en-IN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects ---
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  fps integer not null default 24 check (fps in (24, 25, 30, 60)),
  default_resolution text not null default '1920x1080',
  cover_asset_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ------------------------------------------------------------------ scenes ---
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  revision integer not null default 0 check (revision >= 0),
  schema_version text not null default '1.1',
  document jsonb not null,
  thumbnail_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scenes_document_is_object check (jsonb_typeof(document) = 'object')
);

-- Projection of the scene graph for querying. Kept in sync by the API inside
-- the same transaction that writes scenes.document.
create table if not exists public.scene_objects (
  scene_id uuid not null references public.scenes (id) on delete cascade,
  id text not null,
  parent_id text,
  name text not null,
  type text not null check (type in (
    'character', 'body_part', 'prop', 'furniture', 'plant', 'vehicle',
    'building', 'environment', 'camera', 'light', 'audio', 'particles', 'group'
  )),
  transform jsonb not null default '{}'::jsonb,
  geometry jsonb not null default '{}'::jsonb,
  material_id text,
  visible boolean not null default true,
  locked boolean not null default false,
  protected boolean not null default false,
  version integer not null default 1 check (version >= 1),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (scene_id, id)
);

create table if not exists public.scene_versions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  revision integer not null,
  label text not null default '',
  document jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (scene_id, revision)
);

-- ------------------------------------------------------------------ assets ---
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('model', 'texture', 'hdri', 'audio', 'video', 'image')),
  name text not null check (char_length(name) between 2 and 120),
  format text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null unique,
  preview_url text,
  licence text not null check (char_length(licence) >= 1),
  source text not null default 'upload' check (source in ('upload', 'library', 'generated')),
  created_at timestamptz not null default now()
);

create table if not exists public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  version integer not null check (version >= 1),
  storage_path text not null,
  checksum text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

-- --------------------------------------------------------------- materials ---
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  name text not null,
  base_color text not null default '#808080' check (base_color ~ '^#[0-9a-fA-F]{6}$'),
  roughness numeric(4, 3) not null default 0.5 check (roughness >= 0 and roughness <= 1),
  metallic numeric(4, 3) not null default 0 check (metallic >= 0 and metallic <= 1),
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- animation ---
create table if not exists public.animations (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  name text not null,
  target_id text not null,
  kind text not null check (kind in ('transform', 'pose', 'shape_key', 'material', 'camera', 'visibility', 'audio')),
  start_frame integer not null check (start_frame >= 0),
  end_frame integer not null,
  loop boolean not null default false,
  source jsonb not null default '{"kind":"manual","model_id":null}'::jsonb,
  created_at timestamptz not null default now(),
  constraint animations_range_valid check (end_frame > start_frame)
);

create table if not exists public.animation_tracks (
  id uuid primary key default gen_random_uuid(),
  animation_id uuid not null references public.animations (id) on delete cascade,
  channel text not null,
  ordinal integer not null default 0
);

create table if not exists public.keyframes (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.animation_tracks (id) on delete cascade,
  frame integer not null check (frame >= 0),
  value jsonb not null,
  interpolation text not null default 'bezier' check (interpolation in ('linear', 'bezier', 'step')),
  unique (track_id, frame)
);

create table if not exists public.cameras (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  object_id text not null,
  focal_length_mm numeric(6, 2) not null default 35 check (focal_length_mm >= 4),
  fstop numeric(4, 2) not null default 2.8 check (fstop >= 0.7),
  focus_distance_m numeric(8, 3) not null default 3.0,
  dof_enabled boolean not null default false,
  shot_type text not null default 'medium',
  movement text not null default 'static',
  unique (scene_id, object_id)
);

create table if not exists public.lights (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  object_id text not null,
  kind text not null check (kind in ('point', 'spot', 'sun', 'area')),
  intensity_watts numeric(12, 3) not null default 100 check (intensity_watts >= 0),
  color text not null default '#ffffff',
  shadows boolean not null default true,
  softness numeric(4, 3) not null default 0.5,
  role text not null default 'key' check (role in ('key', 'fill', 'rim', 'practical', 'ambient')),
  unique (scene_id, object_id)
);

-- ------------------------------------------------------------------- jobs ---
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  task text not null,
  model_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress numeric(4, 3) not null default 0 check (progress >= 0 and progress <= 1),
  message text not null default '',
  request jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  engine text not null default 'eevee' check (engine in ('eevee', 'cycles')),
  resolution text not null default '1920x1080',
  fps integer not null default 24 check (fps in (24, 25, 30, 60)),
  samples integer not null default 64 check (samples >= 1 and samples <= 8192),
  frame_start integer not null default 0,
  frame_end integer not null default 240,
  format text not null default 'mp4' check (format in ('mp4', 'png_sequence', 'exr_sequence', 'blend')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress numeric(4, 3) not null default 0,
  message text not null default '',
  output_url text,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint render_range_valid check (frame_end > frame_start)
);

create table if not exists public.render_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.render_jobs (id) on delete cascade,
  kind text not null default 'video' check (kind in ('video', 'frames', 'blend', 'log')),
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ conversation ---
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every applied AI edit is traceable: prompt, producer, operations, targets.
create table if not exists public.edit_operations (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  plan_id text not null,
  prompt text not null,
  producer text not null check (producer in ('deterministic', 'llm', 'human')),
  model_id text,
  operations jsonb not null,
  touched text[] not null default '{}',
  revision_before integer not null,
  revision_after integer not null,
  user_id uuid references auth.users (id) on delete set null,
  applied_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  sentiment text not null default 'other' check (sentiment in ('bug', 'idea', 'praise', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- model registry ---
create table if not exists public.model_registry (
  id text primary key,
  name text not null,
  family text not null,
  task text not null,
  licence text not null,
  commercial_use text not null check (commercial_use in ('allowed', 'restricted', 'unknown', 'forbidden')),
  hardware text not null default '',
  status text not null default 'disabled' check (status in ('available', 'adapter_only', 'disabled')),
  notes text not null default '',
  docs_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id text not null references public.model_registry (id) on delete cascade,
  version text not null,
  licence_snapshot text not null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (model_id, version)
);

-- ---------------------------------------------------------------- billing ---
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'studio', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled', 'trialing')),
  current_period_end timestamptz,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  ai_edits integer not null default 0 check (ai_edits >= 0),
  render_minutes numeric(10, 2) not null default 0 check (render_minutes >= 0),
  storage_mb integer not null default 0 check (storage_mb >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- triggers ---
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'projects', 'scenes', 'generation_jobs', 'render_jobs',
    'conversations', 'model_registry', 'subscriptions'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()',
      t
    );
  end loop;
end;
$$;
