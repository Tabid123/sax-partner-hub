CREATE POLICY "apps_read_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'apps');
CREATE POLICY "apps_insert_authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'apps');
CREATE POLICY "apps_update_authenticated" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'apps') WITH CHECK (bucket_id = 'apps');
CREATE POLICY "apps_delete_authenticated" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'apps');