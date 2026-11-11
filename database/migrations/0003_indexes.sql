-- =============================================================================
-- Indexes for the access patterns the application actually uses.
-- =============================================================================

create extension if not exists pg_trgm;

create index if not exists projects_owner_updated_idx on public.projects (owner_id, updated_at desc) where deleted_at is null;
create index if not exists project_members_user_idx on public.project_members (user_id);

create index if not exists scenes_project_updated_idx on public.scenes (project_id, updated_at desc);
create index if not exists scenes_document_gin_idx on public.scenes using gin (document jsonb_path_ops);

create index if not exists scene_objects_scene_type_idx on public.scene_objects (scene_id, type);
create index if not exists scene_objects_parent_idx on public.scene_objects (scene_id, parent_id);
create index if not exists scene_objects_name_trgm_idx on public.scene_objects using gin (name gin_trgm_ops);

create index if not exists scene_versions_scene_idx on public.scene_versions (scene_id, revision desc);

create index if not exists assets_project_idx on public.assets (project_id, created_at desc);
create index if not exists assets_owner_idx on public.assets (owner_id);
create index if not exists assets_kind_idx on public.assets (kind);

create index if not exists animations_scene_idx on public.animations (scene_id);
create index if not exists animations_target_idx on public.animations (scene_id, target_id);
create index if not exists animation_tracks_animation_idx on public.animation_tracks (animation_id);
create index if not exists keyframes_track_frame_idx on public.keyframes (track_id, frame);

create index if not exists generation_jobs_project_idx on public.generation_jobs (project_id, created_at desc);
create index if not exists generation_jobs_status_idx on public.generation_jobs (status) where status in ('queued', 'running');
create index if not exists render_jobs_project_idx on public.render_jobs (project_id, created_at desc);
create index if not exists render_jobs_status_idx on public.render_jobs (status) where status in ('queued', 'running');

create index if not exists edit_operations_scene_idx on public.edit_operations (scene_id, applied_at desc);
create index if not exists edit_operations_plan_idx on public.edit_operations (plan_id);

create index if not exists usage_records_user_period_idx on public.usage_records (user_id, period_start desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id);
