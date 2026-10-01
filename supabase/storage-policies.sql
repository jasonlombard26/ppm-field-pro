-- PPM Field Pro - site-aware Supabase Storage policies
-- Requires supabase/shared-site-model.sql first.
-- Buckets stay private. Access follows ppm_site_members.

insert into storage.buckets(id,name,public)
values ('ppm-photos','ppm-photos',false),('ppm-backups','ppm-backups',false)
on conflict(id) do update set public=false;

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
