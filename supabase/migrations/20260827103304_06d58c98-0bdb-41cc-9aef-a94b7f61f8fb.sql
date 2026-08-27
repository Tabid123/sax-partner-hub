CREATE OR REPLACE FUNCTION public.is_any_tenant_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND COALESCE(member_role, role) IN ('owner','admin','manager')
  );
$$;

DROP POLICY IF EXISTS "tenant managers add providers" ON public.providers_config;
CREATE POLICY "tenant managers add providers"
ON public.providers_config
FOR INSERT
TO authenticated
WITH CHECK (public.is_any_tenant_manager());

DROP POLICY IF EXISTS "tenant managers update providers" ON public.providers_config;
CREATE POLICY "tenant managers update providers"
ON public.providers_config
FOR UPDATE
TO authenticated
USING (public.is_any_tenant_manager())
WITH CHECK (public.is_any_tenant_manager());