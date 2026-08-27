-- 1) Popular packages must be tenant-scoped
CREATE OR REPLACE FUNCTION public.get_most_purchased_packages(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF customer_data_packages
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.provider_id, p.category_id, p.package_name, p.data_amount,
    p.validity_days, p.selling_price, p.is_active, p.connection_type_label,
    p.ussd_code, p.ussd_method, p.created_at, p.updated_at, p.tenant_id
  FROM public.customer_data_packages p
  LEFT JOIN public.orders o
    ON o.package_id = p.id
   AND o.delivery_status <> 'cancelled'
   AND o.tenant_id IS NOT DISTINCT FROM p.tenant_id
  WHERE p.tenant_id = public.resolve_public_tenant(p_tenant_id)
  GROUP BY
    p.id, p.provider_id, p.category_id, p.package_name, p.data_amount,
    p.validity_days, p.selling_price, p.is_active, p.connection_type_label,
    p.ussd_code, p.ussd_method, p.created_at, p.updated_at, p.tenant_id
  ORDER BY COUNT(o.id) DESC
  LIMIT 12;
$function$;

-- 2) SIM balances inherit tenant from their device
CREATE OR REPLACE FUNCTION public.derive_sim_balance_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.sim_id IS NOT NULL THEN
    SELECT ad.tenant_id INTO NEW.tenant_id
    FROM public.android_devices ad WHERE ad.id = NEW.sim_id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.derive_sim_balance_tenant() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_derive_sim_balance_tenant ON public.sim_balances;
CREATE TRIGGER trg_derive_sim_balance_tenant
BEFORE INSERT OR UPDATE ON public.sim_balances
FOR EACH ROW EXECUTE FUNCTION public.derive_sim_balance_tenant();