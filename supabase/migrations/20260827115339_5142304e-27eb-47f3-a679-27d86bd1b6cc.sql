CREATE OR REPLACE FUNCTION public.claim_next_delivery(p_device_id text, p_providers text[])
 RETURNS SETOF delivery_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_delivery_tenant();

  IF v_tenant IS NULL THEN
    SELECT ad.tenant_id INTO v_tenant
    FROM public.android_devices ad
    WHERE ad.device_id = p_device_id
    LIMIT 1;
  ELSE
    UPDATE public.android_devices
    SET tenant_id = v_tenant
    WHERE device_id = p_device_id AND tenant_id IS DISTINCT FROM v_tenant;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  -- only suspended/cancelled tenants get nothing (trial + active are allowed)
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = v_tenant AND t.status IN ('active', 'trial')
  ) THEN
    RETURN;
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
      AND tenant_id = v_tenant
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$function$;