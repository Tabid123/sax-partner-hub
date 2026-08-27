import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Building2, Image as ImageIcon } from "lucide-react";
import ProviderClonePicker from "./ProviderClonePicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const slugify = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** yyyy-MM-ddTHH:mm in local time, for <input type="datetime-local"> */
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const defaultStart = () => toLocalInput(new Date());
const defaultEnd = () => toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

export default function CreateResellerDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [primary, setPrimary] = useState("#0f172a");
  const [secondary, setSecondary] = useState("#ffffff");
  const [providers, setProviders] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [trialStart, setTrialStart] = useState(defaultStart);
  const [trialEnd, setTrialEnd] = useState(defaultEnd);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(""); setSlug(""); setEmail(""); setPassword("");
    setPrimary("#0f172a"); setSecondary("#ffffff"); setProviders([]);
    setLogoFile(null); setLogoPreview(null);
    setTrialStart(defaultStart()); setTrialEnd(defaultEnd());
  };


  const submit = async () => {
    if (!name.trim() || !slug.trim() || !email.trim() || password.length < 6) {
      toast.error("Buuxi magaca, slug, email iyo password (6+)");
      return;
    }
    if (!trialStart || !trialEnd || new Date(trialEnd) <= new Date(trialStart)) {
      toast.error("Taariikhda dhammaadka trial-ka waa inay ka danbeysaa tan bilowga");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("superadmin-tenants", {
        body: {
          action: "create",
          name: name.trim(),
          slug: slugify(slug),
          email: email.trim(),
          password,
          primary_color: primary,
          secondary_color: secondary,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Lama abuurin");

      const tenantId = data.tenant?.id as string;

      if (tenantId) {
        const { data: trialRes, error: trialErr } = await supabase.rpc("set_tenant_trial", {
          _tenant: tenantId,
          _starts_at: new Date(trialStart).toISOString(),
          _ends_at: new Date(trialEnd).toISOString(),
          _grace_days: 3,
        } as any);
        const tr = (trialRes ?? {}) as { ok?: boolean; error?: string };
        if (trialErr || !tr.ok) {
          toast.error(`Trial-ka lama dejin: ${tr.error || trialErr?.message || "khalad"}`);
        }
      }


      if (logoFile && tenantId) {
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${tenantId}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("tenant-logos")
          .upload(path, logoFile, { upsert: true, cacheControl: "3600" });
        if (upErr) {
          toast.error(`Logo-ga lama gelin: ${upErr.message}`);
        } else {
          const { error: tErr } = await supabase
            .from("tenants")
            .update({ logo_url: path })
            .eq("id", tenantId);
          if (tErr) toast.error(`Logo-ga lama xirin: ${tErr.message}`);
        }
      }

      if (providers.length > 0 && tenantId) {
        const { data: res, error: rpcErr } = await supabase.rpc("clone_tenant_providers", {
          _target_tenant: tenantId,
          _provider_names: providers,
        } as any);
        if (rpcErr) {
          toast.error(`Reseller waa la abuuray, laakiin shirkadaha lama koobiyeyn: ${rpcErr.message}`);
        } else {
          const r: any = res ?? {};
          toast.success(
            `Reseller waa la abuuray — shirkado ${r.providers ?? 0}, xirmooyin ${r.packages ?? 0}, flows ${r.flows ?? 0}`
          );
        }
      } else {
        toast.success("Reseller waa la abuuray");
      }
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Reseller cusub
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Magaca ganacsiga</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }}
              placeholder="Najax Data"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug (link)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="najax" className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email admin</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logo-ga shirkadda</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    setLogoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <p className="text-xs text-muted-foreground">PNG ama JPG — ikhtiyaari.</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Muddada tijaabada (trial)</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bilaabmaya</p>
                <Input
                  type="datetime-local"
                  value={trialStart}
                  onChange={(e) => setTrialStart(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Dhammaanaya</p>
                <Input
                  type="datetime-local"
                  value={trialEnd}
                  onChange={(e) => setTrialEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Marka muddadu dhammaato waxaa bilaabmaya 3 maalmood oo grace ah, kadibna xisaabta si toos ah ayaa
              loo xirayaa.
            </p>
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-14 p-1 shrink-0" />
                <Input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  placeholder="#0f172a"
                  className="h-10 font-mono uppercase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-14 p-1 shrink-0" />
                <Input
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  placeholder="#ffffff"
                  className="h-10 font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Shirkadaha la koobiyeynayo</Label>
            <p className="text-xs text-muted-foreground">
              Flows-ka USSD, qaybaha, xirmooyinka, SIM PIN iyo wholesale tiers si otomaatig ah ayaa loo koobiyeeyaa.
            </p>
            <ProviderClonePicker selected={providers} onChange={setProviders} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Jooji</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Abuur reseller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
