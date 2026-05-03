import { Bell, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { fmtUSD } from "@/lib/utils";

const titles: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of suggestions and signals" },
  "/suggestions": { title: "Suggestions", subtitle: "Live trade ideas from smart wallet activity" },
  "/wallets": { title: "Smart Wallets", subtitle: "Tracked top performers" },
  "/markets": { title: "Markets", subtitle: "Polymarket markets you're watching" },
  "/history": { title: "History", subtitle: "Past suggestions and outcomes" },
  "/settings": { title: "Settings", subtitle: "Bankroll, alerts and preferences" },
};

export function TopBar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { pathname } = useLocation();
  const { bankroll, kellyMultiplier } = useAppStore((s) => s.settings);
  const meta = titles[pathname] ?? { title: "PolySignal" };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 sm:px-6 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">{meta.title}</h1>
          <p className="hidden sm:block text-xs text-muted-foreground font-mono truncate">
            Bankroll {fmtUSD(bankroll, { compact: true })} · Kelly {kellyMultiplier.toFixed(2)}x
            {meta.subtitle && <span className="ml-2 font-sans">· {meta.subtitle}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live Data
        </div>
        <span className="sm:hidden relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-info" />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
