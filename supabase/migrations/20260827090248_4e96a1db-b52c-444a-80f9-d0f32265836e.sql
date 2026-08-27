CREATE OR REPLACE FUNCTION public.get_customer_order_history(
  customer_phone_number text,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  customer_phone text,
  sender_phone text,
  receiver_phone text,
  package_name text,
  data_amount text,
  selling_price numeric,
  status text,
  delivery_status text,
  invoice_url text,
  validity_days text,
  provider_name text,
  provider_logo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.created_at, o.customer_phone, o.sender_phone, o.receiver_phone,
         o.package_name, o.data_amount, o.selling_price, o.status, o.delivery_status,
         o.invoice_url, dp.validity_days, pr.provider_name, pr.provider_logo
  FROM public.orders o
  LEFT JOIN public.data_packages_config dp
    ON dp.id = o.package_id AND dp.tenant_id IS NOT DISTINCT FROM o.tenant_id
  LEFT JOIN public.providers_config pr
    ON pr.id = o.provider_id AND pr.tenant_id IS NOT DISTINCT FROM o.tenant_id
  WHERE o.tenant_id = public.resolve_public_tenant(p_tenant_id)
    AND customer_phone_number IS NOT NULL
    AND (o.customer_phone = customer_phone_number OR o.sender_phone = customer_phone_number)
  ORDER BY o.created_at DESC
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_order_history(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_customer_order_history(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_verified_phone(
  p_phone text,
  p_code text DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_id uuid;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;

  v_tenant := public.resolve_public_tenant(p_tenant_id);
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_required');
  END IF;

  SELECT id INTO v_id FROM public.verified_phones
  WHERE phone_number = p_phone AND tenant_id = v_tenant
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.verified_phones
    SET last_login_at = now(), updated_at = now()
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'existing', true, 'id', v_id, 'tenant_id', v_tenant);
  END IF;

  INSERT INTO public.verified_phones (phone_number, verification_code, verified_at, last_login_at, tenant_id)
  VALUES (p_phone, p_code, now(), now(), v_tenant)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'existing', false, 'id', v_id, 'tenant_id', v_tenant);
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_verified_phone(text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_verified_phone(text, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_customer_account(
  p_phone text,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_deleted int := 0;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;

  v_tenant := public.resolve_public_tenant(p_tenant_id);
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_required');
  END IF;

  DELETE FROM public.verified_phones
  WHERE phone_number = p_phone AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'removed', v_deleted, 'tenant_id', v_tenant);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_customer_account(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_customer_account(text, uuid) TO anon, authenticated;