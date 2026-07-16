import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomTabBar from "./BottomTabBar";
import PageTransition from "./PageTransition";
import TopLoadingBar from "@/components/ui/TopLoadingBar";
import { useAppStore } from "@/store/useAppStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsDemo } from "@/hooks/useIsDemo";
import DemoBanner from "@/components/demo/DemoBanner";
import DemoGateSheet from "@/components/demo/DemoGateSheet";
import { onDemoGate } from "@/lib/demoGate";

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const sportsLoading = useAppStore((s) => s.sportsLoading);
  const crossLoading = useAppStore((s) => s.crossMarketLoading);
  const isMobile = useIsMobile();
  const isDemo = useIsDemo();
  const [gate, setGate] = useState<{ open: boolean; feature?: string }>({ open: false });
  useEffect(() => onDemoGate((feature) => setGate({ open: true, feature })), []);
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <TopLoadingBar loading={sportsLoading || crossLoading} />
      {!isMobile && (
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      )}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        {isDemo && <DemoBanner />}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <PageTransition pageKey={pathname}>
            <div
              className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
              style={isMobile ? { paddingBottom: "calc(80px + env(safe-area-inset-bottom))" } : undefined}
            >
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
      {isMobile && <BottomTabBar />}
      <DemoGateSheet open={gate.open} onClose={() => setGate({ open: false })} feature={gate.feature} />
    </div>
  );
}

export default Layout;
