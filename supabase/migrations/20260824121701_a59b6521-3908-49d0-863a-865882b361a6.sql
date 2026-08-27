
-- Super admins manage global/shared USSD flows
CREATE POLICY "super admin manage ussd_flows" ON public.ussd_flows
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "super admin manage ussd_flow_steps" ON public.ussd_flow_steps
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Shared (tenant-less) flows readable by everyone, incl. the Android delivery app
CREATE POLICY "read shared ussd_flows" ON public.ussd_flows
  FOR SELECT TO anon, authenticated
  USING (tenant_id IS NULL OR tenant_id = resolve_public_tenant() OR tenant_id = current_tenant_id());

CREATE POLICY "read shared ussd_flow_steps" ON public.ussd_flow_steps
  FOR SELECT TO anon, authenticated
  USING (tenant_id IS NULL OR tenant_id = resolve_public_tenant() OR tenant_id = current_tenant_id());

GRANT SELECT ON public.ussd_flows TO anon, authenticated;
GRANT SELECT ON public.ussd_flow_steps TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ussd_flows TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ussd_flow_steps TO authenticated;
GRANT ALL ON public.ussd_flows TO service_role;
GRANT ALL ON public.ussd_flow_steps TO service_role;
