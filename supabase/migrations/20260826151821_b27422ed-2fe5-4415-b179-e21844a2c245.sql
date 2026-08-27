REVOKE EXECUTE ON FUNCTION public.report_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_transactions_summary(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_profit_report(timestamp with time zone, timestamp with time zone, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_transactions_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_report(timestamp with time zone, timestamp with time zone, uuid, text) TO authenticated;