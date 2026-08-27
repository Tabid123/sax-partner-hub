import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderRow {
  id: string;
  provider_name: string;
  provider_logo: string | null;
  is_active: boolean | null;
}

export default function TenantProvidersManager() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data: provs }, { data: links }] = await Promise.all([
        supabase
          .from('providers_config')
          .select('id, provider_name, provider_logo, is_active')
          .order('display_order')
          .order('provider_name'),
        supabase
          .from('tenant_providers')
          .select('provider_id, is_enabled')
          .eq('tenant_id', tenantId),
      ]);
      if (cancelled) return;
      const list = (provs ?? []) as ProviderRow[];
      const map: Record<string, boolean> = {};
      // default: everything OFF until the tenant admin turns it on
      list.forEach((p) => {
        map[p.id] = !!links?.find((l) => l.provider_id === p.id)?.is_enabled;
      });
      setProviders(list);
      setEnabled(map);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const toggle = async (providerId: string, next: boolean) => {
    if (!tenantId) return;
    setSaving(providerId);
    setEnabled((prev) => ({ ...prev, [providerId]: next }));

    // make sure every provider has an explicit row for this tenant
    const rows = providers.map((p) => ({
      tenant_id: tenantId,
      provider_id: p.id,
      is_enabled: p.id === providerId ? next : (enabled[p.id] ?? false),
    }));

    const { error } = await supabase
      .from('tenant_providers')
      .upsert(rows, { onConflict: 'tenant_id,provider_id' });

    setSaving(null);
    if (error) {
      setEnabled((prev) => ({ ...prev, [providerId]: !next }));
      toast.error('Lama badbaadin: ' + error.message);
    } else {
      toast.success(next ? 'Waa la shiday' : 'Waa la damiyay');
    }
  };

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Providers-ka Shirkadda</CardTitle>
        <CardDescription>
          Providers-ku waa kuwo system-wide ah. Halkan waxaad kaliya dooranaysaa kuwa
          macaamiishaadu arkayaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Provider lama helin.</p>
        ) : (
          providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {p.provider_logo ? (
                  <img
                    src={p.provider_logo}
                    alt={`${p.provider_name} logo`}
                    className="h-8 w-8 rounded object-contain"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.provider_name}</p>
                  {!p.is_active && (
                    <p className="text-xs text-muted-foreground">
                      System ahaan waa damin
                    </p>
                  )}
                </div>
              </div>
              <Switch
                checked={!!enabled[p.id]}
                disabled={saving === p.id || !p.is_active}
                onCheckedChange={(v) => toggle(p.id, v)}
                aria-label={`Toggle ${p.provider_name}`}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
