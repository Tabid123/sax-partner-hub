CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug text)
RETURNS TABLE(id uuid, slug text, name text, logo_url text, primary_color text, contact_phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.slug, t.name, t.logo_url, t.primary_color, t.contact_phone
  FROM public.tenants t
  WHERE lower(t.slug) = lower(trim(_slug))
    AND t.status IN ('active', 'trial');
$$;

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

DROP TRIGGER IF EXISTS force_global_provider_tenant ON public.providers_config;
CREATE TRIGGER force_global_provider_tenant
BEFORE INSERT OR UPDATE OF tenant_id ON public.providers_config
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

DROP TRIGGER IF EXISTS force_global_package_tenant ON public.data_packages_config;
CREATE TRIGGER force_global_package_tenant
BEFORE INSERT OR UPDATE OF tenant_id ON public.data_packages_config
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

DROP TRIGGER IF EXISTS force_global_instruction_tenant ON public.delivery_instructions;
CREATE TRIGGER force_global_instruction_tenant
BEFORE INSERT OR UPDATE OF tenant_id ON public.delivery_instructions
FOR EACH ROW EXECUTE FUNCTION public.force_global_catalog_tenant();

ALTER TABLE public.providers_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.data_packages_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.delivery_instructions ALTER COLUMN tenant_id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.clone_tenant_providers(
  _target_tenant uuid,
  _provider_names text[],
  _source_slug text DEFAULT 'iftin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked integer := 0;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _target_tenant) THEN
    RAISE EXCEPTION 'target tenant not found';
  END IF;

  IF _provider_names IS NULL OR array_length(_provider_names, 1) IS NULL THEN
    RAISE EXCEPTION 'no providers selected';
  END IF;

  INSERT INTO public.tenant_providers (tenant_id, provider_id, is_enabled)
  SELECT _target_tenant, p.id, true
  FROM public.providers_config p
  WHERE p.tenant_id IS NULL
    AND lower(p.provider_name) = ANY (
      SELECT lower(trim(provider_name)) FROM unnest(_provider_names) AS provider_name
    )
  ON CONFLICT (tenant_id, provider_id)
  DO UPDATE SET is_enabled = true, updated_at = now();

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN jsonb_build_object(
    'providers', v_linked,
    'categories', 0,
    'packages', 0,
    'flows', 0,
    'payment_providers', 0,
    'tiers', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_tenant_providers(uuid, text[], text) TO authenticated, service_role;