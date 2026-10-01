-- PPM Field Pro - additive security hardening
-- Requires setup.sql and shared-site-model.sql.
-- Normally run after storage-policies.sql to apply bucket limits. Both scripts
-- install the same Storage policies, so re-running either preserves restrictions.

revoke all on table public.ppm_sites from anon;
revoke all on table public.ppm_site_members from anon;
revoke all on table public.ppm_app_state from anon;

-- Writes must use the revision-checked ppm_save_site_state RPC.
revoke insert, update, delete on table public.ppm_sites from public, anon, authenticated;
grant select on table public.ppm_sites to authenticated;
grant select on table public.ppm_site_members to authenticated;
grant select, insert, update, delete on table public.ppm_app_state to authenticated;
revoke insert, update, delete on table public.ppm_site_members from authenticated;

-- Site writes must pass through ppm_save_site_state, which checks revisions
-- and creates the authenticated creator's admin membership atomically.
drop policy if exists "PPM shared sites insert" on public.ppm_sites;
drop policy if exists "PPM shared sites update" on public.ppm_sites;
-- Do not free a site ID while private Storage objects can still exist beneath it.
-- A controlled tombstone/storage cleanup lifecycle is required before deletion.
drop policy if exists "PPM shared sites delete" on public.ppm_sites;

update storage.buckets
set public=false,
    file_size_limit=20 * 1024 * 1024,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
where id='ppm-photos';

update storage.buckets
set public=false,
    file_size_limit=500 * 1024 * 1024
where id='ppm-backups';

-- BEGIN PPM STORAGE POLICIES
-- Keep this block identical in storage-policies.sql and security-hardening.sql.
-- PostgreSQL ORs permissive policies: remove every known legacy grant before
-- replacing it. The restrictive backup guards also constrain any additional
-- authenticated permissive policy, including one installed outside this repo.
drop policy if exists "PPM photos authenticated select" on storage.objects;
drop policy if exists "PPM photos authenticated insert" on storage.objects;
drop policy if exists "PPM photos authenticated update" on storage.objects;
drop policy if exists "PPM photos authenticated delete" on storage.objects;
drop policy if exists "PPM users can view site photos" on storage.objects;
drop policy if exists "PPM users can upload site photos" on storage.objects;
drop policy if exists "PPM users can update site photos" on storage.objects;
drop policy if exists "PPM users can delete site photos" on storage.objects;
drop policy if exists "PPM site files select" on storage.objects;
drop policy if exists "PPM site files insert" on storage.objects;
drop policy if exists "PPM site files update" on storage.objects;
drop policy if exists "PPM site files delete" on storage.objects;
drop policy if exists "PPM site photos update" on storage.objects;
drop policy if exists "PPM site photos delete" on storage.objects;
drop policy if exists "PPM site backups update" on storage.objects;
drop policy if exists "PPM site backups delete" on storage.objects;
drop policy if exists "PPM site backups update guard" on storage.objects;
drop policy if exists "PPM site backups delete guard" on storage.objects;

-- Any site member can read; admins and technicians can create new objects.
create policy "PPM site files select" on storage.objects
for select to authenticated
using (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_has_site_access(((storage.foldername(name))[2])::bigint)
);

create policy "PPM site files insert" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

-- Photos remain editable/deletable by site admins and technicians.
create policy "PPM site photos update" on storage.objects
for update to authenticated
using (
  bucket_id='ppm-photos'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
)
with check (
  bucket_id='ppm-photos'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

create policy "PPM site photos delete" on storage.objects
for delete to authenticated
using (
  bucket_id='ppm-photos'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

-- Existing backups may only be replaced, moved or deleted by site admins.
-- UPDATE checks both the source row and the destination row.
create policy "PPM site backups update" on storage.objects
for update to authenticated
using (
  bucket_id='ppm-backups'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
)
with check (
  bucket_id='ppm-backups'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
);

create policy "PPM site backups delete" on storage.objects
for delete to authenticated
using (
  bucket_id='ppm-backups'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
);

-- Restrictive policies are ANDed with the permissive grants above. These
-- guards do not grant access themselves and do not affect other buckets.
-- Checking old AND new rows prevents bypasses via rename/move/upsert.
create policy "PPM site backups update guard" on storage.objects
as restrictive for update to authenticated
using (
  bucket_id <> 'ppm-backups'
  or (
    bucket_id='ppm-backups'
    and (storage.foldername(name))[1]='sites'
    and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
    and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
  )
)
with check (
  bucket_id <> 'ppm-backups'
  or (
    bucket_id='ppm-backups'
    and (storage.foldername(name))[1]='sites'
    and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
    and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
  )
);

create policy "PPM site backups delete guard" on storage.objects
as restrictive for delete to authenticated
using (
  bucket_id <> 'ppm-backups'
  or (
    bucket_id='ppm-backups'
    and (storage.foldername(name))[1]='sites'
    and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
    and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
  )
);
-- END PPM STORAGE POLICIES

revoke all on function public.ppm_user_has_site_access(bigint) from public, anon;
revoke all on function public.ppm_user_can_edit_site(bigint) from public, anon;
revoke all on function public.ppm_user_is_site_admin(bigint) from public, anon;
revoke all on function public.ppm_upsert_site_state(bigint,text,jsonb) from public, anon;
revoke all on function public.ppm_save_site_state(bigint,text,jsonb,bigint) from public, anon;
revoke all on function public.ppm_grant_site_access(bigint,text,text) from public, anon;

grant execute on function public.ppm_user_has_site_access(bigint) to authenticated;
grant execute on function public.ppm_user_can_edit_site(bigint) to authenticated;
grant execute on function public.ppm_user_is_site_admin(bigint) to authenticated;
grant execute on function public.ppm_upsert_site_state(bigint,text,jsonb) to authenticated;
grant execute on function public.ppm_save_site_state(bigint,text,jsonb,bigint) to authenticated;
grant execute on function public.ppm_grant_site_access(bigint,text,text) to authenticated;
