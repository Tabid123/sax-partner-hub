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
  is_active: boolean;
  payment_number: string | null;
  out_of_balance: boolean;
}

const ORDER = ['hormuud', 'somnet', 'somtel', 'amtel'];

const DEFAULT_PROVIDERS = [
  { provider_name: 'Hormuud', provider_logo: '/storage/logos/hormuud.jpg' },
  { provider_name: 'Somnet', provider_logo: '/storage/logos/somnet.jpg' },
  { provider_name: 'Somtel', provider_logo: '/storage/logos/somtel.png' },
  { provider_name: 'Amtel', provider_logo: '/storage/logos/somlink.jpg' },
];



export default function ResellerProviders() {
  const { currentTenantId } = useTenant();
  const [items, setItems] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');


  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('providers_config')
      .select('id, provider_name, provider_logo, is_active, payment_number, out_of_balance')
      .eq('tenant_id', currentTenantId);
    if (error) toast({ title: 'Khalad', description: error.message, variant: 'destructive' });
    const rows = ((data as ProviderRow[]) ?? []).sort((a, b) => {
      const ia = ORDER.indexOf(a.provider_name?.toLowerCase());
      const ib = ORDER.indexOf(b.provider_name?.toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    setItems(rows);
    setNumbers(Object.fromEntries(rows.map((r) => [r.id, r.payment_number ?? ''])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentTenantId]);

  const patch = async (row: ProviderRow, changes: Partial<ProviderRow>, message: string) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from('providers_config')
      .update(changes)
      .eq('id', row.id)
      .eq('tenant_id', currentTenantId);
    setSavingId(null);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, ...changes } : p)));
    toast({ title: 'Guul', description: message });
  };

  const addProviders = async (names: { provider_name: string; provider_logo: string | null }[]) => {
    if (!currentTenantId || names.length === 0) return;
    setSavingId('add');
    const existing = new Set(items.map((i) => i.provider_name?.toLowerCase().trim()));
    const rows = names
      .filter((d) => !existing.has(d.provider_name.toLowerCase().trim()))
      .map((d, i) => ({
        provider_name: d.provider_name.trim(),
        provider_logo: d.provider_logo,
        is_active: true,
        display_order: items.length + i + 1,
        tenant_id: currentTenantId,
      }));
    if (rows.length === 0) {
      setSavingId(null);
      toast({ title: 'Ogow', description: 'Shirkaddaas horey ayay u jirtay' });
      return;
    }
    const { error } = await supabase.from('providers_config').insert(rows);
    setSavingId(null);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Guul', description: `${rows.length} shirkadood ayaa lagu daray` });
    setPickerOpen(false);
    setSelected([]);
    setCustomName('');
    load();
  };

  const toggleSelected = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const submitPicker = () => {
    const chosen = DEFAULT_PROVIDERS.filter((d) => selected.includes(d.provider_name)).map((d) => ({
      provider_name: d.provider_name,
      provider_logo: d.provider_logo as string | null,
    }));
    if (customName.trim()) chosen.push({ provider_name: customName.trim(), provider_logo: null });
    if (chosen.length === 0) {
      toast({ title: 'Ogow', description: 'Fadlan dooro ama qor shirkad', variant: 'destructive' });
      return;
    }
    addProviders(chosen);
  };

  const availableDefaults = DEFAULT_PROVIDERS.filter(
    (d) => !items.some((i) => i.provider_name?.toLowerCase().trim() === d.provider_name.toLowerCase())
  );

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
            {availableDefaults.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableDefaults.map((d) => {
                  const active = selected.includes(d.provider_name);
                  return (
                    <button
                      key={d.provider_name}
                      type="button"
                      onClick={() => toggleSelected(d.provider_name)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <img src={d.provider_logo} alt={`${d.provider_name} logo`} className="h-8 w-8 rounded object-contain bg-muted p-0.5" />
                      <span className="flex-1 text-sm font-medium">{d.provider_name}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Shirkadaha caadiga ah dhammaan way ku jiraan.</p>
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
          <Card key={p.id} className={p.is_active ? '' : 'opacity-70'}>
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
                checked={p.is_active}
                disabled={savingId === p.id}
                onCheckedChange={(v) => patch(p, { is_active: v }, v ? 'Shirkadda waa la shiday' : 'Shirkadda waa la damiyay')}
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
                    onClick={() => patch(p, { payment_number: (numbers[p.id] ?? '').trim() || null }, 'Lambarka lacagta waa la kaydiyay')}
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
                  onCheckedChange={(v) => patch(p, { out_of_balance: v }, v ? 'Waa la calaamadiyay "Balance ma heyno"' : 'Balance-ka waa la celiyay')}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
