CREATE OR REPLACE FUNCTION public.get_provider_wholesale_tiers(provider_uuid uuid, p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF provider_wholesale_tiers
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT public.resolve_public_tenant(p_tenant_id) AS tid),
  target AS (
    SELECT pc.provider_name FROM public.providers_config pc WHERE pc.id = provider_uuid
  ),
  matching_providers AS (
    SELECT pc.id
    FROM public.providers_config pc, t, target
    WHERE pc.tenant_id = t.tid
      AND lower(pc.provider_name) = lower(target.provider_name)
    UNION SELECT provider_uuid
  )
  SELECT w.* FROM public.provider_wholesale_tiers w, t
  WHERE w.is_active = true
    AND w.tenant_id = t.tid
    AND w.provider_id IN (SELECT id FROM matching_providers)
  ORDER BY w.display_order, w.min_amount;
$function$;
