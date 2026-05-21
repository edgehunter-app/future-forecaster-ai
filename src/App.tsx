import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import KeyboardShortcuts from "@/components/ui/KeyboardShortcuts";
import WelcomeModal from "@/components/onboarding/WelcomeModal";
import InstallBanner from "@/components/pwa/InstallBanner";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/useAppStore";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const Wallets = lazy(() => import("./pages/Wallets"));
const Markets = lazy(() => import("./pages/Markets"));
const History = lazy(() => import("./pages/History"));
const Settings = lazy(() => import("./pages/Settings"));
const CrossMarket = lazy(() => import("./pages/CrossMarket"));
const Sports = lazy(() => import("./pages/Sports"));
const Admin = lazy(() => import("./pages/Admin"));
const BetTracker = lazy(() => import("./pages/BetTracker"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));

const queryClient = new QueryClient();

const wrap = (node: React.ReactNode) => (
  <Layout>
    <Suspense fallback={<PageLoadingSkeleton />}>{node}</Suspense>
  </Layout>
);

function AppRoutes() {
  const { user, loading } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);

  // One-time clear of any stuck demo mode in legacy localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("edgehunter-store");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.isDemoMode === true) {
          parsed.state.isDemoMode = false;
          localStorage.setItem("edgehunter-store", JSON.stringify(parsed));
          console.log("Cleared stuck demo mode from localStorage");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Note: demo mode is user-controlled via Settings. We do NOT auto-clear it
  // for logged-in users — that would make the Settings toggle un-toggleable.

  if (loading) return <PageLoadingSkeleton />;

  if (!user && !isDemoMode) {
    return (
      <Suspense fallback={<PageLoadingSkeleton />}>
        <Routes>
          <Route path="*" element={<Auth />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <>
      <KeyboardShortcuts />
      <WelcomeModal />
      <InstallBanner />
      <Routes>
        <Route path="/auth" element={<Suspense fallback={<PageLoadingSkeleton />}><Auth /></Suspense>} />
        <Route path="/" element={wrap(<Dashboard />)} />
        <Route path="/suggestions" element={wrap(<Suggestions />)} />
        <Route path="/wallets" element={wrap(<Wallets />)} />
        <Route path="/markets" element={wrap(<Markets />)} />
        <Route path="/cross-market" element={wrap(<CrossMarket />)} />
        <Route path="/sports" element={wrap(<Sports />)} />
        <Route path="/tracker" element={wrap(<BetTracker />)} />
        <Route path="/history" element={wrap(<History />)} />
        <Route path="/settings" element={wrap(<ErrorBoundary><Settings /></ErrorBoundary>)} />
        <Route path="/admin" element={wrap(<Admin />)} />
        <Route path="*" element={<Suspense fallback={<PageLoadingSkeleton />}><NotFound /></Suspense>} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
