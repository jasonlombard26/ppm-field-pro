-- PPM Field Pro - additive security hardening
-- Run after setup.sql, shared-site-model.sql and storage-policies.sql.

revoke all on table public.ppm_sites from anon;
revoke all on table public.ppm_site_members from anon;
revoke all on table public.ppm_app_state from anon;

grant select, update, delete on table public.ppm_sites to authenticated;
grant select on table public.ppm_site_members to authenticated;
grant select, insert, update, delete on table public.ppm_app_state to authenticated;
revoke insert, update, delete on table public.ppm_site_members from authenticated;

update storage.buckets
set public=false,
    file_size_limit=20 * 1024 * 1024,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
where id='ppm-photos';

update storage.buckets
set public=false,
    file_size_limit=500 * 1024 * 1024
where id='ppm-backups';

drop policy if exists "PPM site files delete" on storage.objects;
drop policy if exists "PPM site photos delete" on storage.objects;
drop policy if exists "PPM site backups delete" on storage.objects;

create policy "PPM site photos delete" on storage.objects
for delete to authenticated
using (
  bucket_id='ppm-photos'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_can_edit_site(((storage.foldername(name))[2])::bigint)
);

create policy "PPM site backups delete" on storage.objects
for delete to authenticated
using (
  bucket_id='ppm-backups'
  and (storage.foldername(name))[1]='sites'
  and coalesce((storage.foldername(name))[2],'') ~ '^[0-9]+$'
  and public.ppm_user_is_site_admin(((storage.foldername(name))[2])::bigint)
);

revoke all on function public.ppm_user_has_site_access(bigint) from public, anon;
revoke all on function public.ppm_user_can_edit_site(bigint) from public, anon;
revoke all on function public.ppm_user_is_site_admin(bigint) from public, anon;
revoke all on function public.ppm_upsert_site_state(bigint,text,jsonb) from public, anon;
revoke all on function public.ppm_grant_site_access(bigint,text,text) from public, anon;

grant execute on function public.ppm_user_has_site_access(bigint) to authenticated;
grant execute on function public.ppm_user_can_edit_site(bigint) to authenticated;
grant execute on function public.ppm_user_is_site_admin(bigint) to authenticated;
grant execute on function public.ppm_upsert_site_state(bigint,text,jsonb) to authenticated;
grant execute on function public.ppm_grant_site_access(bigint,text,text) to authenticated;
