CREATE OR REPLACE FUNCTION public.get_admin_transactions_summary(p_provider_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'all'::text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.selling_price,
           COALESCE(dp.cost_price, 0) AS cost_price,
           COALESCE(pc.evoucher_rate, 0) AS evoucher_rate,
           o.created_at
    FROM public.orders o
    LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
    LEFT JOIN public.providers_config pc ON pc.id = o.provider_id
    WHERE o.delivery_status <> 'cancelled'
      AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
      AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
  ),
  scoped AS (
    SELECT * FROM base
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
    'transactions_today', (SELECT COUNT(*) FROM base WHERE created_at >= date_trunc('day', now())),
    'sales_today', COALESCE((SELECT SUM(selling_price) FROM base WHERE created_at >= date_trunc('day', now())), 0),
    'cost_today', COALESCE((SELECT SUM(cost_price) FROM base WHERE created_at >= date_trunc('day', now())), 0),
    'sales_this_month', COALESCE((SELECT SUM(selling_price) FROM base WHERE created_at >= date_trunc('month', now())), 0),
    'cost_this_month', COALESCE((SELECT SUM(cost_price) FROM base WHERE created_at >= date_trunc('month', now())), 0),
    'total_profit', COALESCE((SELECT SUM(selling_price + selling_price * evoucher_rate - cost_price) FROM scoped), 0),
    'cost_period', COALESCE((SELECT SUM(cost_price) FROM scoped), 0)
  );
$function$;