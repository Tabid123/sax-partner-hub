import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "@/lib/router-compat";
import Landing from '@/pages/Landing';

/** True when the app is launched from the home screen (installed PWA). */
const isStandalone = () => {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
};

const savedSlug = () => {
  try {
    return localStorage.getItem('public_tenant_slug')?.trim() || null;
  } catch {
    return null;
  }
};

/**
 * Root route: `/?t=<slug>` is a reseller storefront link — send the visitor
 * straight into that tenant's shop. Plain `/` shows the marketing landing page,
 * except when the app runs as an installed PWA: then we reopen the storefront
 * of the tenant it was installed from.
 */
const RootRoute = () => {
  const [params] = useSearchParams();
  const slug = params.get('t')?.trim();
  const [pwaSlug, setPwaSlug] = useState<string | null>(null);

  useEffect(() => {
    if (slug) return;
    if (isStandalone()) setPwaSlug(savedSlug());
  }, [slug]);

  const target = slug || pwaSlug;
  if (target) {
    return <Navigate to={`/providers?t=${encodeURIComponent(target)}`} replace />;
  }

  return <Landing />;
};

export default RootRoute;
