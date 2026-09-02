-- PPM Field Pro - site-aware Supabase Storage policies
-- Requires supabase/shared-site-model.sql first.
-- Buckets stay private. Access follows ppm_site_members.

insert into storage.buckets(id,name,public)
values ('ppm-photos','ppm-photos',false),('ppm-backups','ppm-backups',false)
on conflict(id) do update set public=false;

-- Remove legacy broad policies.
drop policy if exists "PPM photos authenticated select" on storage.objects;
drop policy if exists "PPM photos authenticated insert" on storage.objects;
drop policy if exists "PPM photos authenticated update" on storage.objects;
drop policy if exists "PPM photos authenticated delete" on storage.objects;

-- Read: any member of the site can list/read private site objects.
drop policy if exists "PPM site files select" on storage.objects;
create policy "PPM site files select" on storage.objects
for select to authenticated
using (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_has_site_access(((storage.foldername(name))[2])::bigint)
);

-- Write: admins and technicians can upload/replace/move site objects.
drop policy if exists "PPM site files insert" on storage.objects;
create policy "PPM site files insert" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

drop policy if exists "PPM site files update" on storage.objects;
create policy "PPM site files update" on storage.objects
for update to authenticated
using (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
)
with check (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

drop policy if exists "PPM site files delete" on storage.objects;
create policy "PPM site files delete" on storage.objects
for delete to authenticated
using (
  bucket_id in ('ppm-photos','ppm-backups')
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);
