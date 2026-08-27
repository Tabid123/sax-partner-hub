CREATE OR REPLACE FUNCTION public.get_admin_transactions_summary(p_provider_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.selling_price,
           o.created_at,
           COALESCE(NULLIF(dp.cost_price, 0), 0)::numeric AS package_cost,
           (wt.id IS NOT NULL) AS is_jumlo,
           COALESCE(wt.intake_rate, 0)::numeric AS intake_rate,
           COALESCE(wt.payout_rate, 0)::numeric AS payout_rate
    FROM public.orders o
    LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
    LEFT JOIN public.pending_online_payments pop ON pop.id = o.intent_id
    LEFT JOIN public.provider_wholesale_tiers wt ON wt.id = pop.tier_id
    WHERE o.delivery_status <> 'cancelled'
      AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
      AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
  ),
  calc AS (
    SELECT selling_price,
           created_at,
           CASE WHEN is_jumlo THEN selling_price - selling_price * (intake_rate - payout_rate) / 100.0
                ELSE package_cost END AS cost_cash,
           CASE WHEN is_jumlo THEN selling_price * (intake_rate - payout_rate) / 100.0
                ELSE selling_price - package_cost END AS profit
    FROM base
  ),
  scoped AS (
    SELECT * FROM calc
    WHERE CASE p_period
      WHEN 'today' THEN created_at >= date_trunc('day', now())
      WHEN 'yesterday' THEN created_at >= date_trunc('day', now()) - interval '1 day' AND created_at < date_trunc('day', now())
      WHEN 'week' THEN created_at >= date_trunc('week', now())
      WHEN 'month' THEN created_at >= date_trunc('month', now())
      WHEN 'year' THEN created_at >= date_trunc('year', now())
      ELSE true
    END
  )
  SELECT jsonb_build_object(
    'transactions_today', (SELECT COUNT(*) FROM calc WHERE created_at >= date_trunc('day', now())),
    'sales_today', COALESCE((SELECT SUM(selling_price) FROM calc WHERE created_at >= date_trunc('day', now())), 0),
    'cost_today', COALESCE((SELECT SUM(cost_cash) FROM calc WHERE created_at >= date_trunc('day', now())), 0),
    'sales_this_month', COALESCE((SELECT SUM(selling_price) FROM calc WHERE created_at >= date_trunc('month', now())), 0),
    'cost_this_month', COALESCE((SELECT SUM(cost_cash) FROM calc WHERE created_at >= date_trunc('month', now())), 0),
    'total_profit', COALESCE((SELECT SUM(profit) FROM scoped), 0),
    'cost_period', COALESCE((SELECT SUM(cost_cash) FROM scoped), 0)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_transactions_paginated(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_provider_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT
      o.*,
      COALESCE(pkg.cost_price, 0)::numeric AS cost_price,
      COALESCE(pr.evoucher_rate, 0)::numeric AS evoucher_rate,
      COALESCE(pr.provider_name, '') AS provider_name,
      (wt.id IS NOT NULL) AS is_jumlo,
      COALESCE(NULLIF(pkg.cost_price, 0), pop.topup_amount, 0)::numeric AS cost_ev,
      COALESCE(wt.intake_rate, 0)::numeric AS intake_rate,
      COALESCE(wt.payout_rate, 0)::numeric AS payout_rate
    FROM public.orders o
    LEFT JOIN public.data_packages_config pkg ON pkg.id = o.package_id
    LEFT JOIN public.pending_online_payments pop ON pop.id = o.intent_id
    LEFT JOIN public.provider_wholesale_tiers wt ON wt.id = pop.tier_id
    LEFT JOIN public.providers_config pr ON pr.id = o.provider_id
    WHERE o.delivery_status <> 'cancelled'
      AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
      AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
      AND (p_status IS NULL OR p_status = 'all' OR o.status = p_status)
      AND (
        p_search IS NULL OR p_search = ''
        OR o.customer_phone ILIKE '%' || p_search || '%'
        OR o.receiver_phone ILIKE '%' || p_search || '%'
        OR o.id::text ILIKE '%' || p_search || '%'
      )
      AND (
        p_period IS NULL OR p_period = 'all'
        OR (p_period = 'today' AND o.created_at >= date_trunc('day', now()))
        OR (p_period = 'yesterday' AND o.created_at >= date_trunc('day', now()) - interval '1 day' AND o.created_at < date_trunc('day', now()))
        OR (p_period = 'week' AND o.created_at >= date_trunc('week', now()))
        OR (p_period = 'month' AND o.created_at >= date_trunc('month', now()))
        OR (p_period = 'year' AND o.created_at >= date_trunc('year', now()))
      )
  ),
  calc AS (
    SELECT f.*,
           CASE WHEN is_jumlo THEN (intake_rate - payout_rate) ELSE evoucher_rate * 100 END AS rate_pct,
           CASE WHEN is_jumlo THEN selling_price - selling_price * (intake_rate - payout_rate) / 100.0
                ELSE cost_price END AS cost_cash,
           CASE WHEN is_jumlo THEN selling_price * (intake_rate - payout_rate) / 100.0
                ELSE selling_price - cost_price END AS profit
    FROM filtered f
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(row_data)
      FROM (
        SELECT to_jsonb(c) AS row_data
        FROM calc c
        ORDER BY c.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) sub
    ), '[]'::jsonb),
    'total_count', (SELECT count(*) FROM calc),
    'total_sales', COALESCE((SELECT sum(selling_price) FROM calc), 0),
    'total_profit', COALESCE((SELECT sum(profit) FROM calc), 0)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_profit_report(p_start timestamp with time zone, p_end timestamp with time zone, p_provider_id uuid DEFAULT NULL::uuid, p_group_by text DEFAULT 'provider'::text)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      (o.created_at AT TIME ZONE 'Africa/Mogadishu')::date AS day_date,
      pr.id AS provider_id,
      pr.provider_name,
      (wt.id IS NOT NULL) AS is_jumlo,
      CASE WHEN wt.id IS NOT NULL THEN (COALESCE(wt.intake_rate, 0) - COALESCE(wt.payout_rate, 0)) / 100.0
           ELSE 0 END AS rate,
      COALESCE(o.selling_price, 0)::numeric AS revenue,
      COALESCE(NULLIF(dp.cost_price, 0), pop.topup_amount, 0)::numeric AS cost_ev,
      COALESCE(wt.intake_rate, 0)::numeric AS intake_rate,
      COALESCE(wt.payout_rate, 0)::numeric AS payout_rate
    FROM public.orders o
    JOIN public.providers_config pr ON pr.id = o.provider_id
    LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
    LEFT JOIN public.pending_online_payments pop ON pop.id = o.intent_id
    LEFT JOIN public.provider_wholesale_tiers wt ON wt.id = pop.tier_id
    WHERE o.delivery_status = 'delivered'
      AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
      AND o.created_at >= p_start
      AND o.created_at <= p_end
      AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
  ), calc AS (
    SELECT
      day_date,
      provider_id,
      provider_name,
      rate,
      revenue,
      cost_ev,
      CASE WHEN is_jumlo THEN revenue * (intake_rate - payout_rate) / 100.0
           ELSE revenue - cost_ev END AS profit,
      CASE WHEN is_jumlo THEN revenue * (intake_rate - payout_rate) / 100.0
           ELSE revenue - cost_ev END AS profit_ev
    FROM base
  ), grouped AS (
    SELECT
      CASE WHEN p_group_by = 'day' THEN day_date::text ELSE provider_id::text END AS group_key,
      CASE WHEN p_group_by = 'day' THEN day_date::text ELSE provider_name END AS label,
      CASE WHEN p_group_by = 'day' THEN NULL ELSE provider_id END AS provider_id,
      CASE WHEN p_group_by = 'day' THEN NULL ELSE MAX(rate) END AS rate,
      COUNT(*)::int AS orders,
      ROUND(SUM(revenue), 2) AS revenue,
      ROUND(SUM(cost_ev), 2) AS cost,
      ROUND(SUM(profit), 2) AS profit,
      ROUND(SUM(profit_ev), 2) AS profit_ev
    FROM calc
    GROUP BY 1, 2, 3
  )
  SELECT to_jsonb(grouped.*) FROM grouped ORDER BY grouped.label;
$function$;