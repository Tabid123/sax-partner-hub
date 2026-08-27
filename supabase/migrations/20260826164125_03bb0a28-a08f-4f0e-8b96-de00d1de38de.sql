ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz;

ALTER TABLE public.tenant_subscriptions ALTER COLUMN grace_days SET DEFAULT 3;
UPDATE public.tenant_subscriptions SET grace_days = 3 WHERE grace_days IS DISTINCT FROM 3;

CREATE OR REPLACE FUNCTION public.create_tenant_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, trial_starts_at, trial_ends_at, current_period_end, grace_days)
  VALUES (NEW.id, 'trial', 'trialing', now(), now() + interval '7 days', now() + interval '7 days', 3)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tenant_trial(
  _tenant uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _grace_days integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF _ends_at IS NULL OR _starts_at IS NULL OR _ends_at <= _starts_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_dates');
  END IF;

  INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, trial_starts_at, trial_ends_at, current_period_end, grace_days)
  VALUES (_tenant, 'trial', 'trialing', _starts_at, _ends_at, _ends_at, COALESCE(_grace_days, 3))
  ON CONFLICT (tenant_id) DO UPDATE
    SET plan = 'trial',
        status = 'trialing',
        trial_starts_at = EXCLUDED.trial_starts_at,
        trial_ends_at = EXCLUDED.trial_ends_at,
        current_period_end = EXCLUDED.current_period_end,
        grace_days = EXCLUDED.grace_days,
        updated_at = now();

  UPDATE public.tenants SET status = 'active', updated_at = now()
  WHERE id = _tenant AND status = 'suspended';

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_tenant_trial(uuid, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_trial(uuid, timestamptz, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_subscription(_tenant uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  s public.tenant_subscriptions%ROWTYPE;
  v_end timestamptz;
  v_state text;
BEGIN
  v_tenant := COALESCE(_tenant, public.current_tenant_id());
  IF v_tenant IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_tenant'); END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_tenant_member(v_tenant)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO s FROM public.tenant_subscriptions WHERE tenant_id = v_tenant;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_subscription'); END IF;

  v_end := COALESCE(s.current_period_end, s.trial_ends_at);
  IF s.trial_starts_at IS NOT NULL AND s.plan = 'trial' AND now() < s.trial_starts_at THEN
    v_state := 'scheduled';
  ELSIF v_end IS NULL THEN
    v_state := 'expired';
  ELSIF now() <= v_end THEN
    v_state := CASE WHEN s.plan = 'trial' THEN 'trialing' ELSE 'active' END;
  ELSIF now() <= v_end + make_interval(days => s.grace_days) THEN
    v_state := 'grace';
  ELSE
    v_state := 'expired';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', v_tenant,
    'plan', s.plan,
    'state', v_state,
    'amount', s.amount,
    'currency', s.currency,
    'trial_starts_at', s.trial_starts_at,
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', v_end,
    'grace_days', s.grace_days,
    'grace_ends_at', v_end + make_interval(days => s.grace_days),
    'days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end - now())) / 86400))::int,
    'grace_days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((v_end + make_interval(days => s.grace_days)) - now())) / 86400))::int
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_tenant_subscriptions()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'tenant_id', t.id,
    'name', t.name,
    'slug', t.slug,
    'tenant_status', t.status,
    'plan', s.plan,
    'amount', s.amount,
    'trial_starts_at', s.trial_starts_at,
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', COALESCE(s.current_period_end, s.trial_ends_at),
    'grace_days', COALESCE(s.grace_days, 3),
    'grace_ends_at', COALESCE(s.current_period_end, s.trial_ends_at) + make_interval(days => COALESCE(s.grace_days, 3)),
    'state', CASE
      WHEN s.plan = 'trial' AND s.trial_starts_at IS NOT NULL AND now() < s.trial_starts_at THEN 'scheduled'
      WHEN COALESCE(s.current_period_end, s.trial_ends_at) IS NULL THEN 'expired'
      WHEN now() <= COALESCE(s.current_period_end, s.trial_ends_at)
        THEN CASE WHEN s.plan = 'trial' THEN 'trialing' ELSE 'active' END
      WHEN now() <= COALESCE(s.current_period_end, s.trial_ends_at) + make_interval(days => COALESCE(s.grace_days, 3)) THEN 'grace'
      ELSE 'expired' END,
    'days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(s.current_period_end, s.trial_ends_at) - now())) / 86400))::int,
    'last_payment_at', (SELECT max(p.paid_at) FROM public.tenant_payments p WHERE p.tenant_id = t.id),
    'total_paid', COALESCE((SELECT sum(p.amount) FROM public.tenant_payments p WHERE p.tenant_id = t.id), 0)
  )
  FROM public.tenants t
  LEFT JOIN public.tenant_subscriptions s ON s.tenant_id = t.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.created_at DESC;
$function$;