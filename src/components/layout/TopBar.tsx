import { Bell, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { fmtUSD } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";

const cnHeader = (m: boolean) =>
  m
    ? "relative flex h-[52px] items-center justify-between border-b border-border bg-background/80 backdrop-blur px-3 gap-2"
    : "flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 sm:px-6 gap-3";
const cnIconBtn = (m: boolean) =>
  m
    ? "relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
    : "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors";
const cnAvatarBtn = (m: boolean) =>
  m
    ? "inline-flex h-11 w-11 items-center justify-center rounded-full bg-info text-xs font-bold text-white"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full bg-info text-xs font-bold text-white";

const titles: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard", subtitle: "Overview of suggestions and signals" },
  "/suggestions": { title: "Signals", subtitle: "Live trade ideas from smart wallet activity" },
  "/signals": { title: "Signals", subtitle: "Live trade ideas from smart wallet activity" },
  "/sports": { title: "Sports", subtitle: "Live odds board and Vegas comparisons" },
  "/markets": { title: "Markets", subtitle: "Polymarket markets you're watching" },
  "/wallets": { title: "Smart Wallets", subtitle: "Tracked top performers" },
  "/cross-market": { title: "Cross-Market Radar", subtitle: "Polymarket vs Kalshi & Vegas" },
  "/history": { title: "History", subtitle: "Past suggestions and outcomes" },
  "/tracker": { title: "Bet Tracker", subtitle: "Log and review your bets" },
  "/settings": { title: "Settings", subtitle: "Bankroll, alerts and preferences" },
  "/admin": { title: "Admin", subtitle: "System monitoring and tools" },
};

export function TopBar(_: { onMenuClick?: () => void } = {}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { bankroll, kellyMultiplier } = useAppStore((s) => s.settings);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const suggestions = useAppStore((s) => s.suggestions);
  const unreadCount = (() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return suggestions.filter((s) => {
      const t = Date.parse(s.createdAt);
      return !isNaN(t) && t >= cutoff && s.status === "active";
    }).length;
  })();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    setDemoMode(false);
    setMenuOpen(false);
    navigate("/");
  };

  const meta = titles[pathname] ?? { title: "EdgeHunter" };

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {isDemoMode && !user && (
        <div className="flex items-center justify-center gap-2 bg-warning/15 border-b border-warning/30 px-4 py-1.5 text-xs text-warning">
          <span className="font-semibold">Demo Mode</span>
          <span className="text-warning/80">— data is not saved.</span>
          <button
            onClick={() => { setDemoMode(false); navigate("/"); }}
            className="font-semibold underline hover:text-warning/80"
          >
            Sign in to save your data →
          </button>
        </div>
      )}
    <header
      className={cnHeader(isMobile)}
    >
      {isMobile ? (
        <>
          <button
            onClick={() => navigate("/")}
            aria-label="Home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md"
          >
            <EdgeHunterLogo size={28} variant="icon" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold tracking-tight text-foreground truncate max-w-[55%] text-center">
            {meta.title}
          </h1>
        </>
      ) : (
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">{meta.title}</h1>
            <p className="hidden sm:block text-xs text-muted-foreground font-mono truncate">
              Bankroll {fmtUSD(bankroll, { compact: true })} · Kelly {kellyMultiplier.toFixed(2)}x
              {meta.subtitle && <span className="ml-2 font-sans">· {meta.subtitle}</span>}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        {!isMobile && (
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live Data
        </div>
        )}
        {isMobile && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        )}
        <button
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : "Notifications"}
          onClick={() => navigate("/suggestions")}
          className={cnIconBtn(isMobile)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-info text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        {!user ? (
          <Link
            to="/auth"
            onClick={() => setDemoMode(false)}
            className="inline-flex items-center rounded-md bg-info px-4 text-sm font-semibold text-white hover:bg-info/90 transition-colors min-h-[44px] md:min-h-0 md:px-3 md:py-1.5 md:text-xs"
          >
            Sign In
          </Link>
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cnAvatarBtn(isMobile)}
              aria-label="User menu"
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-50 w-[180px] rounded-md border border-border bg-card shadow-lg overflow-hidden">
                <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border">
                  {user.email}
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                >
                  <SettingsIcon className="h-3.5 w-3.5" /> Settings
                </button>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 text-left"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
    </div>
  );
}

export default TopBar;
