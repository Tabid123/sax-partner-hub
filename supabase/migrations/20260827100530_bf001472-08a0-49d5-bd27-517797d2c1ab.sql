
CREATE TABLE public.tenant_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers_config(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  payment_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_id)
);

GRANT SELECT ON public.tenant_providers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_providers TO authenticated;
GRANT ALL ON public.tenant_providers TO service_role;

ALTER TABLE public.tenant_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read tenant providers" ON public.tenant_providers FOR SELECT USING (true);
CREATE POLICY "managers manage tenant providers" ON public.tenant_providers FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_tenant_manager(tenant_id) OR can_manage_tenant(tenant_id))
  WITH CHECK (is_super_admin(auth.uid()) OR is_tenant_manager(tenant_id) OR can_manage_tenant(tenant_id));

CREATE TRIGGER update_tenant_providers_updated_at BEFORE UPDATE ON public.tenant_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_active_providers(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF providers_config LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT public.resolve_public_tenant(p_tenant_id) AS id)
  SELECT p.* FROM public.providers_config p
  WHERE p.is_active = true
    AND (
      NOT EXISTS (SELECT 1 FROM public.tenant_providers tp, t WHERE tp.tenant_id = t.id)
      OR EXISTS (
        SELECT 1 FROM public.tenant_providers tp, t
        WHERE tp.tenant_id = t.id AND tp.provider_id = p.id AND tp.is_enabled = true
      )
    )
  ORDER BY p.display_order, p.provider_name;
$function$;
