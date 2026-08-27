# Tenant isolation tests

## 1. RLS / integration (database)

`tests/rls/tenant_providers.test.sql` — paste into the Supabase SQL editor and run.
It creates a throwaway tenant, impersonates a real tenant manager, and asserts:

- a new tenant starts with **all** providers disabled
- a manager can enable providers for **their own** tenant only
- insert / update / delete against another tenant are blocked by RLS
- `get_active_providers(tenant)` returns only providers with an enabled
  `tenant_providers` row, and never leaks another tenant's `payment_number`
- `providers_config` stays system-wide (`tenant_id IS NULL`)

Last run: 10/10 PASS.

## 2. E2E (storefront link)

`tests/e2e/tenant-storefront.spec.py` — requires the dev server on `:8080`.

```bash
python3 tests/e2e/tenant-storefront.spec.py
```

Asserts that `/?t=<slug>` loads the tenant (no infinite spinner, no
"Shirkad lama helin"), shows exactly that tenant's enabled companies, produces no
React render-loop error, and that an unknown slug shows an error without leaking
another tenant's data.

Last run: 10/10 PASS.
