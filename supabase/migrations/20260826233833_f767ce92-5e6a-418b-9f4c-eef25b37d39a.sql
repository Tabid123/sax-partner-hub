-- 1) pending_online_payments: derive tenant from provider / package / tier
CREATE OR REPLACE FUNCTION public.derive_pending_payment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v uuid;
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.providers_config WHERE id = NEW.provider_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.data_packages_config WHERE id = NEW.package_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.tier_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.provider_wholesale_tiers WHERE id = NEW.tier_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.resolve_public_tenant(public.current_tenant_id());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_payments_tenant ON public.pending_online_payments;
CREATE TRIGGER trg_pending_payments_tenant
BEFORE INSERT ON public.pending_online_payments
FOR EACH ROW EXECUTE FUNCTION public.derive_pending_payment_tenant();

-- 2) orders: derive tenant from intent / provider / package
CREATE OR REPLACE FUNCTION public.derive_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v uuid;
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.intent_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.pending_online_payments WHERE id = NEW.intent_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.provider_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.providers_config WHERE id = NEW.provider_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.data_packages_config WHERE id = NEW.package_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.resolve_public_tenant(public.current_tenant_id());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_tenant ON public.orders;
CREATE TRIGGER trg_orders_tenant
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.derive_order_tenant();

-- 3) delivery_queue: derive tenant from the order
CREATE OR REPLACE FUNCTION public.derive_delivery_queue_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v uuid;
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.orders WHERE id = NEW.order_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  IF NEW.tenant_id IS NULL AND NEW.android_device_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.android_devices WHERE device_id = NEW.android_device_id;
    NEW.tenant_id := COALESCE(NEW.tenant_id, v);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_queue_tenant ON public.delivery_queue;
CREATE TRIGGER trg_delivery_queue_tenant
BEFORE INSERT ON public.delivery_queue
FOR EACH ROW EXECUTE FUNCTION public.derive_delivery_queue_tenant();

-- 4) payment_receipts: when matched to an order, follow that order's tenant
CREATE OR REPLACE FUNCTION public.sync_receipt_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v uuid;
BEGIN
  IF NEW.matched_order_id IS NOT NULL THEN
    SELECT tenant_id INTO v FROM public.orders WHERE id = NEW.matched_order_id;
    IF v IS NOT NULL THEN
      NEW.tenant_id := v;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_tenant_sync ON public.payment_receipts;
CREATE TRIGGER trg_receipt_tenant_sync
BEFORE INSERT OR UPDATE OF matched_order_id ON public.payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.sync_receipt_tenant();

-- 5) android_devices: never auto-attach a new device to the oldest tenant
CREATE OR REPLACE FUNCTION public.derive_device_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id(); -- NULL when unauthenticated: stays unassigned
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_android_devices_tenant ON public.android_devices;
CREATE TRIGGER trg_android_devices_tenant
BEFORE INSERT ON public.android_devices
FOR EACH ROW EXECUTE FUNCTION public.derive_device_tenant();