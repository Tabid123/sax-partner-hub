import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ConnectivityProvider } from "@/contexts/ConnectivityContext";
import { StatusBarColor } from "@/components/StatusBarColor";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useGlobalImagePreloader } from "@/hooks/useGlobalImagePreloader";
import { useEdgeToEdge } from "@/hooks/useEdgeToEdge";
import { useKeyboardInsets } from "@/hooks/useKeyboardInsets";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useAutoOnlineRedirect } from "@/hooks/useAutoOnlineRedirect";
import { usePendingIntentSync } from "@/hooks/usePendingIntentSync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function AppContent({ children }: { children: ReactNode }) {
  useOfflineCache();
  useGlobalImagePreloader();
  useEdgeToEdge();
  useKeyboardInsets();
  useAutoOnlineRedirect();
  usePendingIntentSync();
  const { showExitDialog, handleExitApp, handleCancelExit } = useAndroidBackButton();

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("anti-flash")?.remove();
      });
    });
  }, []);

  return (
    <>
      <div id="app-render-sentinel" hidden aria-hidden="true" />
      <StatusBarColor />
      {children}

      <AlertDialog open={showExitDialog} onOpenChange={handleCancelExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ka bax App-ka?</AlertDialogTitle>
            <AlertDialogDescription>
              Ma hubtaa inaad rabto inaad ka baxdo Iftin Internet app-ka?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExit}>Maya</AlertDialogCancel>
            <AlertDialogAction onClick={handleExitApp}>Haa, Ka bax</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Client-only app shell: the imported app relies on browser APIs
 * (Capacitor, localStorage, service worker), so it mounts after hydration.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <ConnectivityProvider>
      <ThemeProvider>
        <LanguageProvider>
          <TenantProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppContent>{children}</AppContent>
            </TooltipProvider>
          </TenantProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ConnectivityProvider>
  );
}
