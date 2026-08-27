import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Loader2, Smartphone, Signal, Battery, Wallet } from 'lucide-react';
import amtelLogo from '@/assets/providers/amtel-logo.png';
import { formatDistanceToNow } from 'date-fns';

interface SimView {
  slot: number;
  provider: string;
  number: string;
  rate: number;
  evcPlus: number;
  evoucher: number;
}

interface DeviceView {
  id: string;
  name: string;
  lastPing: string | null;
  battery: number | null;
  sims: SimView[];
}

const PROVIDER_STYLES: { match: string; head: string; ring: string }[] = [
  { match: 'hormuud', head: 'from-emerald-500 to-green-600', ring: 'border-emerald-300 dark:border-emerald-800' },
  { match: 'somtel', head: 'from-amber-400 to-yellow-500', ring: 'border-amber-300 dark:border-amber-800' },
  { match: 'amtel', head: 'from-rose-500 to-red-600', ring: 'border-rose-300 dark:border-rose-800' },
  { match: 'somnet', head: 'from-sky-500 to-blue-600', ring: 'border-sky-300 dark:border-sky-800' },
  { match: 'somlink', head: 'from-violet-500 to-indigo-600', ring: 'border-violet-300 dark:border-violet-800' },
];

const styleFor = (provider: string) => {
  const p = (provider || '').toLowerCase();
  return (
    PROVIDER_STYLES.find((s) => p.includes(s.match)) ?? {
      head: 'from-slate-500 to-slate-700',
      ring: 'border-slate-300 dark:border-slate-700',
    }
  );
};

const isHormuud = (p: string) => (p || '').toLowerCase().includes('hormuud');

const PROVIDER_LOGOS: { match: string; src: string }[] = [
  { match: 'hormuud', src: '/storage/logos/hormuud.jpg' },
  { match: 'somtel', src: '/storage/logos/somtel.png' },
  { match: 'somnet', src: '/storage/logos/somnet.jpg' },
  { match: 'somlink', src: '/storage/logos/somlink.jpg' },
  { match: 'amtel', src: amtelLogo },
];

const logoFor = (provider: string) => {
  const p = (provider || '').toLowerCase();
  return PROVIDER_LOGOS.find((l) => p.includes(l.match))?.src ?? null;
};

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtMoney = (v: number) => moneyFmt.format(Number.isFinite(v) ? v : 0);

const fmtRate = (v: number) => {
  const n = Number.isFinite(v) ? v : 0;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
};

const AmountDot = () => (
  <span className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 align-middle" />
);

export default function ResellerDeviceBalances() {
  const { language } = useLanguage();
  const so = language === 'so';
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceView[]>([]);

  const load = useCallback(async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      const [devRes, balRes, provRes] = await Promise.all([
        supabase
          .from('android_devices')
          .select('id, device_name, device_id, provider_name, sim_number, sim1_provider, sim2_provider, sim2_number, battery_level, last_ping_at, is_active, archived_at')
          .is('archived_at', null)
          .eq('is_active', true),
        supabase.from('sim_balances').select('sim_id, balance, balance_type, sim_slot'),
        supabase.from('providers_config').select('provider_name, evoucher_rate'),
      ]);

      const rates = new Map<string, number>();
      (provRes.data ?? []).forEach((p: any) =>
        rates.set(String(p.provider_name).toLowerCase(), Number(p.evoucher_rate || 0))
      );

      const balances = (balRes.data ?? []) as any[];
      const pick = (simId: string, slot: number, type: string) =>
        Number(
          balances.find(
            (b) => b.sim_id === simId && Number(b.sim_slot ?? 1) === slot && b.balance_type === type
          )?.balance ?? 0
        );

      const mapped: DeviceView[] = (devRes.data ?? []).map((d: any) => {
        const sims: SimView[] = [];
        const p1 = d.sim1_provider || d.provider_name;
        if (p1) {
          sims.push({
            slot: 1,
            provider: p1,
            number: d.sim_number ?? '',
            rate: rates.get(String(p1).toLowerCase()) ?? 0,
            evcPlus: pick(d.id, 1, 'evc_plus') || pick(d.id, 1, 'manual'),
            evoucher: pick(d.id, 1, 'evoucher'),
          });
        }
        if (d.sim2_provider) {
          sims.push({
            slot: 2,
            provider: d.sim2_provider,
            number: d.sim2_number ?? '',
            rate: rates.get(String(d.sim2_provider).toLowerCase()) ?? 0,
            evcPlus: pick(d.id, 2, 'evc_plus') || pick(d.id, 2, 'manual'),
            evoucher: pick(d.id, 2, 'evoucher'),
          });
        }
        return {
          id: d.id,
          name: d.device_name || d.device_id,
          lastPing: d.last_ping_at,
          battery: d.battery_level ?? null,
          sims,
        };
      });

      setDevices(mapped);
      setLoading(false);
  }, []);

  useEffect(() => {
    load(true);
    const channel = supabase
      .channel('reseller-device-balances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_balances' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'android_devices' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'providers_config' }, () => load())
      .subscribe();
    const t = setInterval(() => load(), 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [load]);

  const allSims = devices.flatMap((d) => d.sims);
  const totalEvoucher = allSims.reduce(
    (s, sim) => s + (isHormuud(sim.provider) ? sim.evoucher : sim.evoucher || sim.evcPlus),
    0
  );
  const totalEvcPlus = allSims.reduce((s, sim) => s + (isHormuud(sim.provider) ? sim.evcPlus : 0), 0);
  const grand = totalEvoucher + totalEvcPlus;

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
          {so ? 'Aaladaha & Lacagta SIM-yada' : 'Devices & SIM Balances'}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {devices.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {so ? 'Aalad lama helin' : 'No devices yet'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {devices.map((d) => {
            const online = d.lastPing && Date.now() - new Date(d.lastPing).getTime() < 3 * 60 * 1000;
            return (
              <div key={d.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex items-start gap-2 bg-gradient-to-r from-sky-50 to-indigo-50 px-2 py-2 dark:from-sky-950/40 dark:to-indigo-950/40 sm:gap-3 sm:px-3 sm:py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:h-9 sm:w-9">
                    <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="truncate text-xs font-bold sm:text-sm">{d.name}</p>
                      <span
                        className={cn(
                          'flex items-center gap-1 text-[10px] font-semibold',
                          online ? 'text-emerald-600' : 'text-muted-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            online ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                          )}
                        />
                        {online ? 'Live' : 'Offline'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-emerald-600">
                      {d.battery != null && (
                        <span className="flex items-center gap-1">
                          <Battery className="h-3 w-3" />
                          {d.battery}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {d.lastPing
                        ? formatDistanceToNow(new Date(d.lastPing), { addSuffix: true })
                        : so
                          ? 'Weli lama arag'
                          : 'Never seen'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 p-2 sm:space-y-3 sm:p-3">
                  {d.sims.map((sim) => {
                    const st = styleFor(sim.provider);
                    const logo = logoFor(sim.provider);
                    return (
                      <div
                        key={`${d.id}-${sim.slot}`}
                        className={cn('overflow-hidden rounded-xl border', st.ring)}
                      >
                        <div
                          className={cn(
                            'flex items-center gap-1.5 bg-gradient-to-r px-2 py-1.5 text-primary-foreground sm:gap-2 sm:px-3 sm:py-2',
                            st.head
                          )}
                        >
                          {logo ? (
                            <img
                              src={logo}
                              alt={`${sim.provider} logo`}
                              className="h-5 w-5 shrink-0 rounded-md bg-background object-contain p-0.5 sm:h-6 sm:w-6"
                              loading="lazy"
                            />
                          ) : (
                            <Signal className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                          )}
                          <span className="truncate text-[11px] font-semibold sm:text-sm">
                            SIM{sim.slot}: {sim.provider}
                          </span>
                        </div>
                        <div className="space-y-1.5 px-2 py-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono tabular-nums text-muted-foreground">
                              {sim.number || '—'}
                            </span>
                            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                              Rate: {fmtRate(sim.rate)}
                            </span>
                          </div>
                          {isHormuud(sim.provider) ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">EVC Plus:</span>
                                <span className="flex items-center font-bold tabular-nums">
                                  {fmtMoney(sim.evcPlus)}
                                  <AmountDot />
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">E-Voucher:</span>
                                <span className="flex items-center font-bold tabular-nums text-emerald-600">
                                  {fmtMoney(sim.evoucher)}
                                  <AmountDot />
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">Balance:</span>
                              <span className="flex items-center font-bold tabular-nums text-emerald-600">
                                {fmtMoney(sim.evoucher || sim.evcPlus)}
                                <AmountDot />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {d.sims.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {so ? 'SIM lama diiwaangelin' : 'No SIM registered'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold">{so ? 'Wadarta Lacagta' : 'Total Balances'}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border bg-card px-2 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">E-Voucher</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{fmtMoney(totalEvoucher)}</p>
          </div>
          <div className="rounded-xl border bg-card px-2 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">EVC Plus</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{fmtMoney(totalEvcPlus)}</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-2 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">{so ? 'Wadarta Guud' : 'Grand Total'}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-primary">{fmtMoney(grand)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
