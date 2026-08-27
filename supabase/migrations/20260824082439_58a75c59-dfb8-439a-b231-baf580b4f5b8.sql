-- 1) Subscriptions
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'trialing',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  grace_days integer NOT NULL DEFAULT 5,
  auto_suspend boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage subscriptions" ON public.tenant_subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members read own subscription" ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE TRIGGER trg_tenant_subscriptions_updated
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Payments
CREATE TABLE public.tenant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'manual',
  reference text,
  note text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payments TO authenticated;
GRANT ALL ON public.tenant_payments TO service_role;
ALTER TABLE public.tenant_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage payments" ON public.tenant_payments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members read own payments" ON public.tenant_payments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE INDEX idx_tenant_payments_tenant ON public.tenant_payments(tenant_id, paid_at DESC);

-- 3) Seed subscriptions for existing tenants (7-day trial from creation)
INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, trial_ends_at, current_period_end)
SELECT t.id, 'trial', 'trialing', t.created_at + interval '7 days', t.created_at + interval '7 days'
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- 4) Auto-create trial for new tenants
CREATE OR REPLACE FUNCTION public.create_tenant_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, trial_ends_at, current_period_end)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '7 days', now() + interval '7 days')
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_create_trial
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_tenant_trial();

-- 5) Read subscription state
CREATE OR REPLACE FUNCTION public.get_tenant_subscription(_tenant uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF v_end IS NULL THEN
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
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', v_end,
    'grace_days', s.grace_days,
    'grace_ends_at', v_end + make_interval(days => s.grace_days),
    'days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_end - now())) / 86400))::int,
    'grace_days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((v_end + make_interval(days => s.grace_days)) - now())) / 86400))::int
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_subscription(uuid) FROM anon;

-- 6) Record a payment (super admin) and extend the period
CREATE OR REPLACE FUNCTION public.record_tenant_payment(
  _tenant uuid,
  _plan text,
  _amount numeric DEFAULT NULL,
  _method text DEFAULT 'manual',
  _reference text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_interval interval;
  v_amount numeric;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF _plan NOT IN ('monthly', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_plan');
  END IF;

  v_interval := CASE WHEN _plan = 'monthly' THEN interval '1 month' ELSE interval '1 year' END;
  v_amount := COALESCE(_amount, CASE WHEN _plan = 'monthly' THEN 10 ELSE 100 END);

  SELECT GREATEST(now(), COALESCE(current_period_end, trial_ends_at, now()))
    INTO v_start
  FROM public.tenant_subscriptions WHERE tenant_id = _tenant;

  IF v_start IS NULL THEN
    INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, current_period_end)
    VALUES (_tenant, _plan, 'active', now())
    ON CONFLICT (tenant_id) DO NOTHING;
    v_start := now();
  END IF;

  v_end := v_start + v_interval;

  UPDATE public.tenant_subscriptions
  SET plan = _plan, status = 'active', amount = v_amount, current_period_end = v_end
  WHERE tenant_id = _tenant;

  INSERT INTO public.tenant_payments
    (tenant_id, plan, amount, method, reference, note, period_start, period_end, recorded_by)
  VALUES (_tenant, _plan, v_amount, _method, _reference, _note, v_start, v_end, auth.uid());

  UPDATE public.tenants SET status = 'active', plan = _plan WHERE id = _tenant;

  RETURN jsonb_build_object('ok', true, 'plan', _plan, 'amount', v_amount, 'current_period_end', v_end);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_tenant_payment(uuid, text, numeric, text, text, text) FROM anon;

-- 7) Auto-suspend after the grace period
CREATE OR REPLACE FUNCTION public.expire_tenant_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_suspended int := 0;
BEGIN
  WITH due AS (
    SELECT s.tenant_id
    FROM public.tenant_subscriptions s
    WHERE s.auto_suspend
      AND COALESCE(s.current_period_end, s.trial_ends_at) IS NOT NULL
      AND now() > COALESCE(s.current_period_end, s.trial_ends_at) + make_interval(days => s.grace_days)
  ), upd AS (
    UPDATE public.tenant_subscriptions s SET status = 'expired'
    FROM due WHERE s.tenant_id = due.tenant_id AND s.status <> 'expired'
    RETURNING s.tenant_id
  )
  UPDATE public.tenants t SET status = 'suspended'
  FROM due WHERE t.id = due.tenant_id AND t.status <> 'suspended';
  GET DIAGNOSTICS v_suspended = ROW_COUNT;
  RETURN jsonb_build_object('suspended', v_suspended);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_tenant_subscriptions() FROM anon;

-- 8) Block delivery for suspended tenants
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

  -- suspended tenants get nothing
  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant AND t.status = 'active') THEN
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

-- 9) Super admin overview list
CREATE OR REPLACE FUNCTION public.list_tenant_subscriptions()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'tenant_id', t.id,
    'name', t.name,
    'slug', t.slug,
    'tenant_status', t.status,
    'plan', s.plan,
    'amount', s.amount,
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', COALESCE(s.current_period_end, s.trial_ends_at),
    'grace_ends_at', COALESCE(s.current_period_end, s.trial_ends_at) + make_interval(days => COALESCE(s.grace_days, 5)),
    'state', CASE
      WHEN COALESCE(s.current_period_end, s.trial_ends_at) IS NULL THEN 'expired'
      WHEN now() <= COALESCE(s.current_period_end, s.trial_ends_at)
        THEN CASE WHEN s.plan = 'trial' THEN 'trialing' ELSE 'active' END
      WHEN now() <= COALESCE(s.current_period_end, s.trial_ends_at) + make_interval(days => COALESCE(s.grace_days, 5)) THEN 'grace'
      ELSE 'expired' END,
    'days_left', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(s.current_period_end, s.trial_ends_at) - now())) / 86400))::int,
    'last_payment_at', (SELECT max(p.paid_at) FROM public.tenant_payments p WHERE p.tenant_id = t.id),
    'total_paid', COALESCE((SELECT sum(p.amount) FROM public.tenant_payments p WHERE p.tenant_id = t.id), 0)
  )
  FROM public.tenants t
  LEFT JOIN public.tenant_subscriptions s ON s.tenant_id = t.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_tenant_subscriptions() FROM anon;