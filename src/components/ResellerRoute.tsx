import { useEffect, useState } from 'react';
import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { clearTenantSelection } from '@/lib/tenantSession';
import TenantBlockedScreen from '@/components/reseller/TenantBlockedScreen';


const MANAGER_ROLES = ['owner', 'admin', 'manager'];

/**
 * Guards /reseller: only a signed-in user who is owner/admin of a tenant
 * may enter. Platform super admins must use /superadmin instead.
 */
const ResellerRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState<{
    reason: 'expired' | 'scheduled';
    endedAt: string | null;
    startsAt: string | null;
  } | null>(null);


  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { clearTenantSelection(); navigate('/reseller/login', { replace: true }); return; }

      const [{ data: membership, error: membershipError }, { data: superRole }] = await Promise.all([
        supabase
          .from('tenant_members')
          .select('member_role, role, tenant_id, tenants(status)')
          .eq('user_id', user.id),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .limit(1)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (superRole) {
        clearTenantSelection();
        await supabase.auth.signOut();
        toast({
          title: 'Reseller login',
          description: 'Fadlan geli email-ka iyo password-ka reseller-ka.',
          variant: 'destructive',
        });
        navigate('/reseller/login', { replace: true });
        return;
      }

      if (membershipError) {
        toast({
          title: 'Khalad',
          description: 'Xogta reseller-ka lama xaqiijin karin. Fadlan mar kale isku day.',
          variant: 'destructive',
        });
        navigate('/reseller/login', { replace: true });
        return;
      }

      const manager = (membership ?? []).find((m: any) =>
        MANAGER_ROLES.includes(String(m.member_role ?? m.role ?? '').toLowerCase())
      );

      if (manager?.tenant_id) {
        localStorage.setItem('active_tenant_id', manager.tenant_id);
        localStorage.removeItem('public_tenant_slug');

        const suspendedTenant = (manager.tenants?.status ?? 'active') === 'suspended';
        const { data: subData } = await supabase.rpc('get_tenant_subscription', {
          _tenant: manager.tenant_id,
        });
        if (!active) return;
        const sub = (subData ?? {}) as {
          state?: string;
          current_period_end?: string | null;
          trial_starts_at?: string | null;
        };

        if (sub.state === 'scheduled') {
          setBlocked({ reason: 'scheduled', startsAt: sub.trial_starts_at ?? null, endedAt: null });
        } else if (suspendedTenant || sub.state === 'expired') {
          setBlocked({ reason: 'expired', endedAt: sub.current_period_end ?? null, startsAt: null });
        } else {
          setAllowed(true);
        }
        setChecking(false);
        return;
      }


      toast({
        title: 'Ma lihid fasax',
        description: 'Kaliya maamulaha tenant-ka ayaa geli kara reseller dashboard-ka',
        variant: 'destructive',
      });
      clearTenantSelection();
      await supabase.auth.signOut();
      navigate('/reseller/login', { replace: true });
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearTenantSelection();
        navigate('/reseller/login', { replace: true });
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (!checking && blocked) {
    return (
      <TenantBlockedScreen reason={blocked.reason} endedAt={blocked.endedAt} startsAt={blocked.startsAt} />
    );
  }

  if (checking || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return <>{children}</>;
};

export default ResellerRoute;
