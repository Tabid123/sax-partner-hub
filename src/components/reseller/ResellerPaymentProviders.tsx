import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useQueryClient } from '@tanstack/react-query';

interface PaymentProvider {
  id: string;
  provider_name: string;
  provider_logo: string | null;
  commission_rate: number;
  is_active: boolean;
  ussd_code_template: string | null;
  payment_number: string | null;
  prefix_code: string | null;
}

const blank = {
  provider_name: '',
  provider_logo: '',
  commission_rate: 0,
  prefix_code: '',
  payment_number: '',
  ussd_code_template: '',
};

const QUICK_PAYMENTS = [
  {
    provider_name: 'EVC Plus',
    provider_logo: '/storage/payment-logos/evc.png',
    prefix_code: '*7',
    ussd_code_template: '*712*{number}*{amount}#',
  },
  {
    provider_name: 'e-Dahab',
    provider_logo: '/storage/payment-logos/jeeb.jpg',
    prefix_code: '*8',
    ussd_code_template: '*220*{number}*{amount}#',
  },
];

export default function ResellerPaymentProviders() {
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<PaymentProvider | null>(null);

  const load = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('payment_providers_config')
      .select('*')
      .eq('tenant_id', currentTenantId)
      .order('provider_name');
    setItems((data as PaymentProvider[]) ?? []);
    setLoading(false);
  };

  const refreshStorefrontPayments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['paymentProviders', currentTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['jumloPaymentMethods', currentTenantId] }),
    ]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentTenantId]);

  const add = async () => {
    if (!form.provider_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('payment_providers_config').insert([{
      ...form,
      provider_logo: form.provider_logo || null,
      commission_rate: Number(form.commission_rate) || 0,
      tenant_id: currentTenantId,
    }]);
    setSaving(false);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    setForm({ ...blank });
    toast({ title: 'Guul', description: 'Payment provider waa lagu daray' });
    await refreshStorefrontPayments();
    load();
  };

  const quickAdd = async (name: string) => {
    if (!currentTenantId) return;
    const preset = QUICK_PAYMENTS.find((p) => p.provider_name === name);
    if (!preset) return;
    if (items.some((i) => i.provider_name.toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Horey ayuu u jiray', description: `${name} horey ayaa loo daray` });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('payment_providers_config').insert([{
      ...preset,
      commission_rate: 0,
      payment_number: '',
      is_active: true,
      tenant_id: currentTenantId,
    }]);
    setSaving(false);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Guul', description: `${name} waa lagu daray` });
    await refreshStorefrontPayments();
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from('payment_providers_config').update({
      payment_number: editing.payment_number,
      prefix_code: editing.prefix_code,
      ussd_code_template: editing.ussd_code_template,
      commission_rate: Number(editing.commission_rate) || 0,
    }).eq('id', editing.id).eq('tenant_id', currentTenantId);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    setEditing(null);
    toast({ title: 'Guul', description: 'Waa la cusboonaysiiyay' });
    await refreshStorefrontPayments();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Ma hubtaa?')) return;
    const { error } = await supabase.from('payment_providers_config').delete().eq('id', id).eq('tenant_id', currentTenantId);
    if (error) { toast({ title: 'Khalad', description: error.message, variant: 'destructive' }); return; }
    await refreshStorefrontPayments();
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Ku dar si degdeg ah</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {QUICK_PAYMENTS.map((p) => {
            const exists = items.some((i) => i.provider_name.toLowerCase() === p.provider_name.toLowerCase());
            return (
              <Button
                key={p.provider_name}
                variant={exists ? 'secondary' : 'default'}
                disabled={saving || exists}
                onClick={() => quickAdd(p.provider_name)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {p.provider_name}{exists ? ' (way jirtaa)' : ''}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ku dar Payment Provider</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Magaca</Label><Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} /></div>
            <div><Label>Logo URL</Label><Input value={form.provider_logo} onChange={(e) => setForm({ ...form, provider_logo: e.target.value })} /></div>
            <div><Label>Commission %</Label><Input type="number" step="0.01" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Prefix Code</Label><Input maxLength={2} value={form.prefix_code} onChange={(e) => setForm({ ...form, prefix_code: e.target.value })} /></div>
            <div><Label>Payment Number</Label><Input value={form.payment_number} onChange={(e) => setForm({ ...form, payment_number: e.target.value })} /></div>
            <div><Label>USSD Template</Label><Input value={form.ussd_code_template} onChange={(e) => setForm({ ...form, ussd_code_template: e.target.value })} /></div>
          </div>
          <Button onClick={add} className="w-full" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Ku dar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment Providers</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Magaca</TableHead><TableHead>Prefix</TableHead><TableHead>Number</TableHead><TableHead>USSD</TableHead><TableHead>Commission</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((pp) => {
                  const isEditing = editing?.id === pp.id;
                  return (
                    <TableRow key={pp.id}>
                      <TableCell className="font-medium">{pp.provider_name}</TableCell>
                      <TableCell className="font-mono">
                        {isEditing ? <Input className="w-20" value={editing.prefix_code ?? ''} onChange={(e) => setEditing({ ...editing, prefix_code: e.target.value })} /> : (pp.prefix_code || '-')}
                      </TableCell>
                      <TableCell className="font-mono">
                        {isEditing ? <Input className="w-36" value={editing.payment_number ?? ''} onChange={(e) => setEditing({ ...editing, payment_number: e.target.value })} /> : (pp.payment_number || '-')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {isEditing ? <Input className="w-44" value={editing.ussd_code_template ?? ''} onChange={(e) => setEditing({ ...editing, ussd_code_template: e.target.value })} /> : (pp.ussd_code_template || '-')}
                      </TableCell>
                      <TableCell>
                        {isEditing ? <Input className="w-20" type="number" step="0.01" value={editing.commission_rate} onChange={(e) => setEditing({ ...editing, commission_rate: parseFloat(e.target.value) || 0 })} /> : `${pp.commission_rate}%`}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4" /></Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setEditing(pp)}>Edit</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => remove(pp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}