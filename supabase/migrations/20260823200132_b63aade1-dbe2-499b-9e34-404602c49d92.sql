
-- Resolve the tenant of the currently signed-in delivery account
CREATE OR REPLACE FUNCTION public.current_delivery_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = auth.uid()
  ORDER BY tm.created_at ASC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_delivery_tenant() TO authenticated;

-- Info endpoint for the Android app after login
CREATE OR REPLACE FUNCTION public.get_delivery_session()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_result jsonb;
BEGIN
  v_tenant := public.current_delivery_tenant();
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('authenticated', auth.uid() IS NOT NULL, 'tenant_id', NULL);
  END IF;

  SELECT jsonb_build_object(
    'authenticated', true,
    'tenant_id', t.id,
    'tenant_slug', t.slug,
    'tenant_name', t.name,
    'providers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.provider_name,
        'ussd_method', p.ussd_method,
        'sim_pin', (SELECT di.sim_password FROM public.delivery_instructions di
                     WHERE di.provider_id = p.id AND di.sim_password IS NOT NULL LIMIT 1)
      ) ORDER BY p.display_order)
      FROM public.providers_config p
      WHERE p.tenant_id = t.id AND COALESCE(p.is_active, true)
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.tenants t WHERE t.id = v_tenant;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_session() TO authenticated;

-- Tenant-aware claiming: signed-in devices only get their own company's orders
CREATE OR REPLACE FUNCTION public.claim_next_delivery(p_device_id text, p_providers text[])
RETURNS SETOF delivery_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_delivery_tenant();

  IF v_tenant IS NOT NULL THEN
    UPDATE public.android_devices
    SET tenant_id = v_tenant
    WHERE device_id = p_device_id AND tenant_id IS DISTINCT FROM v_tenant;
  END IF;

  UPDATE public.delivery_queue
  SET status = 'pending',
      android_device_id = NULL,
      attempts = COALESCE(attempts, 0) + 1,
      scheduled_at = NOW() + INTERVAL '30 seconds',
      last_attempt_at = NULL,
      error_message = 'Auto-reset: 60s timeout, retry scheduled (' || (COALESCE(attempts,0)+1)::text || '/3)'
  WHERE android_device_id = p_device_id
    AND status = 'processing'
    AND COALESCE(last_attempt_at, created_at) < NOW() - INTERVAL '60 seconds'
    AND COALESCE(attempts, 0) < 2;

  UPDATE public.delivery_queue
  SET status = 'failed',
      completed_at = NOW(),
      error_message = 'Failed after 3 attempts (60s timeout each)'
  WHERE android_device_id = p_device_id
    AND status = 'processing'
    AND COALESCE(last_attempt_at, created_at) < NOW() - INTERVAL '60 seconds'
    AND COALESCE(attempts, 0) >= 2;

  IF EXISTS (
    SELECT 1 FROM public.delivery_queue
    WHERE android_device_id = p_device_id
      AND status = 'processing'
      AND COALESCE(last_attempt_at, created_at) >= NOW() - INTERVAL '60 seconds'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.delivery_queue
  SET status = 'processing',
      android_device_id = p_device_id,
      last_attempt_at = NOW()
  WHERE id = (
    SELECT id FROM public.delivery_queue
    WHERE status = 'pending'
      AND lower(provider_name) = ANY(SELECT lower(unnest(p_providers)))
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
      AND (v_tenant IS NULL OR tenant_id = v_tenant)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$function$;

-- PIN must come from the same tenant as the order
CREATE OR REPLACE FUNCTION public.auto_fill_pin_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_provider uuid;
  v_tenant uuid;
BEGIN
  IF NEW.pin_code IS NULL THEN
    SELECT o.provider_id, COALESCE(NEW.tenant_id, o.tenant_id)
      INTO v_provider, v_tenant
    FROM public.orders o WHERE o.id = NEW.order_id;

    SELECT di.sim_password INTO NEW.pin_code
    FROM public.delivery_instructions di
    WHERE di.provider_id = v_provider
      AND di.sim_password IS NOT NULL
      AND (v_tenant IS NULL OR di.tenant_id = v_tenant OR di.tenant_id IS NULL)
    ORDER BY (di.tenant_id = v_tenant) DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;
