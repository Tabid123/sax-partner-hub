-- 1) No more guessing a tenant for public/anon paths
CREATE OR REPLACE FUNCTION public.resolve_public_tenant(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.id FROM public.tenants t WHERE t.id = p_tenant_id;
$function$;

-- 2) Derivation triggers: parent-derived only, never a default guess
CREATE OR REPLACE FUNCTION public.derive_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v uuid;
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.intent_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.pending_online_payments WHERE id = NEW.intent_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.providers_config WHERE id = NEW.provider_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.data_packages_config WHERE id = NEW.package_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required: order has no resolvable tenant (intent/provider/package/session all unknown)';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.derive_pending_payment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v uuid;
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.providers_config WHERE id = NEW.provider_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.data_packages_config WHERE id = NEW.package_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.tier_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.provider_wholesale_tiers WHERE id = NEW.tier_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_required: payment intent has no resolvable tenant';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Receipts: derive from matched order, else from the SIM / device that received the money
CREATE OR REPLACE FUNCTION public.sync_receipt_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v uuid;
BEGIN
  IF NEW.matched_order_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.orders WHERE id = NEW.matched_order_id;
    IF v IS NOT NULL THEN
      NEW.tenant_id := v;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.tenant_id IS NULL AND NEW.receiver_sim IS NOT NULL THEN
    SELECT ad.tenant_id INTO v
    FROM public.android_devices ad
    WHERE ad.tenant_id IS NOT NULL
      AND (
        ad.device_id = NEW.receiver_sim
        OR ad.sim_number = NEW.receiver_sim
        OR ad.sim2_number = NEW.receiver_sim
      )
    LIMIT 1;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;

  -- still unknown: stays NULL ("unassigned") instead of landing on a wrong tenant
  RETURN NEW;
END;
$function$;

-- 4) Hard guarantee: these rows can never exist without a tenant
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pending_online_payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.delivery_queue ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.verified_phones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.android_devices ALTER COLUMN tenant_id SET NOT NULL;