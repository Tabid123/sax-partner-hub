import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearTenantSelection } from "@/lib/tenantSession";
import { useNavigate } from "@/lib/router-compat";
import { AlertTriangle, CalendarClock, LogOut, MessageCircle } from "lucide-react";

interface Props {
  /** "expired" = mudada iyo grace-ka way dhammaadeen, "scheduled" = weli ma bilaaban */
  reason?: "expired" | "scheduled";
  endedAt?: string | null;
  startsAt?: string | null;
}

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function TenantBlockedScreen({ reason = "expired", endedAt, startsAt }: Props) {
  const navigate = useNavigate();
  const scheduled = reason === "scheduled";

  const signOut = async () => {
    clearTenantSelection();
    await supabase.auth.signOut();
    navigate("/reseller/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            scheduled ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {scheduled ? <CalendarClock className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </div>

        <h1 className="text-xl font-bold">
          {scheduled ? "Adeeggaagu weli ma bilaaban" : "Adeeggaaga waa la xiray"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {scheduled ? (
            <>
              Xisaabtaadu waxay furmaysaa <strong>{fmt(startsAt)}</strong>. Fadlan dib u soo noqo waqtigaas.
            </>
          ) : (
            <>
              Mudadii isdiiwaangelintaadu way dhammaatay <strong>{fmt(endedAt)}</strong>, sidoo kale muddadii
              nabadgelyada (3 maalmood) way dhaaftay. Si aad dib u furto, fadlan bixi lacagta.
            </>
          )}
        </p>

        {!scheduled && (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            Qorshayaasha: <strong>$10 bishii</strong> ama <strong>$100 sanadkii</strong>. Marka lacagta la
            diiwaangeliyo, xisaabtaada isla markiiba way furmaysaa.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {!scheduled && (
            <Button
              onClick={() =>
                window.open(
                  "https://wa.me/252612000000?text=" +
                    encodeURIComponent("Waxaan rabaa inaan bixiyo subscription-ka reseller-ka"),
                  "_blank",
                )
              }
            >
              <MessageCircle className="mr-2 h-4 w-4" /> La xiriir maamulaha
            </Button>
          )}
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Ka bax
          </Button>
        </div>
      </div>
    </div>
  );
}
