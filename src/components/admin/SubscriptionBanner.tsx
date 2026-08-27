import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface SubState {
  ok: boolean;
  plan?: string;
  state?: "trialing" | "active" | "grace" | "expired";
  current_period_end?: string | null;
  days_left?: number;
  grace_days_left?: number;
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SubscriptionBanner() {
  const [sub, setSub] = useState<SubState | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_tenant_subscription", { _tenant: undefined }).then(({ data }) => {
      if (alive) setSub(data as unknown as SubState);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!sub?.ok || !sub.state) return null;
  if (sub.state === "active" && (sub.days_left ?? 0) > 7) return null;

  const tone =
    sub.state === "expired"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : sub.state === "grace"
        ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
        : "border-primary/40 bg-primary/10 text-foreground";

  const Icon = sub.state === "active" ? CheckCircle2 : sub.state === "trialing" ? Clock : AlertTriangle;

  const title =
    sub.state === "trialing"
      ? `Tijaabo bilaash ah — ${sub.days_left ?? 0} maalmood ayaa kuu hadhay`
      : sub.state === "grace"
        ? `Lacagtu way dhacday — ${sub.grace_days_left ?? 0} maalmood oo nabad ah ayaa hadhay`
        : sub.state === "expired"
          ? "Isdiiwaangelintaadu way dhacday — adeegga waa la xiray"
          : `Isdiiwaangelintaadu waxay dhacaysaa ${fmt(sub.current_period_end)}`;

  return (
    <div className={`rounded-lg border px-4 py-3 mb-4 ${tone}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs opacity-80">
              Qorshayaasha: <strong>$10 bishii</strong> ama <strong>$100 sanadkii</strong>. Dhicitaanka:{" "}
              {fmt(sub.current_period_end)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() =>
            window.open(
              "https://wa.me/252612000000?text=" +
                encodeURIComponent("Waxaan rabaa inaan bixiyo subscription-ka (bishii $10 / sanadkii $100)"),
              "_blank",
            )
          }
        >
          Bixi hadda
        </Button>
      </div>
    </div>
  );
}
