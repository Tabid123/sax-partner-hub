CREATE OR REPLACE FUNCTION public.link_device_to_tenant(p_device_id text, p_device_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_tenant := public.current_delivery_tenant();
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_tenant');
  END IF;

  IF EXISTS (SELECT 1 FROM public.android_devices WHERE device_id = p_device_id) THEN
    UPDATE public.android_devices
    SET tenant_id = v_tenant,
        device_name = COALESCE(p_device_name, device_name),
        is_active = true,
        last_ping_at = now()
    WHERE device_id = p_device_id;
  ELSE
    INSERT INTO public.android_devices (device_id, device_name, provider_name, sim_number, tenant_id, is_active, last_ping_at)
    VALUES (p_device_id, COALESCE(p_device_name, 'Android device'), '', '', v_tenant, true, now());
  END IF;

  RETURN (SELECT jsonb_build_object(
    'ok', true,
    'tenant_id', t.id,
    'tenant_name', t.name,
    'tenant_slug', t.slug
  ) FROM public.tenants t WHERE t.id = v_tenant);
END;
$$;

REVOKE ALL ON FUNCTION public.link_device_to_tenant(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_device_to_tenant(text, text) TO authenticated, service_role;