-- ZeroCarbon project photos storage setup
-- Run manually in Supabase SQL Editor.
-- Idempotent and safe to run multiple times.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos',
  'project-photos',
  false,
  10485760,
  array['image/jpeg','image/jpg','image/png','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Project photos read own folder" on storage.objects;
drop policy if exists "Project photos upload own folder" on storage.objects;
drop policy if exists "Project photos update own folder" on storage.objects;
drop policy if exists "Project photos delete own folder" on storage.objects;

create policy "Project photos read own folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Project photos upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Project photos update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Project photos delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
