CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH scope AS (SELECT public.is_super_admin(auth.uid()) AS all_access, public.current_tenant_id() AS tid)
  SELECT jsonb_build_object(
    'total_orders', (SELECT COUNT(*) FROM public.orders o, scope s WHERE o.delivery_status <> 'cancelled' AND (s.all_access OR o.tenant_id = s.tid)),
    'total_revenue', COALESCE((SELECT SUM(o.selling_price) FROM public.orders o, scope s WHERE o.delivery_status <> 'cancelled' AND (s.all_access OR o.tenant_id = s.tid)), 0),
    'total_profit', 0,
    'pending_orders', (SELECT COUNT(*) FROM public.orders o, scope s WHERE o.status = 'pending' AND (s.all_access OR o.tenant_id = s.tid)),
    'completed_orders', (SELECT COUNT(*) FROM public.orders o, scope s WHERE o.delivery_status = 'completed' AND (s.all_access OR o.tenant_id = s.tid))
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_transactions_paginated(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_provider_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT to_jsonb(o.*)
  FROM public.orders o
  WHERE o.delivery_status <> 'cancelled'
    AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
    AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
    AND (p_status IS NULL OR p_status = 'all' OR o.status = p_status)
    AND (p_search IS NULL OR o.customer_phone ILIKE '%'||p_search||'%' OR o.receiver_phone ILIKE '%'||p_search||'%')
  ORDER BY o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_transactions_summary(p_provider_id uuid DEFAULT NULL::uuid, p_period text DEFAULT 'all'::text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT jsonb_build_object('count', COUNT(*), 'total', COALESCE(SUM(selling_price), 0))
  FROM public.orders
  WHERE delivery_status <> 'cancelled'
    AND (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
    AND (p_provider_id IS NULL OR provider_id = p_provider_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_date_range_breakdown(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_provider_id uuid DEFAULT NULL::uuid)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH agg AS (
    SELECT (o.created_at AT TIME ZONE 'Africa/Mogadishu')::date AS date,
           o.provider_id,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(o.selling_price), 0) AS revenue
    FROM public.orders o
    WHERE o.delivery_status <> 'cancelled'
      AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
      AND o.created_at >= p_start_date AND o.created_at <= p_end_date
      AND (p_provider_id IS NULL OR o.provider_id = p_provider_id)
    GROUP BY 1, 2
  )
  SELECT to_jsonb(agg.*) FROM agg ORDER BY agg.date;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_provider_daily_stats(p_date date DEFAULT ((now() AT TIME ZONE 'Africa/Mogadishu'::text))::date)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH agg AS (
    SELECT pr.id AS provider_id, pr.provider_name, pr.evoucher_rate,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(o.selling_price), 0) AS revenue
    FROM public.providers_config pr
    LEFT JOIN public.orders o
      ON o.provider_id = pr.id
     AND o.delivery_status <> 'cancelled'
     AND (public.is_super_admin(auth.uid()) OR o.tenant_id = public.current_tenant_id())
     AND (o.created_at AT TIME ZONE 'Africa/Mogadishu')::date = p_date
    WHERE pr.is_active = true
      AND (public.is_super_admin(auth.uid()) OR pr.tenant_id = public.current_tenant_id())
    GROUP BY pr.id, pr.provider_name, pr.evoucher_rate
  )
  SELECT to_jsonb(agg.*) FROM agg ORDER BY agg.provider_name;
$function$;