import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, TrendingUp, Loader2 } from 'lucide-react';
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ReportRow {
  group_key: string;
  label: string;
  provider_id: string | null;
  rate: number | null;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
  profit_ev: number;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mapRows = (data: unknown): ReportRow[] =>
  ((data as any[]) || []).map((r) => ({
    group_key: String(r.group_key),
    label: String(r.label),
    provider_id: r.provider_id ?? null,
    rate: r.rate === null || r.rate === undefined ? null : Number(r.rate),
    orders: Number(r.orders || 0),
    revenue: Number(r.revenue || 0),
    cost: Number(r.cost || 0),
    profit: Number(r.profit || 0),
    profit_ev: Number(r.profit_ev || 0),
  }));

const sum = (rows: ReportRow[], key: keyof ReportRow) =>
  rows.reduce((acc, r) => acc + Number(r[key] || 0), 0);

const Amount = ({ value, tone }: { value: number; tone: 'revenue' | 'cost' | 'profit' }) => (
  <span
    className={cn(
      'tabular-nums',
      tone === 'cost' && 'text-destructive',
      tone === 'profit' && 'font-bold text-green-600 dark:text-green-400',
    )}
  >
    {money(value)}
  </span>
);

export default function ResellerProfitReport() {
  const { language } = useLanguage();
  const so = language === 'so';

  // ---- Per provider (single day) ----
  const [providerDate, setProviderDate] = useState<Date>(new Date());
  const [providerRows, setProviderRows] = useState<ReportRow[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // ---- Date range history ----
  const [period, setPeriod] = useState<Period>('month');
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [providers, setProviders] = useState<{ id: string; provider_name: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [dayRows, setDayRows] = useState<ReportRow[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);

  useEffect(() => {
    supabase
      .from('providers_config')
      .select('id, provider_name')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setProviders(data || []));
  }, []);

  const loadProviderRows = useCallback(async (silent = false) => {
    if (!silent) setLoadingProviders(true);
    const { data, error } = await supabase.rpc('get_profit_report' as any, {
      p_start: startOfDay(providerDate).toISOString(),
      p_end: endOfDay(providerDate).toISOString(),
      p_provider_id: null,
      p_group_by: 'provider',
    });
    if (error) console.error('profit report (provider) error', error);
    setProviderRows(mapRows(data));
    if (!silent) setLoadingProviders(false);
  }, [providerDate]);

  const loadDayRows = useCallback(async (silent = false) => {
    if (!silent) setLoadingDays(true);
    const { data, error } = await supabase.rpc('get_profit_report' as any, {
      p_start: dateFrom.toISOString(),
      p_end: dateTo.toISOString(),
      p_provider_id: selectedProvider === 'all' ? null : selectedProvider,
      p_group_by: 'day',
    });
    if (error) console.error('profit report (day) error', error);
    setDayRows(mapRows(data));
    if (!silent) setLoadingDays(false);
  }, [dateFrom, dateTo, selectedProvider]);

  useEffect(() => { loadProviderRows(); }, [loadProviderRows]);
  useEffect(() => { loadDayRows(); }, [loadDayRows]);

  // Real-time: dalab cusub ama status isbeddelay → isla markiiba cusboonaysii
  useEffect(() => {
    const channel = supabase
      .channel('profit-report-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadProviderRows(true);
        loadDayRows(true);
      })
      .subscribe();
    const interval = setInterval(() => {
      loadProviderRows(true);
      loadDayRows(true);
    }, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadProviderRows, loadDayRows]);

  const applyPeriod = (p: Period) => {
    const now = new Date();
    setPeriod(p);
    if (p === 'today') { setDateFrom(startOfDay(now)); setDateTo(endOfDay(now)); }
    if (p === 'week') { setDateFrom(startOfWeek(now, { weekStartsOn: 1 })); setDateTo(endOfWeek(now, { weekStartsOn: 1 })); }
    if (p === 'month') { setDateFrom(startOfMonth(now)); setDateTo(endOfMonth(now)); }
    if (p === 'year') { setDateFrom(startOfYear(now)); setDateTo(endOfYear(now)); }
  };

  const providerTotals = useMemo(() => ({
    orders: sum(providerRows, 'orders'),
    revenue: sum(providerRows, 'revenue'),
    cost: sum(providerRows, 'cost'),
    profit: sum(providerRows, 'profit'),
    profit_ev: sum(providerRows, 'profit_ev'),
  }), [providerRows]);

  const dayTotals = useMemo(() => ({
    orders: sum(dayRows, 'orders'),
    revenue: sum(dayRows, 'revenue'),
    cost: sum(dayRows, 'cost'),
    profit: sum(dayRows, 'profit'),
    profit_ev: sum(dayRows, 'profit_ev'),
  }), [dayRows]);

  const t = {
    provider: so ? 'Shirkad' : 'Provider',
    orders: so ? 'Dalabyo' : 'Orders',
    revenue: so ? 'Dakhli' : 'Revenue',
    cost: so ? 'Kharash' : 'Cost',
    profit: so ? "Faa'iido" : 'Profit',
    total: so ? 'Wadarta' : 'Total',
    day: so ? 'Maalin' : 'Date',
    none: so ? 'Xog ma jirto' : 'No data',
  };

  const MobileRow = ({
    title, badge, row,
  }: { title: string; badge?: string; row: ReportRow | typeof providerTotals }) => (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {badge}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{row.orders}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">{t.revenue}</p>
          <Amount value={row.revenue} tone="revenue" />
        </div>
        <div>
          <p className="text-muted-foreground">{t.cost}</p>
          <Amount value={row.cost} tone="cost" />
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">{t.profit}</p>
          <Amount value={row.profit} tone="profit" />
          <p className="text-[10px] text-muted-foreground">≈ {money(row.profit_ev)} EV</p>
        </div>
      </div>
    </div>
  );

  const ProfitCell = ({ row }: { row: ReportRow | typeof providerTotals }) => (
    <td className="px-3 py-3 text-right">
      <Amount value={row.profit} tone="profit" />
      <div className="text-[10px] text-muted-foreground">≈ {money(row.profit_ev)} EV</div>
    </td>
  );


  return (
    <div className="space-y-6">
      {/* Per provider */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                {so ? 'Shirkad Walba' : 'Per-Provider Profit'}
              </CardTitle>
              <CardDescription>
                {so
                  ? `Dalabyadii la diray ${format(providerDate, 'dd/MM/yyyy')} shirkad walba si gooni ah`
                  : `Delivered orders on ${format(providerDate, 'dd/MM/yyyy')} per provider`}
              </CardDescription>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(providerDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto bg-background p-0" align="end">
                <Calendar
                  mode="single"
                  selected={providerDate}
                  onSelect={(d) => d && setProviderDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProviders ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : providerRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t.none}</p>
          ) : (
            <>
              {/* Mobile */}
              <div className="space-y-2 md:hidden">
                {providerRows.map((r) => (
                  <MobileRow
                    key={r.group_key}
                    title={r.label}
                    badge={r.rate !== null ? `${(r.rate * 100).toFixed(1)}%` : undefined}
                    row={r}
                  />
                ))}
                <div className="rounded-lg border bg-muted/40 p-3">
                  <MobileRow title={t.total} row={providerTotals} />
                </div>
              </div>
              {/* Desktop */}
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="px-3 py-3 text-left font-medium">{t.provider}</th>
                      <th className="px-3 py-3 text-center font-medium">Rate</th>
                      <th className="px-3 py-3 text-center font-medium">{t.orders}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.revenue}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.cost}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.profit}</th>
                    </tr>

                  </thead>
                  <tbody>
                    {providerRows.map((r) => (
                      <tr key={r.group_key} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="px-3 py-3 font-medium">{r.label}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {((r.rate || 0) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold">{r.orders}</td>
                        <td className="px-3 py-3 text-right"><Amount value={r.revenue} tone="revenue" /></td>
                        <td className="px-3 py-3 text-right"><Amount value={r.cost} tone="cost" /></td>
                        <ProfitCell row={r} />
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-3 py-3">{t.total}</td>
                      <td />
                      <td className="px-3 py-3 text-center">{providerTotals.orders}</td>
                      <td className="px-3 py-3 text-right"><Amount value={providerTotals.revenue} tone="revenue" /></td>
                      <td className="px-3 py-3 text-right"><Amount value={providerTotals.cost} tone="cost" /></td>
                      <ProfitCell row={providerTotals} />
                    </tr>

                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            {so ? 'Faahfaahin Taariikhda' : 'Date Range Breakdown'}
          </CardTitle>
          <CardDescription>
            {so ? 'Muuji maalin walba natiijada (dalabyadii la diray kaliya)' : 'Daily breakdown of delivered orders'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2 sm:inline-flex sm:gap-2">
            {(['today', 'week', 'month', 'year'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'outline'}
                className="sm:min-w-[88px]"
                onClick={() => applyPeriod(p)}
              >
                {p === 'today' ? (so ? 'Maanta' : 'Today')
                  : p === 'week' ? (so ? 'Isbuucan' : 'Week')
                  : p === 'month' ? (so ? 'Bishaan' : 'Month')
                  : (so ? 'Sanadkan' : 'Year')}
              </Button>
            ))}
          </div>


          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {so ? 'Laga bilaabo:' : 'From:'}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start truncate font-normal sm:w-auto">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{format(dateFrom, 'MMM d, yyyy')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto bg-background p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => { if (d) { setDateFrom(startOfDay(d)); setPeriod('custom'); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {so ? 'Ilaa:' : 'To:'}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start truncate font-normal sm:w-auto">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{format(dateTo, 'MMM d, yyyy')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto bg-background p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => { if (d) { setDateTo(endOfDay(d)); setPeriod('custom'); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-2 flex min-w-0 items-center gap-1.5">
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {so ? 'Shirkad:' : 'Provider:'}
              </span>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="h-9 text-sm sm:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">{so ? 'Dhammaan' : 'All'}</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.provider_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>


          {loadingDays ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : dayRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t.none}</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {dayRows.map((r) => (
                  <MobileRow key={r.group_key} title={format(new Date(r.label), 'EEE, MMM d')} row={r} />
                ))}
                <div className="rounded-lg border bg-muted/40 p-3">
                  <MobileRow title={t.total} row={dayTotals} />
                </div>
              </div>
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="px-3 py-3 text-left font-medium">{t.day}</th>
                      <th className="px-3 py-3 text-center font-medium">{t.orders}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.revenue}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.cost}</th>
                      <th className="px-3 py-3 text-right font-medium">{t.profit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.map((r) => (
                      <tr key={r.group_key} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="px-3 py-3 font-medium">{format(new Date(r.label), 'EEE, MMM d')}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {r.orders}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right"><Amount value={r.revenue} tone="revenue" /></td>
                        <td className="px-3 py-3 text-right"><Amount value={r.cost} tone="cost" /></td>
                        <ProfitCell row={r} />
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-3 py-3">{t.total}</td>
                      <td className="px-3 py-3 text-center">{dayTotals.orders}</td>
                      <td className="px-3 py-3 text-right"><Amount value={dayTotals.revenue} tone="revenue" /></td>
                      <td className="px-3 py-3 text-right"><Amount value={dayTotals.cost} tone="cost" /></td>
                      <ProfitCell row={dayTotals} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
