REVOKE EXECUTE ON FUNCTION public.derive_pending_payment_tenant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.derive_order_tenant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.derive_delivery_queue_tenant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_receipt_tenant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.derive_device_tenant() FROM anon, authenticated, public;