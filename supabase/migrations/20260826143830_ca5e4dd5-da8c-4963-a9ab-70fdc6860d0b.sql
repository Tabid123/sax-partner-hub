CREATE POLICY "tenant members read sim_balances"
ON public.sim_balances FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.is_tenant_member(tenant_id));

CREATE POLICY "tenant managers manage sim_balances"
ON public.sim_balances FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.is_tenant_manager(tenant_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_tenant_manager(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_balances TO authenticated;
GRANT ALL ON public.sim_balances TO service_role;

ALTER TABLE public.sim_balances REPLICA IDENTITY FULL;
ALTER TABLE public.android_devices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sim_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.android_devices;