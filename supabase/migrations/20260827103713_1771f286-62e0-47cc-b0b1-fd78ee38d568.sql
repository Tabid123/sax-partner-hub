CREATE OR REPLACE FUNCTION public.get_active_providers(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF providers_config
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT public.resolve_public_tenant(p_tenant_id) AS id)
  SELECT jsonb_populate_record(
           p,
           jsonb_build_object('payment_number', COALESCE(tp.payment_number, p.payment_number))
         )
  FROM public.providers_config p
  JOIN t ON true
  JOIN public.tenant_providers tp
    ON tp.provider_id = p.id AND tp.tenant_id = t.id AND tp.is_enabled = true
  WHERE p.is_active = true
  ORDER BY p.display_order, p.provider_name;
$function$;