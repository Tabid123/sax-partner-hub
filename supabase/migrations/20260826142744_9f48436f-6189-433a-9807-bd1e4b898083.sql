DROP POLICY IF EXISTS "apps_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "apps_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "apps_delete_authenticated" ON storage.objects;

CREATE POLICY "apps_insert_superadmin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'apps' AND public.is_super_admin(auth.uid()));

CREATE POLICY "apps_update_superadmin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'apps' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'apps' AND public.is_super_admin(auth.uid()));

CREATE POLICY "apps_delete_superadmin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'apps' AND public.is_super_admin(auth.uid()));