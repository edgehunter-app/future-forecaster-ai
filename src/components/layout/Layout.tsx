import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import PageTransition from "./PageTransition";
import IconUpdateBanner from "@/components/IconUpdateBanner";
import TopLoadingBar from "@/components/ui/TopLoadingBar";
import { useAppStore } from "@/store/useAppStore";

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const sportsLoading = useAppStore((s) => s.sportsLoading);
  const crossLoading = useAppStore((s) => s.crossMarketLoading);
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <TopLoadingBar loading={sportsLoading || crossLoading} />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <IconUpdateBanner />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <PageTransition pageKey={pathname}>
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">{children}</div>
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

export default Layout;
