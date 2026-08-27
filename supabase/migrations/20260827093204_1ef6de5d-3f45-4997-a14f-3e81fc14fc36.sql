-- 1) Stop tenant deletion from wiping shared USSD flows
ALTER TABLE public.ussd_flows DROP CONSTRAINT IF EXISTS ussd_flows_tenant_id_fkey;
ALTER TABLE public.ussd_flows
  ADD CONSTRAINT ussd_flows_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.ussd_flow_steps DROP CONSTRAINT IF EXISTS ussd_flow_steps_tenant_id_fkey;
ALTER TABLE public.ussd_flow_steps
  ADD CONSTRAINT ussd_flow_steps_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.ussd_unmatched_dialogs DROP CONSTRAINT IF EXISTS ussd_unmatched_dialogs_tenant_id_fkey;
ALTER TABLE public.ussd_unmatched_dialogs
  ADD CONSTRAINT ussd_unmatched_dialogs_tenant_id_fkey FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 2) Make existing flows global (shared across tenants)
UPDATE public.ussd_flows SET tenant_id = NULL WHERE tenant_id IS NOT NULL;
UPDATE public.ussd_flow_steps SET tenant_id = NULL WHERE tenant_id IS NOT NULL;

-- 3) Restore Somnet *825# steps (PIN first)
DO $$
DECLARE v_flow uuid;
BEGIN
  SELECT id INTO v_flow FROM public.ussd_flows WHERE trigger_code = '*825#' ORDER BY created_at LIMIT 1;
  IF v_flow IS NOT NULL THEN
    DELETE FROM public.ussd_flow_steps WHERE flow_id = v_flow;
    INSERT INTO public.ussd_flow_steps (flow_id, step_order, match_keywords, response_template, is_pin_field) VALUES
      (v_flow, 1, ARRAY['pin','sirta','sir','furaha','password','secret','geli pin','pin-kaaga','geli furaha','enter pin'], '{pin}', true),
      (v_flow, 2, ARRAY['dirid','lacag','lacagta','amount','qiime','qiimo','send money','send'], '2', false),
      (v_flow, 3, ARRAY['geli mobile','mobile-ka','mobilka','mobile','lambarka','taleefan','number'], '{receiver}', false),
      (v_flow, 4, ARRAY['hubi mobil','hubi','confirm number','xaqiiji lambarka'], '{receiver}', false),
      (v_flow, 5, ARRAY['geli lacagta','lacagta','amount','qiimaha','enter amount'], '{amount}', false),
      (v_flow, 6, ARRAY['haa','ma hubtaa','confirm','xaqiiji','yes'], '1', false);
  END IF;
END $$;

-- 4) Rebuild Amtel *930# steps (same shape as Somnet)
DO $$
DECLARE v_flow uuid;
BEGIN
  SELECT id INTO v_flow FROM public.ussd_flows WHERE trigger_code = '*930#' ORDER BY created_at LIMIT 1;
  IF v_flow IS NOT NULL THEN
    DELETE FROM public.ussd_flow_steps WHERE flow_id = v_flow;
    INSERT INTO public.ussd_flow_steps (flow_id, step_order, match_keywords, response_template, is_pin_field) VALUES
      (v_flow, 1, ARRAY['pin','sirta','sir','furaha','password','secret','geli pin','pin-kaaga','geli furaha','enter pin'], '{pin}', true),
      (v_flow, 2, ARRAY['dirid','lacag','lacagta','amount','qiime','qiimo','send money','send'], '2', false),
      (v_flow, 3, ARRAY['geli mobile','mobile-ka','mobilka','mobile','lambarka','taleefan','number'], '{receiver}', false),
      (v_flow, 4, ARRAY['hubi mobil','hubi','confirm number','xaqiiji lambarka'], '{receiver}', false),
      (v_flow, 5, ARRAY['geli lacagta','lacagta','amount','qiimaha','enter amount'], '{amount}', false),
      (v_flow, 6, ARRAY['haa','ma hubtaa','confirm','xaqiiji','yes'], '1', false);
  END IF;
END $$;