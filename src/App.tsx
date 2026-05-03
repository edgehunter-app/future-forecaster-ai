import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import KeyboardShortcuts from "@/components/ui/KeyboardShortcuts";
import WelcomeModal from "@/components/onboarding/WelcomeModal";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const Wallets = lazy(() => import("./pages/Wallets"));
const Markets = lazy(() => import("./pages/Markets"));
const History = lazy(() => import("./pages/History"));
const Settings = lazy(() => import("./pages/Settings"));
const CrossMarket = lazy(() => import("./pages/CrossMarket"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const wrap = (node: React.ReactNode) => (
  <Layout>
    <Suspense fallback={<PageLoadingSkeleton />}>{node}</Suspense>
  </Layout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <KeyboardShortcuts />
        <WelcomeModal />
        <Routes>
          <Route path="/" element={wrap(<Dashboard />)} />
          <Route path="/suggestions" element={wrap(<Suggestions />)} />
          <Route path="/wallets" element={wrap(<Wallets />)} />
          <Route path="/markets" element={wrap(<Markets />)} />
          <Route path="/cross-market" element={wrap(<CrossMarket />)} />
          <Route path="/history" element={wrap(<History />)} />
          <Route path="/settings" element={wrap(<Settings />)} />
          <Route path="*" element={<Suspense fallback={<PageLoadingSkeleton />}><NotFound /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
