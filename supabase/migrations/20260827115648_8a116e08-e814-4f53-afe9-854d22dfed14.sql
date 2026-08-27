CREATE TABLE IF NOT EXISTS public.tenant_sim_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers_config(id) ON DELETE CASCADE,
  pin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_sim_pins TO authenticated;
GRANT ALL ON public.tenant_sim_pins TO service_role;

ALTER TABLE public.tenant_sim_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant managers manage their sim pins" ON public.tenant_sim_pins;
CREATE POLICY "tenant managers manage their sim pins"
ON public.tenant_sim_pins FOR ALL TO authenticated
USING (public.is_tenant_manager(tenant_id) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_tenant_manager(tenant_id) OR public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_tenant_sim_pins_updated ON public.tenant_sim_pins;
CREATE TRIGGER trg_tenant_sim_pins_updated
BEFORE UPDATE ON public.tenant_sim_pins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.auto_fill_pin_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider uuid;
  v_tenant uuid;
BEGIN
  IF NEW.pin_code IS NULL THEN
    SELECT o.provider_id, COALESCE(NEW.tenant_id, o.tenant_id)
      INTO v_provider, v_tenant
    FROM public.orders o WHERE o.id = NEW.order_id;

    IF v_tenant IS NOT NULL THEN
      SELECT tsp.pin INTO NEW.pin_code
      FROM public.tenant_sim_pins tsp
      WHERE tsp.tenant_id = v_tenant AND tsp.provider_id = v_provider
      LIMIT 1;
    END IF;

    IF NEW.pin_code IS NULL THEN
      SELECT di.sim_password INTO NEW.pin_code
      FROM public.delivery_instructions di
      WHERE di.provider_id = v_provider
        AND di.sim_password IS NOT NULL
        AND (v_tenant IS NULL OR di.tenant_id = v_tenant OR di.tenant_id IS NULL)
      ORDER BY (di.tenant_id = v_tenant) DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;