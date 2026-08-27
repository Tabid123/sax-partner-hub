ALTER TABLE public.apk_builds DROP CONSTRAINT IF EXISTS apk_builds_tenant_id_fkey;
ALTER TABLE public.apk_builds
  ADD CONSTRAINT apk_builds_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE SET NULL;