drop policy if exists "Public read tenant logos" on storage.objects;
create policy "Public read tenant logos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'tenant-logos');