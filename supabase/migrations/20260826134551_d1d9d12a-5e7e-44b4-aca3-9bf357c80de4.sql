DROP FUNCTION IF EXISTS public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_admin_transactions_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT
      o.*,
      COALESCE(pkg.cost_price, 0)::numeric AS cost_price,
      COALESCE(pr.evoucher_rate, 0)::numeric AS evoucher_rate,
      COALESCE(pr.provider_name, '') AS provider_name
    FROM public.orders o
    LEFT JOIN public.data_packages_config pkg ON pkg.id = o.package_id
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
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(row_data)
      FROM (
        SELECT to_jsonb(f) AS row_data
        FROM filtered f
        ORDER BY f.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) sub
    ), '[]'::jsonb),
    'total_count', (SELECT count(*) FROM filtered),
    'total_sales', COALESCE((SELECT sum(selling_price) FROM filtered), 0),
    'total_profit', COALESCE((SELECT sum(selling_price + (selling_price * evoucher_rate) - cost_price) FROM filtered), 0)
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer) TO service_role;