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
             COALESCE(dp.cost_price, 0) AS cost_price,
             COALESCE(pc.evoucher_rate, 0) AS evoucher_rate
      FROM public.orders o
      LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
      LEFT JOIN public.providers_config pc ON pc.id = o.provider_id
      WHERE o.delivery_status <> 'cancelled'
        AND (v_all OR o.tenant_id = v_tid)
    ),
    per AS (
      SELECT
        b.created_at >= v_day_start AS in_today,
        b.created_at >= v_week_start AS in_week,
        b.created_at >= v_month_start AS in_month,
        b.selling_price AS revenue,
        b.cost_price AS cost,
        (b.selling_price + b.selling_price * b.evoucher_rate - b.cost_price) AS profit,
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;