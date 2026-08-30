-- PPM Field Pro - Supabase Storage policies
-- Bucket: ppm-photos (private)
-- Goal: any authenticated PPM App user can list/read/upload/rename/delete site photos.

-- SELECT is required for listing objects and for delete verification.
drop policy if exists "PPM photos authenticated select" on storage.objects;
create policy "PPM photos authenticated select"
on storage.objects
for select
to authenticated
using (bucket_id = 'ppm-photos');

-- INSERT allows authenticated users to upload photos into the private bucket.
drop policy if exists "PPM photos authenticated insert" on storage.objects;
create policy "PPM photos authenticated insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ppm-photos');

-- UPDATE is required for rename/move operations.
drop policy if exists "PPM photos authenticated update" on storage.objects;
create policy "PPM photos authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'ppm-photos')
with check (bucket_id = 'ppm-photos');

-- DELETE allows any authenticated PPM App user to permanently remove site photos,
-- regardless of which authenticated user originally uploaded them.
drop policy if exists "PPM photos authenticated delete" on storage.objects;
create policy "PPM photos authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'ppm-photos');
