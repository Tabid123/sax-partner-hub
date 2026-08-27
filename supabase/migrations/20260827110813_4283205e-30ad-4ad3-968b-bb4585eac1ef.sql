DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tenant_providers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_providers;
  END IF;
END
$$;