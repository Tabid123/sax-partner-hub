CREATE OR REPLACE FUNCTION public.get_profit_report(
  p_start timestamptz,
  p_end timestamptz,
  p_provider_id uuid DEFAULT NULL,
  p_group_by text DEFAULT 'provider'
)
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
      COALESCE(pr.evoucher_rate, 0)::numeric AS rate,
      COALESCE(o.selling_price, 0)::numeric AS revenue,
      COALESCE(dp.cost_price, pop.topup_amount, 0)::numeric AS cost_ev
    FROM public.orders o
    JOIN public.providers_config pr ON pr.id = o.provider_id
    LEFT JOIN public.data_packages_config dp ON dp.id = o.package_id
    LEFT JOIN public.pending_online_payments pop ON pop.id = o.intent_id
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
      (revenue - cost_ev / (1 + rate)) AS profit,
      (revenue - cost_ev / (1 + rate)) * (1 + rate) AS profit_ev
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

GRANT EXECUTE ON FUNCTION public.get_profit_report(timestamptz, timestamptz, uuid, text) TO authenticated, service_role;