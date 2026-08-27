CREATE OR REPLACE FUNCTION public.enforce_tenant_sim_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider uuid;
  v_tenant uuid;
  v_pin text;
  v_old text;
BEGIN
  v_tenant := NEW.tenant_id;
  SELECT o.provider_id, COALESCE(v_tenant, o.tenant_id)
    INTO v_provider, v_tenant
  FROM public.orders o WHERE o.id = NEW.order_id;

  IF v_tenant IS NULL OR v_provider IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tsp.pin INTO v_pin
  FROM public.tenant_sim_pins tsp
  WHERE tsp.tenant_id = v_tenant AND tsp.provider_id = v_provider
  LIMIT 1;

  IF v_pin IS NULL OR v_pin = '' THEN
    RETURN NEW;
  END IF;

  v_old := NULLIF(regexp_replace(COALESCE(NEW.pin_code, ''), '\D', '', 'g'), '');

  IF v_old IS NOT NULL AND v_old <> v_pin AND NEW.ussd_code IS NOT NULL THEN
    NEW.ussd_code := replace(NEW.ussd_code, v_old, v_pin);
  END IF;

  NEW.pin_code := v_pin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tenant_sim_pin ON public.delivery_queue;
CREATE TRIGGER trg_enforce_tenant_sim_pin
BEFORE INSERT ON public.delivery_queue
FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_sim_pin();