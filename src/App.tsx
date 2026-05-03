import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Suggestions from "./pages/Suggestions";
import Wallets from "./pages/Wallets";
import Markets from "./pages/Markets";
import History from "./pages/History";
import Settings from "./pages/Settings";
import CrossMarket from "./pages/CrossMarket";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/suggestions" element={<Layout><Suggestions /></Layout>} />
          <Route path="/wallets" element={<Layout><Wallets /></Layout>} />
          <Route path="/markets" element={<Layout><Markets /></Layout>} />
          <Route path="/cross-market" element={<Layout><CrossMarket /></Layout>} />
          <Route path="/history" element={<Layout><History /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
