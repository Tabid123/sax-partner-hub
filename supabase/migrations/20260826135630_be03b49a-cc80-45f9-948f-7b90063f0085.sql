ALTER TABLE public.provider_wholesale_tiers
  ADD COLUMN IF NOT EXISTS intake_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_rate numeric NOT NULL DEFAULT 0;

UPDATE public.provider_wholesale_tiers
  SET intake_rate = COALESCE(profit_rate, 0),
      payout_rate = 0
  WHERE intake_rate = 0 AND payout_rate = 0;

DROP VIEW IF EXISTS public.customer_wholesale_tiers;

CREATE VIEW public.customer_wholesale_tiers
WITH (security_invoker = on) AS
SELECT
  id, provider_id, tier_name, min_amount, max_amount,
  profit_rate, is_active, display_order, created_at, updated_at, tenant_id,
  intake_rate, payout_rate
FROM public.provider_wholesale_tiers
WHERE is_active = true
  AND tenant_id = public.resolve_public_tenant();

GRANT SELECT ON public.customer_wholesale_tiers TO authenticated;
GRANT SELECT ON public.customer_wholesale_tiers TO anon;
GRANT ALL ON public.customer_wholesale_tiers TO service_role;