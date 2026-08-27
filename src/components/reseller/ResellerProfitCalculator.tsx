import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Save, TrendingUp, Building2 } from 'lucide-react';
import amtelLogo from '@/assets/providers/amtel-logo.png';

interface Tier {
  id: string;
  provider_id: string;
  tier_name: string;
  min_amount: number;
  max_amount: number;
  profit_rate: number;
  intake_rate: number;
  payout_rate: number;
  is_active: boolean;
  display_order: number;
}

interface Provider {
  id: string;
  provider_name: string;
}

const PROVIDER_STYLES: { match: string; head: string }[] = [
  { match: 'hormuud', head: 'from-emerald-500 to-green-600' },
  { match: 'somtel', head: 'from-amber-400 to-yellow-500' },
  { match: 'amtel', head: 'from-rose-500 to-red-600' },
  { match: 'somnet', head: 'from-sky-500 to-blue-600' },
  { match: 'somlink', head: 'from-violet-500 to-indigo-600' },
];

const headFor = (p: string) =>
  PROVIDER_STYLES.find((s) => (p || '').toLowerCase().includes(s.match))?.head ??
  'from-slate-500 to-slate-700';

const PROVIDER_LOGOS: { match: string; src: string }[] = [
  { match: 'hormuud', src: '/storage/logos/hormuud.jpg' },
  { match: 'somtel', src: '/storage/logos/somtel.png' },
  { match: 'somnet', src: '/storage/logos/somnet.jpg' },
  { match: 'somlink', src: '/storage/logos/somlink.jpg' },
  { match: 'amtel', src: amtelLogo },
];

const logoFor = (p: string) =>
  PROVIDER_LOGOS.find((l) => (p || '').toLowerCase().includes(l.match))?.src ?? null;

const money = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

/** intake/payout stored as percent (e.g. 18 = 18%). Profit% = intake − payout. */
const profitPct = (intake: number, payout: number) =>
  Math.max(0, (Number(intake) || 0) - (Number(payout) || 0));

interface EditState {
  intake: string;
  payout: string;
}

export default function ResellerProfitCalculator() {
  const { language } = useLanguage();
  const so = language === 'so';
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    let pq = supabase.from('providers_config').select('id, provider_name').eq('is_active', true).order('display_order');
    let tq = supabase
      .from('provider_wholesale_tiers')
      .select('id, provider_id, tier_name, min_amount, max_amount, profit_rate, intake_rate, payout_rate, is_active, display_order')
      .order('display_order')
      .order('min_amount');
    if (tenantId) {
      pq = pq.eq('tenant_id', tenantId);
      tq = tq.eq('tenant_id', tenantId);
    }
    const [{ data: pr }, { data: tr }] = await Promise.all([pq, tq]);
    setProviders((pr as Provider[]) || []);
    const list = (tr as Tier[]) || [];
    setTiers(list);
    setEdits((prev) => {
      const next: Record<string, EditState> = {};
      for (const t of list) {
        const e = prev[t.id];
        next[t.id] = e ?? {
          intake: String(t.intake_rate ?? 0),
          payout: String(t.payout_rate ?? 0),
        };
      }
      return next;
    });
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tier[]>();
    for (const t of tiers) {
      const arr = map.get(t.provider_id) ?? [];
      arr.push(t);
      map.set(t.provider_id, arr);
    }
    return providers
      .map((p) => ({ provider: p, items: map.get(p.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [providers, tiers]);

  const updateField = (id: string, field: keyof EditState, value: string) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const save = async (t: Tier) => {
    const e = edits[t.id];
    if (!e) return;
    const intake = parseFloat(e.intake);
    const payout = parseFloat(e.payout);
    if (Number.isNaN(intake) || Number.isNaN(payout)) {
      toast({ title: so ? 'Geli qiimayaal sax ah' : 'Enter valid numbers', variant: 'destructive' });
      return;
    }
    if (intake < 0 || payout < 0) {
      toast({ title: so ? 'Rate waa inuu noqdaa >= 0' : 'Rate must be >= 0', variant: 'destructive' });
      return;
    }
    setSaving((s) => ({ ...s, [t.id]: true }));
    const profit = profitPct(intake, payout);
    const { error } = await supabase
      .from('provider_wholesale_tiers')
      .update({ intake_rate: intake, payout_rate: payout, profit_rate: profit })
      .eq('id', t.id);
    setSaving((s) => ({ ...s, [t.id]: false }));
    if (error) {
      toast({ title: so ? 'Khalad' : 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setTiers((prev) => prev.map((x) => (x.id === t.id ? { ...x, intake_rate: intake, payout_rate: payout, profit_rate: profit } : x)));
    toast({ title: so ? 'Waa la kaydiyay' : 'Saved' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          {so ? 'Xisaabinta Faa\u2019iida' : 'Profit Calculator'}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-2xl border bg-primary/5 p-3 text-xs text-muted-foreground sm:text-sm">
        {so
          ? 'Faa\u2019iida = inta shirkaddu kuu soo qaato (intake) \u2212 inta aad qofka ku bixinaayo (payout). Tusaale: intake 18% iyo payout 17% \u2192 faa\u2019iido 1% ee $100 kasta.'
          : 'Profit = intake (what company gives you) \u2212 payout (what you give customer). Example: intake 18% + payout 17% \u2192 1% profit per $100.'}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {so ? 'Wax tier ah ma jiroan. Tag "Jumlo Tiers" si aad u abuurto.' : 'No tiers. Go to "Wholesale Tiers" to create one.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {grouped.map(({ provider, items }) => {
            const logo = logoFor(provider.provider_name);
            return (
              <div key={provider.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className={cn('flex items-center gap-2 bg-gradient-to-r px-3 py-2.5 text-primary-foreground', headFor(provider.provider_name))}>
                  {logo ? (
                    <img src={logo} alt={`${provider.provider_name} logo`} className="h-6 w-6 rounded-md bg-background object-contain p-0.5" loading="lazy" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                  <span className="truncate text-base font-bold">{provider.provider_name}</span>
                </div>

                <div className="divide-y divide-border">
                  {items.map((t) => {
                    const e = edits[t.id] ?? { intake: String(t.intake_rate ?? 0), payout: String(t.payout_rate ?? 0) };
                    const intake = parseFloat(e.intake) || 0;
                    const payout = parseFloat(e.payout) || 0;
                    const profit = profitPct(intake, payout);
                    const example = 100;
                    const companyGives = example * (1 + intake / 100);
                    const customerGets = example * (1 + payout / 100);
                    const profitCash = example * (profit / 100);
                    const isSaving = saving[t.id];
                    return (
                      <div key={t.id} className="space-y-2.5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{t.tier_name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {money(Number(t.min_amount))} \u2013 {money(Number(t.max_amount))}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {so ? 'Soo qaato (Intake) %' : 'Intake %'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={e.intake}
                              onChange={(ev) => updateField(t.id, 'intake', ev.target.value)}
                              className="h-9 w-full rounded-lg border bg-background px-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/40"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {so ? 'Ku bixin (Payout) %' : 'Payout %'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={e.payout}
                              onChange={(ev) => updateField(t.id, 'payout', ev.target.value)}
                              className="h-9 w-full rounded-lg border bg-background px-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-rose-500/40"
                            />
                          </label>
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <TrendingUp className="h-4 w-4" />
                            {so ? 'Faa\u2019iido' : 'Profit'}
                          </span>
                          <span className="text-base font-bold tabular-nums text-primary">{profit.toFixed(2)}%</span>
                        </div>

                        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                          <p className="tabular-nums">
                            {so ? `Bixi ${money(example)} \u2192 shirkaddu kuu siisay ` : `Pay ${money(example)} \u2192 company gives `}
                            <span className="font-semibold text-emerald-600">{money(companyGives)}</span>
                          </p>
                          <p className="tabular-nums">
                            {so ? `Qof siiyo ${money(example)} \u2192 aad siisay ` : `Customer pays ${money(example)} \u2192 you give `}
                            <span className="font-semibold text-rose-600">{money(customerGets)}</span>
                          </p>
                          <p className="tabular-nums">
                            {so ? 'Faa\u2019iido: ' : 'Profit: '}
                            <span className="font-bold text-primary">{money(profitCash)}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => save(t)}
                          disabled={isSaving}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {so ? 'Kaydi' : 'Save'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
