CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.current_tenant_id(),
    (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1)
  )
$$;

GRANT EXECUTE ON FUNCTION public.default_tenant_id() TO anon, authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND c.column_default = '''2266d453-4132-4e32-9bf7-eac45db9e325''::uuid'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id()', r.table_name);
  END LOOP;
END $$;