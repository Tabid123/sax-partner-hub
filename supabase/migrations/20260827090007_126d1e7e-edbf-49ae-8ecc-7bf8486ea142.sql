CREATE OR REPLACE FUNCTION public.create_online_payment_reservation(
  p_verified_phone text,
  p_sender_phone text,
  p_receiver_phone text,
  p_provider_id uuid,
  p_package_id uuid,
  p_payment_provider text,
  p_expected_amount numeric,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  v_provider_tenant uuid;
  v_package_tenant uuid;
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_provider_tenant FROM public.providers_config WHERE id = p_provider_id;
  SELECT tenant_id INTO v_package_tenant FROM public.data_packages_config WHERE id = p_package_id;

  -- Provider iyo package waa inay isku tenant ahaadaan
  IF v_provider_tenant IS NOT NULL AND v_package_tenant IS NOT NULL
     AND v_provider_tenant <> v_package_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_mismatch');
  END IF;

  v_tenant := COALESCE(v_provider_tenant, v_package_tenant);

  IF p_tenant_id IS NOT NULL AND v_tenant IS NOT NULL AND p_tenant_id <> v_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_mismatch');
  END IF;

  v_tenant := COALESCE(v_tenant, p_tenant_id);

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_required');
  END IF;

  INSERT INTO public.pending_online_payments (
    verified_phone, sender_phone, receiver_phone,
    provider_id, package_id, payment_provider, expected_amount, tenant_id
  ) VALUES (
    p_verified_phone, p_sender_phone, p_receiver_phone,
    p_provider_id, p_package_id, p_payment_provider, p_expected_amount, v_tenant
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'intent_id', new_id, 'tenant_id', v_tenant);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_jumlo_payment_reservation(
  p_verified_phone text,
  p_sender_phone text,
  p_data_phone text,
  p_provider_id uuid,
  p_tier_id uuid,
  p_payment_provider text,
  p_expected_amount numeric,
  p_topup_amount numeric,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  v_provider_tenant uuid;
  v_tier_tenant uuid;
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_provider_tenant FROM public.providers_config WHERE id = p_provider_id;
  SELECT tenant_id INTO v_tier_tenant FROM public.provider_wholesale_tiers WHERE id = p_tier_id;

  IF v_provider_tenant IS NOT NULL AND v_tier_tenant IS NOT NULL
     AND v_provider_tenant <> v_tier_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_mismatch');
  END IF;

  v_tenant := COALESCE(v_provider_tenant, v_tier_tenant);

  IF p_tenant_id IS NOT NULL AND v_tenant IS NOT NULL AND p_tenant_id <> v_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_mismatch');
  END IF;

  v_tenant := COALESCE(v_tenant, p_tenant_id);

  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_required');
  END IF;

  INSERT INTO public.pending_online_payments (
    verified_phone, sender_phone, receiver_phone,
    provider_id, package_id, payment_provider,
    expected_amount, intent_type, tier_id, topup_amount, tenant_id
  ) VALUES (
    p_verified_phone, p_sender_phone, p_data_phone,
    p_provider_id, NULL, p_payment_provider,
    p_expected_amount, 'jumlo', p_tier_id, p_topup_amount, v_tenant
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'intent_id', new_id, 'tenant_id', v_tenant);
END;
$function$;

-- Ogeysiisyada: ha ku xirnaan hal tenant oo cayiman
DROP POLICY IF EXISTS "public read notifications" ON public.notifications;
CREATE POLICY "public read notifications"
ON public.notifications
FOR SELECT
TO anon
USING (
  tenant_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = notifications.tenant_id AND t.status = 'active')
);