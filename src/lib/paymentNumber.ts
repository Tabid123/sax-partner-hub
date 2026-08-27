import { supabase } from '@/integrations/supabase/client';

/** Last-resort text shown only when no tenant/provider number is configured. */
export const DEFAULT_PAYMENT_NUMBER = 'Lambarka lacag-bixinta lama dejiyin';

/** Returns the first non-empty payment number from the given candidates. */
export function pickPaymentNumber(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const v = (c ?? '').trim();
    if (v) return v;
  }
  return DEFAULT_PAYMENT_NUMBER;
}

/**
 * Fetches the tenant-scoped payment number configured on the data provider
 * (providers_config.payment_number) through the public security-definer RPC.
 */
export async function fetchProviderPaymentNumber(
  providerId: string | null | undefined,
  tenantId: string | null | undefined,
): Promise<string | null> {
  if (!providerId) return null;
  const { data, error } = await supabase.rpc('get_active_providers', { p_tenant_id: tenantId ?? null });
  if (error || !data) return null;
  const row = (data as any[]).find((p) => p.id === providerId);
  const num = (row?.payment_number ?? '').toString().trim();
  return num || null;
}
