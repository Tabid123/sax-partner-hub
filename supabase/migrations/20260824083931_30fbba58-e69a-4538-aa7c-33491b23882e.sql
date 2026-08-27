CREATE POLICY "Super admins manage tenant logos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'tenant-logos' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'tenant-logos' AND public.is_super_admin(auth.uid()));