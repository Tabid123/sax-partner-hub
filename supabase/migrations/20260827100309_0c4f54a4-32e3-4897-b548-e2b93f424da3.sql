
ALTER TABLE public.providers_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.data_packages_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.delivery_instructions ALTER COLUMN tenant_id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.force_global_catalog_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.tenant_id := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_global_tenant ON public.providers_config;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.providers_config
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

DROP TRIGGER IF EXISTS force_global_tenant ON public.data_packages_config;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.data_packages_config
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

DROP TRIGGER IF EXISTS force_global_tenant ON public.delivery_instructions;
CREATE TRIGGER force_global_tenant BEFORE INSERT OR UPDATE ON public.delivery_instructions
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

UPDATE public.providers_config SET tenant_id = NULL WHERE tenant_id IS NOT NULL;
UPDATE public.data_packages_config SET tenant_id = NULL WHERE tenant_id IS NOT NULL;
UPDATE public.delivery_instructions SET tenant_id = NULL WHERE tenant_id IS NOT NULL;

-- read + manage policies for global catalog
DROP POLICY IF EXISTS "public read packages" ON public.data_packages_config;
DROP POLICY IF EXISTS "tenant members manage packages" ON public.data_packages_config;
DROP POLICY IF EXISTS "tenant managers manage data_packages_config" ON public.data_packages_config;
CREATE POLICY "read global packages" ON public.data_packages_config FOR SELECT USING (true);
CREATE POLICY "super admins manage packages" ON public.data_packages_config FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "tenant members manage providers" ON public.providers_config;
DROP POLICY IF EXISTS "tenant managers manage providers_config" ON public.providers_config;
CREATE POLICY "read global providers" ON public.providers_config FOR SELECT USING (true);
CREATE POLICY "super admins manage providers" ON public.providers_config FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "tenant members read delivery instructions" ON public.delivery_instructions;
DROP POLICY IF EXISTS "tenant managers manage delivery_instructions" ON public.delivery_instructions;
DROP POLICY IF EXISTS "admin all delivery_instructions" ON public.delivery_instructions;
CREATE POLICY "read global delivery instructions" ON public.delivery_instructions FOR SELECT USING (true);
CREATE POLICY "super admins manage delivery instructions" ON public.delivery_instructions FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.providers_config TO anon, authenticated;
GRANT SELECT ON public.data_packages_config TO anon, authenticated;
GRANT SELECT ON public.delivery_instructions TO anon, authenticated;

-- keep tenant deletion from removing global catalog rows
ALTER TABLE public.providers_config DROP CONSTRAINT IF EXISTS providers_config_tenant_id_fkey;
ALTER TABLE public.providers_config ADD CONSTRAINT providers_config_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.data_packages_config DROP CONSTRAINT IF EXISTS data_packages_config_tenant_id_fkey;
ALTER TABLE public.data_packages_config ADD CONSTRAINT data_packages_config_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_instructions DROP CONSTRAINT IF EXISTS delivery_instructions_tenant_id_fkey;
ALTER TABLE public.delivery_instructions ADD CONSTRAINT delivery_instructions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

-- storefront RPCs must return the global catalog
CREATE OR REPLACE FUNCTION public.get_active_providers(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF providers_config LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.providers_config
  WHERE is_active = true
  ORDER BY display_order, provider_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_packages(provider_uuid uuid, p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF data_packages_config LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.data_packages_config
  WHERE is_active = true AND provider_id = provider_uuid
  ORDER BY selling_price;
$function$;

CREATE OR REPLACE FUNCTION public.get_featured_packages(p_tenant_id uuid DEFAULT NULL::uuid)
RETURNS SETOF data_packages_config LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.* FROM public.data_packages_config p
  JOIN public.featured_packages f ON f.package_id = p.id
  WHERE f.is_active = true AND p.is_active = true
    AND (f.tenant_id IS NULL OR f.tenant_id = public.resolve_public_tenant(p_tenant_id))
  ORDER BY f.display_order;
$function$;
