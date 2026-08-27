CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_all boolean;
  v_tid uuid;
  v_day_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
BEGIN
  v_all := public.is_super_admin(auth.uid());
  v_tid := public.current_tenant_id();
  v_day_start := ((now() AT TIME ZONE 'Africa/Mogadishu')::date)::timestamp AT TIME ZONE 'Africa/Mogadishu';
  v_week_start := v_day_start - (((EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Africa/Mogadishu')))::int - 1) || ' days')::interval;
  v_month_start := (date_trunc('month', now() AT TIME ZONE 'Africa/Mogadishu'))::timestamp AT TIME ZONE 'Africa/Mogadishu';

  RETURN (
    WITH base AS (
      SELECT o.selling_price, o.status, o.delivery_status, o.created_at,
             COALESCE(dp.cost_price, 0)::numeric AS package_cost,
             (wt.id IS NOT NULL) AS is_jumlo,
             COALESCE(wt.intake_rate, 0)::numeric AS intake_rate,
             COALESCE(wt.payout_rate, 0)::numeric AS payout_rate
      FROM public.orders o
      LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
      LEFT JOIN public.pending_online_payments pop ON pop.id = o.intent_id
      LEFT JOIN public.provider_wholesale_tiers wt ON wt.id = pop.tier_id
      WHERE o.delivery_status <> 'cancelled'
        AND (v_all OR o.tenant_id = v_tid)
    ),
    per AS (
      SELECT
        b.created_at >= v_day_start AS in_today,
        b.created_at >= v_week_start AS in_week,
        b.created_at >= v_month_start AS in_month,
        b.selling_price AS revenue,
        CASE WHEN b.is_jumlo THEN b.selling_price - b.selling_price * (b.intake_rate - b.payout_rate) / 100.0
             ELSE b.package_cost END AS cost,
        CASE WHEN b.is_jumlo THEN b.selling_price * (b.intake_rate - b.payout_rate) / 100.0
             ELSE b.selling_price - b.package_cost END AS profit,
        (b.status = 'pending') AS is_pending,
        (b.status = 'failed' OR b.delivery_status = 'failed') AS is_failed,
        (b.delivery_status IN ('delivered', 'completed')) AS is_delivered
      FROM base b
    )
    SELECT jsonb_build_object(
      'today', (SELECT jsonb_build_object(
        'orders', COUNT(*),
        'revenue', COALESCE(SUM(revenue), 0),
        'cost', COALESCE(SUM(cost), 0),
        'profit', COALESCE(SUM(profit), 0),
        'pending', COUNT(*) FILTER (WHERE is_pending),
        'failed', COUNT(*) FILTER (WHERE is_failed),
        'delivered', COUNT(*) FILTER (WHERE is_delivered)
      ) FROM per WHERE in_today),
      'week', (SELECT jsonb_build_object(
        'orders', COUNT(*),
        'revenue', COALESCE(SUM(revenue), 0),
        'cost', COALESCE(SUM(cost), 0),
        'profit', COALESCE(SUM(profit), 0),
        'pending', COUNT(*) FILTER (WHERE is_pending),
        'failed', COUNT(*) FILTER (WHERE is_failed),
        'delivered', COUNT(*) FILTER (WHERE is_delivered)
      ) FROM per WHERE in_week),
      'month', (SELECT jsonb_build_object(
        'orders', COUNT(*),
        'revenue', COALESCE(SUM(revenue), 0),
        'cost', COALESCE(SUM(cost), 0),
        'profit', COALESCE(SUM(profit), 0),
        'pending', COUNT(*) FILTER (WHERE is_pending),
        'failed', COUNT(*) FILTER (WHERE is_failed),
        'delivered', COUNT(*) FILTER (WHERE is_delivered)
      ) FROM per WHERE in_month),
      'total_orders', (SELECT COUNT(*) FROM per),
      'total_revenue', COALESCE((SELECT SUM(revenue) FROM per), 0),
      'total_cost', COALESCE((SELECT SUM(cost) FROM per), 0),
      'total_profit', COALESCE((SELECT SUM(profit) FROM per), 0),
      'pending_orders', (SELECT COUNT(*) FROM per WHERE is_pending),
      'failed_orders', (SELECT COUNT(*) FROM per WHERE is_failed),
      'delivered_orders', (SELECT COUNT(*) FROM per WHERE is_delivered),
      'completed_orders', (SELECT COUNT(*) FROM per WHERE is_delivered)
    )
  );
END;
$function$;