-- RLS / integration tests for tenant_providers
-- Run in Supabase SQL editor. Prints one row per assertion.
-- Safe: creates a throwaway tenant + rows and cleans them up at the end.

DROP TABLE IF EXISTS _tp_results;
CREATE TEMP TABLE _tp_results(name text, passed boolean, detail text);

DO $$
DECLARE
  v_tenant_a uuid;
  v_manager_a uuid;
  v_tenant_b uuid;
  v_provider uuid;
  v_provider2 uuid;
  v_cnt int;
  v_err text;
BEGIN
  SELECT tm.tenant_id, tm.user_id INTO v_tenant_a, v_manager_a
  FROM tenant_members tm WHERE tm.role IN ('owner','admin') LIMIT 1;

  IF v_tenant_a IS NULL THEN
    INSERT INTO _tp_results VALUES ('setup', false, 'no tenant manager found');
    RETURN;
  END IF;

  SELECT id INTO v_provider FROM providers_config WHERE tenant_id IS NULL ORDER BY display_order LIMIT 1;
  SELECT id INTO v_provider2 FROM providers_config WHERE tenant_id IS NULL AND id <> v_provider ORDER BY display_order LIMIT 1;

  -- throwaway foreign tenant
  INSERT INTO tenants(slug, name, status, plan)
  VALUES ('rls-test-'||substr(gen_random_uuid()::text,1,8), 'RLS Test Tenant', 'trial', 'trial')
  RETURNING id INTO v_tenant_b;

  -- impersonate the tenant A manager
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a, 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1. manager can enable a provider for their OWN tenant
  BEGIN
    INSERT INTO tenant_providers(tenant_id, provider_id, is_enabled)
    VALUES (v_tenant_a, v_provider, true)
    ON CONFLICT (tenant_id, provider_id) DO UPDATE SET is_enabled = true;
    INSERT INTO _tp_results VALUES ('manager can insert own tenant provider', true, null);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO _tp_results VALUES ('manager can insert own tenant provider', false, v_err);
  END;

  -- 2. manager CANNOT enable a provider for a foreign tenant
  BEGIN
    INSERT INTO tenant_providers(tenant_id, provider_id, is_enabled)
    VALUES (v_tenant_b, v_provider, true);
    INSERT INTO _tp_results VALUES ('manager blocked from foreign tenant insert', false, 'insert unexpectedly succeeded');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO _tp_results VALUES ('manager blocked from foreign tenant insert', true, v_err);
  END;

  -- 3. manager CANNOT update a foreign tenant row (insert it as owner first)
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO tenant_providers(tenant_id, provider_id, is_enabled)
  VALUES (v_tenant_b, v_provider, true) ON CONFLICT DO NOTHING;
  PERFORM set_config('role', 'authenticated', true);

  UPDATE tenant_providers SET is_enabled = false
  WHERE tenant_id = v_tenant_b AND provider_id = v_provider;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  INSERT INTO _tp_results VALUES ('manager blocked from foreign tenant update', v_cnt = 0, 'rows updated: '||v_cnt);

  -- 4. storefront RPC shows only providers enabled for the tenant
  PERFORM set_config('role', 'anon', true);
  SELECT count(*) INTO v_cnt FROM get_active_providers(v_tenant_a);
  INSERT INTO _tp_results
  VALUES ('get_active_providers(tenant A) returns enabled providers', v_cnt > 0, 'count: '||v_cnt);

  SELECT count(*) INTO v_cnt
  FROM get_active_providers(v_tenant_a) g
  WHERE NOT EXISTS (
    SELECT 1 FROM tenant_providers tp
    WHERE tp.tenant_id = v_tenant_a AND tp.provider_id = g.id AND tp.is_enabled
  );
  INSERT INTO _tp_results
  VALUES ('no provider leaks without a tenant_providers row', v_cnt = 0, 'leaked: '||v_cnt);

  -- 5. a brand new tenant sees NOTHING (all providers off by default)
  SELECT count(*) INTO v_cnt FROM get_active_providers(v_tenant_b);
  INSERT INTO _tp_results
  VALUES ('new tenant starts with providers disabled', v_cnt = 0, 'count: '||v_cnt);

  -- 6. tenant A does not see tenant B overrides and vice versa
  PERFORM set_config('role', 'postgres', true);
  IF v_provider2 IS NOT NULL THEN
    INSERT INTO tenant_providers(tenant_id, provider_id, is_enabled, payment_number)
    VALUES (v_tenant_b, v_provider2, true, '999999999') ON CONFLICT DO NOTHING;
    PERFORM set_config('role', 'anon', true);
    SELECT count(*) INTO v_cnt FROM get_active_providers(v_tenant_a) WHERE payment_number = '999999999';
    INSERT INTO _tp_results
    VALUES ('tenant B payment_number override does not bleed into tenant A', v_cnt = 0, 'matches: '||v_cnt);
  END IF;

  -- 7. global catalog stays tenant-less
  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO v_cnt FROM providers_config WHERE tenant_id IS NOT NULL;
  INSERT INTO _tp_results VALUES ('providers_config stays system-wide (tenant_id NULL)', v_cnt = 0, 'tenant-scoped rows: '||v_cnt);

  -- cleanup
  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM tenant_providers WHERE tenant_id = v_tenant_b;
  DELETE FROM tenants WHERE id = v_tenant_b;
END $$;

SELECT name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail FROM _tp_results;
