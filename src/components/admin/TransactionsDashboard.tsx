import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ChevronRight, ChevronLeft, ChevronDown, FileDown, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { formatPrice } from '@/lib/utils';
import { exportTransactionsPDF, exportTransactionsExcel } from '@/utils/analyticsExporter';

interface Transaction {
  id: string;
  customer_phone: string;
  package_name: string;
  data_amount: string;
  selling_price: number;
  status: string;
  delivery_status?: string;
  created_at: string;
  package_id: string;
  provider_id: string;
  cost_price: number;
  evoucher_rate: number;
  cost_ev?: number;
  cost_cash?: number;
  rate_pct?: number;
  profit?: number;
  sender_phone?: string;
  receiver_phone?: string;
  provider_name: string;
}

const PAGE_SIZE = 50;

// Profit is computed server-side:
// jumlo: selling_price × (intake_rate − payout_rate) / 100
// regular: selling_price − cost_price
const getProfit = (t: Transaction): number =>
  t.profit ?? (t.selling_price - (t.cost_price || 0));

const getCost = (t: Transaction): number => t.cost_cash ?? t.cost_price ?? 0;

export function TransactionsDashboard() {
  const { language } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats from summary RPC
  const [statsData, setStatsData] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('today');
  const [providerFilter, setProviderFilter] = useState('all');

  // Providers list for filter dropdown
  const [providers, setProviders] = useState<{id: string; name: string}[]>([]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load providers once
  useEffect(() => {
    const loadProviders = async () => {
      const { data } = await supabase
        .from('providers_config')
        .select('id, provider_name')
        .eq('is_active', true)
        .order('display_order');
      if (data) {
        setProviders(data.map(p => ({ id: p.id, name: p.provider_name })));
      }
    };
    loadProviders();
  }, []);

  // Load summary stats
  const loadStats = useCallback(async () => {
    const provId = providerFilter === 'all' ? null : providerFilter;
    const { data } = await supabase.rpc('get_admin_transactions_summary', {
      p_provider_id: provId,
      p_period: periodFilter,
    });
    if (data) setStatsData(data as any);
  }, [providerFilter, periodFilter]);

  // Load paginated transactions
  const loadTransactions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_transactions_paginated', {
      p_search: debouncedSearch || null,
      p_status: statusFilter,
      p_provider_id: providerFilter === 'all' ? null : providerFilter,
      p_period: periodFilter,
      p_limit: PAGE_SIZE,
      p_offset: currentPage * PAGE_SIZE,
    });

    if (error) {
      console.error('Transactions load error:', error);
    } else if (data) {
      const result = data as any;
      setTransactions(result.rows || []);
      setTotalCount(result.total_count || 0);
      setTotalSales(result.total_sales || 0);
      setTotalProfit(result.total_profit || 0);
    }
    if (!silent) setLoading(false);
  }, [debouncedSearch, statusFilter, providerFilter, periodFilter, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter, providerFilter, periodFilter]);

  useEffect(() => {
    loadTransactions();
    loadStats();
  }, [loadTransactions, loadStats]);

  // Real-time: dalab cusub ama status isbeddelay → isla markiiba cusboonaysii
  useEffect(() => {
    const channel = supabase
      .channel('transactions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadTransactions(true);
        loadStats();
      })
      .subscribe();
    const interval = setInterval(() => {
      loadTransactions(true);
      loadStats();
    }, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadTransactions, loadStats]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-500 hover:bg-red-600">Failed</Badge>;
      case 'timeout':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Timeout - Verify</Badge>;
      case 'pending':
      case 'queued':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
      case 'payment_confirmed':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Confirmed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleManualVerify = async (orderId: string) => {
    try {
      await supabase
        .from('orders')
        .update({
          delivery_status: 'delivered',
          delivery_notes: 'Manually verified by admin',
          delivered_at: new Date().toISOString()
        })
        .eq('id', orderId);
      loadTransactions();
    } catch (error) {
      console.error('Manual verify error:', error);
    }
  };

  const sToday = statsData?.transactions_today ?? 0;
  const sSalesToday = statsData?.sales_today ?? 0;
  const sCostToday = statsData?.cost_today ?? 0;
  const sSalesMonth = statsData?.sales_this_month ?? 0;
  const sCostMonth = statsData?.cost_this_month ?? 0;
  const sProfit = statsData?.total_profit ?? 0;
  const sCostPeriod = statsData?.cost_period ?? 0;

  const periodLabel = periodFilter === 'today' ? 'Today' : periodFilter === 'yesterday' ? 'Yesterday' : periodFilter === 'week' ? 'This Week' : periodFilter === 'month' ? 'This Month' : periodFilter === 'year' ? 'This Year' : 'All Time';

  return (
    <div className="space-y-3">
      {/* Summary Cards — one compact row */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        <Card className="bg-blue-500 text-white border-0 shadow-md">
          <CardContent className="p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs text-blue-100 font-medium truncate">Transactions</p>
            <p className="text-sm sm:text-2xl font-bold mt-0.5 truncate">{sToday}</p>
            <p className="text-[9px] sm:text-[11px] text-blue-100 mt-1 truncate">Cost: ${Number(sCostToday).toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-600 text-white border-0 shadow-md">
          <CardContent className="p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs text-purple-100 font-medium truncate">Sales</p>
            <p className="text-sm sm:text-2xl font-bold mt-0.5 truncate">${Number(sSalesToday).toFixed(2)}</p>
            <p className="text-[9px] sm:text-[11px] text-purple-100 mt-1 truncate">Cost: ${Number(sCostToday).toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-600 text-white border-0 shadow-md">
          <CardContent className="p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs text-gray-300 font-medium truncate">Monthly</p>
            <p className="text-sm sm:text-2xl font-bold mt-0.5 truncate">${Number(sSalesMonth).toFixed(2)}</p>
            <p className="text-[9px] sm:text-[11px] text-gray-300 mt-1 truncate">Cost: ${Number(sCostMonth).toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500 text-white border-0 shadow-md">
          <CardContent className="p-2 sm:p-4">
            <p className="text-[10px] sm:text-xs text-emerald-100 font-medium truncate">Profit</p>
            <p className="text-sm sm:text-2xl font-bold mt-0.5 truncate">${Number(sProfit).toFixed(2)}</p>
            <p className="text-[9px] sm:text-[11px] text-emerald-100 mt-1 truncate">Cost: ${Number(sCostPeriod).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search — full width */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === 'so' ? 'Raadi Phone/ID...' : 'Search by Phone/ID...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Filters + Export — one row */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 flex-1 min-w-0 text-xs px-2">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="h-9 flex-1 min-w-0 text-xs px-2">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="h-9 flex-1 min-w-0 text-xs px-2">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 shrink-0"
          onClick={() => exportTransactionsPDF(transactions, {
            totalCount, totalSales, totalProfit,
            period: periodLabel
          })}
          disabled={transactions.length === 0}
        >
          <FileDown className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">PDF</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 shrink-0"
          onClick={() => exportTransactionsExcel(transactions, {
            totalCount, totalSales, totalProfit,
            period: periodLabel
          })}
          disabled={transactions.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Excel</span>
        </Button>
      </div>

      {/* Transactions — mobile cards / desktop table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">
            {language === 'so' ? 'Wax transaction ah lama helin' : 'No transactions found'}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {transactions.map((t) => {
                const profit = getProfit(t);
                const isPositiveProfit = profit > 0;

                const isOpen = expandedId === t.id;

                return (
                  <div key={t.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : t.id)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left active:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-muted-foreground truncate">
                          #{t.id.substring(0, 8).toUpperCase()} · {format(new Date(t.created_at), 'MMM dd, HH:mm')}
                        </p>
                        <p className="font-medium text-sm truncate mt-0.5">{t.package_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.data_amount} · {t.provider_name}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {getStatusBadge(t.delivery_status || t.status)}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                          <span className="truncate">{(t.sender_phone || t.customer_phone || '').replace('+252', '')}</span>
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.receiver_phone?.replace('+252', '') || '-'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="rounded-md bg-blue-500/10 px-1 py-1.5">
                            <p className="text-[9px] text-muted-foreground">Selling</p>
                            <p className="text-xs font-bold text-blue-600">${Number(t.selling_price).toFixed(2)}</p>
                          </div>
                          <div className="rounded-md bg-muted px-1 py-1.5">
                            <p className="text-[9px] text-muted-foreground">Cost</p>
                            <p className="text-xs font-semibold">${Number(getCost(t)).toFixed(2)}</p>
                          </div>
                          <div className={`rounded-md px-1 py-1.5 ${isPositiveProfit ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <p className="text-[9px] text-muted-foreground">Profit</p>
                            <p className={`text-xs font-bold ${isPositiveProfit ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositiveProfit ? '+' : ''}${formatPrice(profit)}
                            </p>
                          </div>
                        </div>
                        {t.delivery_status === 'timeout' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-full text-xs"
                            onClick={() => handleManualVerify(t.id)}
                          >
                            ✓ Xaqiiji
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <TableHead className="text-white font-semibold">TranId</TableHead>
                    <TableHead className="text-white font-semibold">Time</TableHead>
                    <TableHead className="text-white font-semibold">Description</TableHead>
                    <TableHead className="text-white font-semibold text-right">Selling</TableHead>
                    <TableHead className="text-white font-semibold text-right">Cost</TableHead>
                    <TableHead className="text-white font-semibold text-right">Profit</TableHead>
                    <TableHead className="text-white font-semibold">Provider</TableHead>
                    <TableHead className="text-white font-semibold">Sender</TableHead>
                    <TableHead className="text-white font-semibold">Receiver</TableHead>
                    <TableHead className="text-white font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t, index) => {
                    const profit = getProfit(t);
                    const isPositiveProfit = profit > 0;

                    return (
                      <TableRow key={t.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                        <TableCell className="font-mono text-sm">
                          {t.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(t.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-48">
                            <p className="font-medium truncate">{t.package_name}</p>
                            <p className="text-xs text-muted-foreground">{t.data_amount}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(t.selling_price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${Number(getCost(t)).toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isPositiveProfit ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositiveProfit ? '+' : ''}${formatPrice(profit)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.provider_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {(t.sender_phone || t.customer_phone || '').replace('+252', '')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {t.receiver_phone?.replace('+252', '') || '-'}
                        </TableCell>
                        <TableCell className="text-center flex items-center gap-2 justify-center">
                          {getStatusBadge(t.delivery_status || t.status)}
                          {t.delivery_status === 'timeout' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2 h-6 px-2 text-xs"
                              onClick={() => handleManualVerify(t.id)}
                            >
                              ✓ Xaqiiji
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Footer Summary + Pagination */}
        {!loading && (
          <div className="border-t p-4 bg-muted/30">
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">{totalCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sales: </span>
                <span className="font-bold text-blue-600">${Number(totalSales).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Profit: </span>
                <span className="font-bold text-green-600">${Number(totalProfit).toFixed(2)}</span>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
