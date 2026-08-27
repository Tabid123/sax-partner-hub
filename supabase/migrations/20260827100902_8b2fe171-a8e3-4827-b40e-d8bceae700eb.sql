CREATE OR REPLACE FUNCTION public.get_active_providers(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF providers_config
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT public.resolve_public_tenant(p_tenant_id) AS id)
  SELECT p.* FROM public.providers_config p
  WHERE p.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_providers tp, t
      WHERE tp.tenant_id = t.id AND tp.provider_id = p.id AND tp.is_enabled = true
    )
  ORDER BY p.display_order, p.provider_name;
$function$;