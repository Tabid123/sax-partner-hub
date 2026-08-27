import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, LogOut, Shield, Building2, CreditCard, Radio, Smartphone } from "lucide-react";
import iftinLogo from "@/assets/iftin-logo.jpg";

const SuperAdminTenants = lazy(() => import("@/components/admin/SuperAdminTenants"));
const SubscriptionsManager = lazy(() => import("@/components/admin/SubscriptionsManager"));
const UssdFlowsManager = lazy(() => import("@/components/admin/UssdFlowsManager"));
const SuperAdminApps = lazy(() => import("@/components/admin/SuperAdminApps"));

const TabLoader = () => (
  <div className="flex justify-center items-center p-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("tenants");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/superadmin/login", { replace: true });
        return;
      }
      setUserEmail(user.email ?? null);

      const { data: superAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (!superAdmin) {
        await supabase.auth.signOut();
        toast.error("Ma lihid fasax. Kani waa super admin keliya.");
        navigate("/superadmin/login", { replace: true });
        return;
      }
      setIsSuperAdmin(true);
      setLoading(false);
    };
    checkAccess();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/superadmin/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={iftinLogo} alt="IFTIN Logo" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Super Admin
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{userEmail}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Ka bax
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Platform Management</CardTitle>
            <CardDescription>
              Tenants and subscriptions are managed from this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="tenants">
                  <Building2 className="h-4 w-4 mr-2" /> Tenants
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                  <CreditCard className="h-4 w-4 mr-2" /> Subscriptions
                </TabsTrigger>
                <TabsTrigger value="flows">
                  <Radio className="h-4 w-4 mr-2" /> USSD Flows
                </TabsTrigger>
                <TabsTrigger value="apps">
                  <Smartphone className="h-4 w-4 mr-2" /> Apps
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tenants">
                <Suspense fallback={<TabLoader />}>
                  <SuperAdminTenants />
                </Suspense>
              </TabsContent>
              <TabsContent value="subscriptions">
                <Suspense fallback={<TabLoader />}>
                  <SubscriptionsManager />
                </Suspense>
              </TabsContent>
              <TabsContent value="flows">
                <p className="mb-4 text-sm text-muted-foreground">
                  Flow-yadan waa kuwo la wadaago shirkadaha oo dhan. Tenant walba PIN-kiisa ayuu ka
                  badalaa dashboard-kiisa (Settings → SIM PIN); halkan waa tallaabooyinka menu-ga.
                </p>
                <Suspense fallback={<TabLoader />}>
                  <UssdFlowsManager />
                </Suspense>
              </TabsContent>
              <TabsContent value="apps">
                <Suspense fallback={<TabLoader />}>
                  <SuperAdminApps />
                </Suspense>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
