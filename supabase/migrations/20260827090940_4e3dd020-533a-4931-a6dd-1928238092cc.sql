-- The oldest-tenant fallback caused every unattributed row (edge functions run
-- as service_role, so current_tenant_id() is NULL) to land on the first tenant.
CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.current_tenant_id()
$function$;

-- Same rule for the BEFORE INSERT trigger: never guess a tenant.
CREATE OR REPLACE FUNCTION public.set_tenant_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$function$;