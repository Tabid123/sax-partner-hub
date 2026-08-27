import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Wallet, Plus, Check } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

interface ProviderRow {
  id: string;
  provider_name: string;
  provider_logo: string | null;
  out_of_balance: boolean;
  /** per-tenant */
  is_enabled: boolean;
  payment_number: string | null;
}

const ORDER = ['hormuud', 'somnet', 'somtel', 'amtel'];

export default function ResellerProviders() {
  const { currentTenantId } = useTenant();
  const [items, setItems] = useState<ProviderRow[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; provider_name: string; provider_logo: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);

    // Providers-ku waa system-wide; tenant_providers ayaa go'aaminaya kuwa la shiday.
    const [{ data: providers, error: pErr }, { data: links, error: lErr }] = await Promise.all([
      supabase
        .from('providers_config')
        .select('id, provider_name, provider_logo, out_of_balance, payment_number, display_order')
        .is('tenant_id', null)
        .eq('is_active', true),
      supabase
        .from('tenant_providers')
        .select('provider_id, is_enabled, payment_number')
        .eq('tenant_id', currentTenantId),
    ]);

    const error = pErr || lErr;
    if (error) toast({ title: 'Khalad', description: error.message, variant: 'destructive' });

    const linkMap = new Map((links ?? []).map((l: any) => [l.provider_id, l]));
    const all = (providers ?? []) as any[];

    const rows: ProviderRow[] = all
      .filter((p) => linkMap.has(p.id))
      .map((p) => ({
        id: p.id,
        provider_name: p.provider_name,
        provider_logo: p.provider_logo,
        out_of_balance: !!p.out_of_balance,
        is_enabled: !!linkMap.get(p.id)?.is_enabled,
        payment_number: linkMap.get(p.id)?.payment_number ?? p.payment_number ?? null,
      }))
      .sort((a, b) => {
        const ia = ORDER.indexOf(a.provider_name?.toLowerCase());
        const ib = ORDER.indexOf(b.provider_name?.toLowerCase());
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

    setItems(rows);
    setCatalog(all.filter((p) => !linkMap.has(p.id)).map((p) => ({ id: p.id, provider_name: p.provider_name, provider_logo: p.provider_logo })));
    setNumbers(Object.fromEntries(rows.map((r) => [r.id, r.payment_number ?? ''])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentTenantId]);

  /** Cusboonaysii xiriirka tenant ↔ provider. */
  const patchLink = async (row: ProviderRow, changes: { is_enabled?: boolean; payment_number?: string | null }, message: string) => {
    if (!currentTenantId) return;
    setSavingId(row.id);
    const { error } = await supabase
      .from('tenant_providers')
      .update(changes)
      .eq('tenant_id', currentTenantId)
      .eq('provider_id', row.id);
    setSavingId(null);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, ...changes } as ProviderRow : p)));
    toast({ title: 'Guul', description: message });
  };

  /** `out_of_balance` waa xog shirkadda shabakadda oo guud. */
  const patchProvider = async (row: ProviderRow, value: boolean) => {
    setSavingId(row.id);
    const { error } = await supabase.from('providers_config').update({ out_of_balance: value }).eq('id', row.id);
    setSavingId(null);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, out_of_balance: value } : p)));
    toast({ title: 'Guul', description: value ? 'Waa la calaamadiyay "Balance ma heyno"' : 'Balance-ka waa la celiyay' });
  };

  const addProviders = async (providerIds: string[], newName?: string) => {
    if (!currentTenantId) return;
    setSavingId('add');

    const ids = [...providerIds];

    // Magac cusub → ku dar liiska guud (haddii uusan horey u jirin), kadib u shid tenant-ka.
    if (newName?.trim()) {
      const name = newName.trim();
      const { data: created, error: cErr } = await supabase
        .from('providers_config')
        .insert({ provider_name: name, is_active: true, display_order: 99, tenant_id: null })
        .select('id')
        .single();
      if (cErr) { setSavingId(null); toast({ title: 'Khalad', description: cErr.message, variant: 'destructive' }); return; }
      ids.push(created.id);
    }

    if (ids.length === 0) { setSavingId(null); return; }

    const { error } = await supabase
      .from('tenant_providers')
      .upsert(
        ids.map((provider_id) => ({ tenant_id: currentTenantId, provider_id, is_enabled: true })),
        { onConflict: 'tenant_id,provider_id' }
      );
    setSavingId(null);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }

    toast({ title: 'Guul', description: `${ids.length} shirkadood ayaa lagu daray` });
    setPickerOpen(false);
    setSelected([]);
    setCustomName('');
    load();
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));

  const submitPicker = () => {
    if (selected.length === 0 && !customName.trim()) {
      toast({ title: 'Ogow', description: 'Fadlan dooro ama qor shirkad', variant: 'destructive' });
      return;
    }
    addProviders(selected, customName);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Shirkadaha</h2>
          <p className="text-sm text-muted-foreground">
            Shirkad walba shid/dami, lambar lacag u deji, ama u calaamadi "Balance ma heyno".
          </p>
        </div>
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ku dar shirkad
        </Button>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="space-y-3 py-8 text-center text-muted-foreground">
            <p>Shirkad lama helin.</p>
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Ku dar shirkad
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ku dar shirkad</DialogTitle>
            <DialogDescription>Dooro shirkadaha aad rabto ama qor mid cusub.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {catalog.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.map((d) => {
                  const active = selected.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleSelected(d.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      {d.provider_logo ? (
                        <img src={d.provider_logo} alt={`${d.provider_name} logo`} className="h-8 w-8 rounded object-contain bg-muted p-0.5" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase">
                          {d.provider_name?.slice(0, 3)}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-medium">{d.provider_name}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Shirkadaha nidaamka dhammaan way ku jiraan.</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="custom-provider">Shirkad kale (magac)</Label>
              <Input
                id="custom-provider"
                placeholder="Tusaale: Golis"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Jooji</Button>
            <Button onClick={submitPicker} disabled={savingId === 'add'}>
              {savingId === 'add' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Ku dar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id} className={p.is_enabled ? '' : 'opacity-70'}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3">
                {p.provider_logo ? (
                  <img src={p.provider_logo} alt={`${p.provider_name} logo`} className="h-10 w-10 rounded-lg object-contain bg-muted p-1" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase">
                    {p.provider_name?.slice(0, 3)}
                  </div>
                )}
                <div>
                  <CardTitle className="text-base capitalize">{p.provider_name}</CardTitle>
                  {p.out_of_balance && (
                    <Badge variant="destructive" className="mt-1">Balance ma heyno</Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={p.is_enabled}
                disabled={savingId === p.id}
                onCheckedChange={(v) => patchLink(p, { is_enabled: v }, v ? 'Shirkadda waa la shiday' : 'Shirkadda waa la damiyay')}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`num-${p.id}`}>Lambarka lacagta</Label>
                <div className="flex gap-2">
                  <Input
                    id={`num-${p.id}`}
                    inputMode="tel"
                    placeholder="617195659"
                    value={numbers[p.id] ?? ''}
                    onChange={(e) => setNumbers((n) => ({ ...n, [p.id]: e.target.value }))}
                  />
                  <Button
                    onClick={() => patchLink(p, { payment_number: (numbers[p.id] ?? '').trim() || null }, 'Lambarka lacagta waa la kaydiyay')}
                    disabled={savingId === p.id || (numbers[p.id] ?? '') === (p.payment_number ?? '')}
                  >
                    <Save className="mr-2 h-4 w-4" /> Kaydi
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Balance ma heyno</p>
                    <p className="text-xs text-muted-foreground">Macaamiisha waa loo sheegayaa in balance-ku dhamaaday.</p>
                  </div>
                </div>
                <Switch
                  checked={p.out_of_balance}
                  disabled={savingId === p.id}
                  onCheckedChange={(v) => patchProvider(p, v)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
