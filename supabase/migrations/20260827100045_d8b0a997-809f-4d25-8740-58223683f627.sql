
ALTER TABLE public.ussd_flows ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.ussd_flow_steps ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.ussd_unmatched_dialogs ALTER COLUMN tenant_id DROP DEFAULT;

UPDATE public.ussd_flows SET tenant_id = NULL WHERE tenant_id IS NOT NULL;
UPDATE public.ussd_flow_steps SET tenant_id = NULL WHERE tenant_id IS NOT NULL;
UPDATE public.ussd_unmatched_dialogs SET tenant_id = NULL WHERE tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.force_global_ussd_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.tenant_id := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_global_tenant ON public.ussd_flows;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.ussd_flows
FOR EACH ROW EXECUTE FUNCTION public.force_global_ussd_tenant();

DROP TRIGGER IF EXISTS force_global_tenant ON public.ussd_flow_steps;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.ussd_flow_steps
FOR EACH ROW EXECUTE FUNCTION public.force_global_ussd_tenant();

DROP TRIGGER IF EXISTS force_global_tenant ON public.ussd_unmatched_dialogs;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.ussd_unmatched_dialogs
FOR EACH ROW EXECUTE FUNCTION public.force_global_ussd_tenant();

DROP POLICY IF EXISTS "public read ussd_flows" ON public.ussd_flows;
DROP POLICY IF EXISTS "read shared ussd_flows" ON public.ussd_flows;
CREATE POLICY "read shared ussd_flows" ON public.ussd_flows FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read ussd_flow_steps" ON public.ussd_flow_steps;
DROP POLICY IF EXISTS "read shared ussd_flow_steps" ON public.ussd_flow_steps;
CREATE POLICY "read shared ussd_flow_steps" ON public.ussd_flow_steps FOR SELECT USING (true);

DROP POLICY IF EXISTS "read shared ussd_unmatched_dialogs" ON public.ussd_unmatched_dialogs;
CREATE POLICY "read shared ussd_unmatched_dialogs" ON public.ussd_unmatched_dialogs FOR SELECT USING (true);

GRANT SELECT ON public.ussd_flows TO anon, authenticated;
GRANT SELECT ON public.ussd_flow_steps TO anon, authenticated;
GRANT SELECT ON public.ussd_unmatched_dialogs TO anon, authenticated;
