ALTER TABLE public.provider_wholesale_tiers ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.provider_wholesale_tiers ALTER COLUMN tenant_id SET NOT NULL;
DROP POLICY IF EXISTS "admin all wholesale tiers" ON public.provider_wholesale_tiers;
CREATE POLICY "super admin all wholesale tiers" ON public.provider_wholesale_tiers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));