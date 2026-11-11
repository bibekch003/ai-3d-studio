-- =============================================================================
-- Row Level Security
--
-- Principle: the browser holds the anon key and a user JWT. Every table is
-- deny-by-default; access is granted only through the policies below, which
-- resolve membership with SECURITY DEFINER helpers (to avoid recursive policy
-- evaluation on project_members itself).
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_objects enable row level security;
alter table public.scene_versions enable row level security;
alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.materials enable row level security;
alter table public.animations enable row level security;
alter table public.animation_tracks enable row level security;
alter table public.keyframes enable row level security;
alter table public.cameras enable row level security;
alter table public.lights enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generation_outputs enable row level security;
alter table public.render_jobs enable row level security;
alter table public.render_outputs enable row level security;
alter table public.conversations enable row level security;
alter table public.edit_operations enable row level security;
alter table public.feedback enable row level security;
alter table public.model_registry enable row level security;
alter table public.model_versions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.audit_logs enable row level security;

-- ------------------------------------------------------------- helpers ------
create or replace function public.is_project_member(p_project uuid, p_min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project
      and m.user_id = auth.uid()
      and case p_min_role
            when 'owner' then m.role = 'owner'
            when 'editor' then m.role in ('owner', 'editor')
            else true
          end
  );
$$;

create or replace function public.scene_project(p_scene uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select project_id from public.scenes where id = p_scene;
$$;

revoke all on function public.is_project_member(uuid, text) from public;
revoke all on function public.scene_project(uuid) from public;
grant execute on function public.is_project_member(uuid, text) to authenticated;
grant execute on function public.scene_project(uuid) to authenticated;

-- ------------------------------------------------------------ profiles ------
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ------------------------------------------------------------ projects ------
create policy projects_select_member on public.projects
  for select to authenticated
  using (deleted_at is null and public.is_project_member(id));
create policy projects_insert_owner on public.projects
  for insert to authenticated with check (owner_id = auth.uid());
create policy projects_update_owner on public.projects
  for update to authenticated
  using (public.is_project_member(id, 'owner'))
  with check (owner_id = auth.uid());
create policy projects_delete_owner on public.projects
  for delete to authenticated using (public.is_project_member(id, 'owner'));

create policy members_select_member on public.project_members
  for select to authenticated using (public.is_project_member(project_id));
create policy members_insert_owner on public.project_members
  for insert to authenticated with check (public.is_project_member(project_id, 'owner'));
create policy members_delete_owner on public.project_members
  for delete to authenticated using (public.is_project_member(project_id, 'owner'));

-- -------------------------------------------------------------- scenes ------
create policy scenes_select_member on public.scenes
  for select to authenticated using (public.is_project_member(project_id));
create policy scenes_insert_editor on public.scenes
  for insert to authenticated with check (public.is_project_member(project_id, 'editor'));
create policy scenes_update_editor on public.scenes
  for update to authenticated
  using (public.is_project_member(project_id, 'editor'))
  with check (public.is_project_member(project_id, 'editor'));
create policy scenes_delete_owner on public.scenes
  for delete to authenticated using (public.is_project_member(project_id, 'owner'));

create policy scene_objects_select on public.scene_objects
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy scene_objects_write on public.scene_objects
  for all to authenticated
  using (public.is_project_member(public.scene_project(scene_id), 'editor'))
  with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

create policy scene_versions_select on public.scene_versions
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy scene_versions_insert on public.scene_versions
  for insert to authenticated with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

-- -------------------------------------------------------------- assets ------
create policy assets_select on public.assets
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
    or project_id is null  -- shared library assets
  );
create policy assets_write_own on public.assets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (project_id is null or public.is_project_member(project_id, 'editor')));

create policy asset_versions_select on public.asset_versions
  for select to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id));

-- ----------------------------------------------------------- materials ------
create policy materials_select on public.materials
  for select to authenticated
  using (project_id is null or public.is_project_member(project_id));
create policy materials_write on public.materials
  for all to authenticated
  using (project_id is not null and public.is_project_member(project_id, 'editor'))
  with check (project_id is not null and public.is_project_member(project_id, 'editor'));

-- ----------------------------------------------------------- animation ------
create policy animations_select on public.animations
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy animations_write on public.animations
  for all to authenticated
  using (public.is_project_member(public.scene_project(scene_id), 'editor'))
  with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

create policy animation_tracks_select on public.animation_tracks
  for select to authenticated
  using (exists (
    select 1 from public.animations a
    where a.id = animation_id and public.is_project_member(public.scene_project(a.scene_id))
  ));
create policy animation_tracks_write on public.animation_tracks
  for all to authenticated
  using (exists (
    select 1 from public.animations a
    where a.id = animation_id and public.is_project_member(public.scene_project(a.scene_id), 'editor')
  ))
  with check (exists (
    select 1 from public.animations a
    where a.id = animation_id and public.is_project_member(public.scene_project(a.scene_id), 'editor')
  ));

create policy keyframes_select on public.keyframes
  for select to authenticated
  using (exists (
    select 1 from public.animation_tracks t
    join public.animations a on a.id = t.animation_id
    where t.id = track_id and public.is_project_member(public.scene_project(a.scene_id))
  ));
create policy keyframes_write on public.keyframes
  for all to authenticated
  using (exists (
    select 1 from public.animation_tracks t
    join public.animations a on a.id = t.animation_id
    where t.id = track_id and public.is_project_member(public.scene_project(a.scene_id), 'editor')
  ))
  with check (exists (
    select 1 from public.animation_tracks t
    join public.animations a on a.id = t.animation_id
    where t.id = track_id and public.is_project_member(public.scene_project(a.scene_id), 'editor')
  ));

-- --------------------------------------------------- cameras and lights -----
create policy cameras_select on public.cameras
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy cameras_write on public.cameras
  for all to authenticated
  using (public.is_project_member(public.scene_project(scene_id), 'editor'))
  with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

create policy lights_select on public.lights
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy lights_write on public.lights
  for all to authenticated
  using (public.is_project_member(public.scene_project(scene_id), 'editor'))
  with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

-- ---------------------------------------------------------------- jobs ------
create policy generation_jobs_select on public.generation_jobs
  for select to authenticated using (public.is_project_member(project_id));
create policy generation_jobs_insert on public.generation_jobs
  for insert to authenticated with check (public.is_project_member(project_id, 'editor'));

create policy generation_outputs_select on public.generation_outputs
  for select to authenticated
  using (exists (
    select 1 from public.generation_jobs j
    where j.id = job_id and public.is_project_member(j.project_id)
  ));

create policy render_jobs_select on public.render_jobs
  for select to authenticated using (public.is_project_member(project_id));
create policy render_jobs_insert on public.render_jobs
  for insert to authenticated with check (public.is_project_member(project_id, 'editor'));
create policy render_jobs_update on public.render_jobs
  for update to authenticated
  using (public.is_project_member(project_id, 'editor'))
  with check (public.is_project_member(project_id, 'editor'));

create policy render_outputs_select on public.render_outputs
  for select to authenticated
  using (exists (
    select 1 from public.render_jobs j
    where j.id = job_id and public.is_project_member(j.project_id)
  ));

-- -------------------------------------------------------- conversations -----
create policy conversations_rw on public.conversations
  for all to authenticated
  using (user_id = auth.uid() and public.is_project_member(project_id))
  with check (user_id = auth.uid() and public.is_project_member(project_id, 'editor'));

-- --------------------------------------------------------- edit history -----
create policy edit_operations_select on public.edit_operations
  for select to authenticated using (public.is_project_member(public.scene_project(scene_id)));
create policy edit_operations_insert on public.edit_operations
  for insert to authenticated with check (public.is_project_member(public.scene_project(scene_id), 'editor'));

-- ------------------------------------------------------------- feedback -----
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy feedback_select_own on public.feedback
  for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------- model registry -----
-- Readable by any signed-in user; writable only by the service role (which
-- bypasses RLS). No insert/update policy is defined on purpose.
create policy model_registry_read on public.model_registry
  for select to authenticated using (true);
create policy model_versions_read on public.model_versions
  for select to authenticated using (true);

-- -------------------------------------------------------------- billing -----
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy usage_select_own on public.usage_records
  for select to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------- audit logs -----
create policy audit_insert_own on public.audit_logs
  for insert to authenticated with check (user_id = auth.uid());
create policy audit_select_own on public.audit_logs
  for select to authenticated using (user_id = auth.uid());

-- Defence in depth: the browser role can never write registry or audit rows it
-- does not own, and anon gets nothing at all.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.model_registry from authenticated;
revoke insert, update, delete on public.model_versions from authenticated;
