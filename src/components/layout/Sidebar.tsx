import { NavLink } from "react-router-dom";
import {
  House, Zap, Users, TrendingUp, Clock, Settings,
  ChevronLeft, ChevronRight, Moon, Sun, ArrowLeftRight, Download, Trophy, Settings2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const open = useAppStore((s) => s.ui.sidebarOpen);
  const darkMode = useAppStore((s) => s.ui.darkMode);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const suggestionsCount = useAppStore((s) => s.suggestions.length);
  const xmCount = useAppStore((s) => s.crossMarketOpps.length);
  const { canInstall, isInstalled, install } = usePWA();
  const { isAdmin } = useIsAdmin();

  const navItems = [
    { to: "/", label: "Dashboard", icon: House, end: true } as const,
    { to: "/suggestions", label: "Suggestions", icon: Zap, badge: suggestionsCount, badgeColor: "info" as const },
    { to: "/wallets", label: "Wallets", icon: Users },
    { to: "/markets", label: "Markets", icon: TrendingUp },
    { to: "/cross-market", label: "Cross-Market", icon: ArrowLeftRight, badge: xmCount || undefined, badgeColor: "warning" as const },
    { to: "/sports", label: "Sports", icon: Trophy, badge: undefined, badgeColor: "info" as const } as const,
    { to: "/history", label: "History", icon: Clock },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          open ? "w-60" : "w-[68px]",
        )}
      >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border h-16">
        <EdgeHunterLogo size={open ? 36 : 32} variant={open ? "full" : "icon"} />
        {open && (
          <span className="relative ml-auto flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-info/15 text-info"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
                  )
                }
                title={!open ? item.label : undefined}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {open && <span className="flex-1 truncate">{item.label}</span>}
                {open && item.badge !== undefined && item.badge > 0 && (
                  <span className={cn(
                    "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                    item.badgeColor === "warning"
                      ? "bg-warning/20 text-warning"
                      : "bg-info/20 text-info",
                  )}>
                    {item.badge}
                  </span>
                )}
                {!open && item.badge !== undefined && item.badge > 0 && (
                  <span className={cn(
                    "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                    item.badgeColor === "warning" ? "bg-warning" : "bg-info",
                  )} />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-1">
        {isAdmin && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-warning/15 text-warning"
                  : "text-warning/80 hover:bg-sidebar-accent hover:text-warning",
              )
            }
            title={!open ? "Admin" : undefined}
          >
            <Settings2 className="h-[18px] w-[18px]" />
            {open && <span>Admin</span>}
          </NavLink>
        )}
        {canInstall && !isInstalled && (
          <button
            onClick={() => void install()}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-info hover:bg-sidebar-accent transition-colors"
            title={!open ? "Install App" : undefined}
          >
            <Download className="h-[18px] w-[18px]" />
            {open && <span>Install App</span>}
          </button>
        )}
        <button
          onClick={toggleDarkMode}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          title={!open ? "Toggle theme" : undefined}
        >
          {darkMode ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          {open && <span>{darkMode ? "Dark mode" : "Light mode"}</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          title={!open ? "Expand" : undefined}
        >
          {open ? <ChevronLeft className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
          {open && <span>Collapse</span>}
        </button>
      </div>
      </aside>
    </>
  );
}

export default Sidebar;