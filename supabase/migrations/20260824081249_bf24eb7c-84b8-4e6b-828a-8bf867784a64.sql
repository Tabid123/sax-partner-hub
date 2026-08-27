REVOKE EXECUTE ON FUNCTION public.get_admin_analytics_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_transactions_paginated(text, text, uuid, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_transactions_summary(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_date_range_breakdown(timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_provider_daily_stats(date) FROM anon;