import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, CreditCard, DollarSign, Clock, AlertTriangle, CalendarClock } from "lucide-react";

interface SubRow {
  tenant_id: string;
  name: string;
  slug: string;
  tenant_status: string;
  plan: string | null;
  amount: number | null;
  trial_starts_at?: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  grace_days?: number | null;
  state: string;
  days_left: number | null;
  last_payment_at: string | null;
  total_paid: number | null;
}

/** yyyy-MM-ddTHH:mm in local time for <input type="datetime-local"> */
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};


const STATE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Sugaya bilow", variant: "outline" },
  trialing: { label: "Tijaabo", variant: "secondary" },
  active: { label: "Firfircoon", variant: "default" },
  grace: { label: "Muddo nabad ah", variant: "outline" },
  expired: { label: "Dhacay", variant: "destructive" },
};


const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SubscriptionsManager() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [payFor, setPayFor] = useState<SubRow | null>(null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState("manual");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [trialFor, setTrialFor] = useState<SubRow | null>(null);
  const [trialStart, setTrialStart] = useState("");
  const [trialEnd, setTrialEnd] = useState("");
  const [graceDays, setGraceDays] = useState("3");
  const [savingTrial, setSavingTrial] = useState(false);

  const openTrial = (r: SubRow) => {
    const start = r.trial_starts_at ? new Date(r.trial_starts_at) : new Date();
    const end = r.trial_ends_at
      ? new Date(r.trial_ends_at)
      : r.current_period_end
        ? new Date(r.current_period_end)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setTrialStart(toLocalInput(start));
    setTrialEnd(toLocalInput(end));
    setGraceDays(String(r.grace_days ?? 3));
    setTrialFor(r);
  };

  const submitTrial = async () => {
    if (!trialFor) return;
    if (!trialStart || !trialEnd || new Date(trialEnd) <= new Date(trialStart)) {
      toast.error("Taariikhda dhammaadku waa inay ka danbeysaa tan bilowga");
      return;
    }
    setSavingTrial(true);
    const { data, error } = await supabase.rpc("set_tenant_trial", {
      _tenant: trialFor.tenant_id,
      _starts_at: new Date(trialStart).toISOString(),
      _ends_at: new Date(trialEnd).toISOString(),
      _grace_days: Math.max(0, Number(graceDays) || 0),
    } as any);
    setSavingTrial(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error(res?.error || error?.message || "Lama cusboonaysiin");
      return;
    }
    toast.success("Muddada tijaabada waa la cusboonaysiiyay");
    setTrialFor(null);
    load();
  };


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_tenant_subscriptions");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as unknown as SubRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const runExpiry = async () => {
    const { data, error } = await supabase.rpc("expire_tenant_subscriptions");
    if (error) return toast.error(error.message);
    const n = (data as { suspended?: number } | null)?.suspended ?? 0;
    toast.success(n > 0 ? `${n} shirkadood ayaa la xiray` : "Wax la xiro ma jiraan");
    load();
  };

  const submitPayment = async () => {
    if (!payFor) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("record_tenant_payment", {
      _tenant: payFor.tenant_id,
      _plan: plan,
      _amount: plan === "monthly" ? 10 : 100,
      _method: method,
      _reference: reference || null,
      _note: null,
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error(res?.error || error?.message || "Lama diiwaangelin");
      return;
    }
    toast.success("Lacagta waa la diiwaangeliyay, mudadana waa la kordhiyay");
    setPayFor(null);
    setReference("");
    load();
  };

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.slug?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPaid = rows.reduce((s, r) => s + Number(r.total_paid ?? 0), 0);
  const expiring = rows.filter((r) => r.state === "grace" || r.state === "expired").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Shirkado</div>
            <div className="text-2xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Lacagta guud</div>
            <div className="text-2xl font-bold">${totalPaid.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Dhacay / nabad</div>
            <div className="text-2xl font-bold text-destructive">{expiring}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Qiimaha</div>
            <div className="text-sm font-semibold">$10 / bil · $100 / sanad</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Subscriptions
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Raadi shirkad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 md:w-56"
            />
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={runExpiry} title="Xir kuwa mudadoodu dhammaatay">
              <AlertTriangle className="h-4 w-4 mr-1" /> Hubi dhicitaanka
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.map((r) => {
            const st = STATE_LABEL[r.state] ?? STATE_LABEL['expired'];
            return (
              <div
                key={r.tenant_id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{r.name}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {r.tenant_status === "suspended" && <Badge variant="destructive">Xiran</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>/{r.slug}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Dhacaya: {fmt(r.current_period_end)}
                      {typeof r.days_left === "number" && r.days_left > 0 ? ` (${r.days_left} maalmood)` : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Bixiyay: ${Number(r.total_paid ?? 0).toFixed(0)}
                    </span>
                    <span>Qorshaha: {r.plan ?? "trial"}</span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Trial: {fmt(r.trial_starts_at ?? null)} →{" "}
                      {fmt(r.trial_ends_at)}
                    </span>

                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openTrial(r)}>
                    <CalendarClock className="h-4 w-4 mr-1" /> Trial
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPayFor(r);
                      setPlan("monthly");
                    }}
                  >
                    Diiwaangeli lacag
                  </Button>
                </div>

              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Wax shirkad ah lama helin</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lacag u diiwaangeli — {payFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Qorshaha</label>
              <Select value={plan} onValueChange={(v) => setPlan(v as "monthly" | "yearly")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bishii — $10</SelectItem>
                  <SelectItem value="yearly">Sanadkii — $100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Habka</label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Gacanta (EVC / Zaad / Cash)</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tixraac (ikhtiyaari)</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX ID / lambar" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>
              Jooji
            </Button>
            <Button onClick={submitPayment} disabled={saving}>
              {saving ? "Waa la diiwaangelinayaa..." : "Diiwaangeli"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <Dialog open={!!trialFor} onOpenChange={(o) => !o && setTrialFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beddel muddada tijaabada — {trialFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Bilaabmaya</label>
              <Input type="datetime-local" value={trialStart} onChange={(e) => setTrialStart(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Dhammaanaya</label>
              <Input type="datetime-local" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Maalmaha grace-ka</label>
              <Input
                type="number"
                min={0}
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Marka muddadu dhammaato waxaa bilaabmaya grace-ka, kadibna reseller-ka waxaa la tusayaa shaashadda
              xiritaanka.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialFor(null)}>
              Jooji
            </Button>
            <Button onClick={submitTrial} disabled={savingTrial}>
              {savingTrial ? "Waa la kaydinayaa..." : "Kaydi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
