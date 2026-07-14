import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  House, Trophy, TrendingUp, LayoutGrid,
  Users, Clock, ArrowLeftRight, Settings as SettingsIcon, ChevronRight, BarChart2, Shield, Star,
} from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import HorseIcon from "@/components/icons/HorseIcon";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useLineMonitor } from "@/hooks/useLineMonitor";
import { useSubscription } from "@/hooks/useSubscription";

const MORE_ITEMS = [
  { to: "/tracker", label: "Bet Tracker", icon: BarChart2 },
  { to: "/cross-market", label: "Cross-Market", icon: ArrowLeftRight },
  { to: "/history", label: "History", icon: Clock },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const ADMIN_ITEM = { to: "/admin", label: "Admin", icon: Shield } as const;

export default function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useIsAdmin();
  const { tier, isBeta, loading: subLoading } = useSubscription();
  const showUpgrade = !subLoading && !isBeta && tier === "free";
  const fullGames = useAppStore((s) => s.fullGames);
  const strongMispricings = useAppStore((s) => s.sportsMispricings).filter(
    (m) => m.edge >= 0.05,
  ).length || (fullGames?.length ?? 0 > 0 ? 0 : 0);
  const { alerts } = useLineMonitor();
  const lineAlertCount = alerts.length;

  const moreItems = [
    ...(showUpgrade ? [{ to: "/upgrade", label: "Upgrade", icon: Star } as const] : []),
    ...MORE_ITEMS,
    ...(isAdmin ? [ADMIN_ITEM] : []),
  ];

  const isMoreActive = moreItems.some((i) => pathname.startsWith(i.to));

  const tabs = [
    { to: "/", label: "Home", icon: House, end: true, badge: 0 },
    { to: "/suggestions", label: "Signals", icon: Zap, end: false, badge: suggestionsCount, badgeColor: "destructive" as const },
    { to: "/sports", label: "Sports", icon: Trophy, end: false, badge: strongMispricings, badgeColor: "success" as const },
    { to: "/horse-racing", label: "Racing", icon: HorseIcon, end: false, badge: 0, isNew: Date.now() < new Date("2026-08-13").getTime() },
    { to: "/markets", label: "Markets", icon: TrendingUp, end: false, badge: 0 },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile navigation"
      >
        <ul className="flex items-stretch h-16">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors active:scale-95",
                    isActive
                      ? "text-info"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                      {tab.badge > 0 && (
                        <span className={cn(
                          "absolute -right-1.5 -top-1 h-2 w-2 rounded-full",
                          tab.badgeColor === "success" ? "bg-success" : "bg-destructive",
                        )} />
                      )}
                      {("isNew" in tab && tab.isNew) && (
                        <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-success ring-2 ring-card animate-pulse" aria-label="New" />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
                    {isActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-info" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex h-full w-full min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors active:scale-95",
                isMoreActive ? "text-info" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="More navigation"
            >
              <div className="relative">
                <LayoutGrid className="h-5 w-5" />
                {lineAlertCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                    {lineAlertCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold leading-none">More</span>
              {isMoreActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-info" />}
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="divide-y divide-border -m-4">
          {moreItems.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <button
                  onClick={() => {
                    navigate(item.to);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "flex w-full min-h-[52px] items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted",
                    active ? "text-info" : "text-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-[15px] font-semibold">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
