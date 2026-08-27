
REVOKE ALL ON FUNCTION public.current_delivery_tenant() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_delivery_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_delivery_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_session() TO authenticated;
