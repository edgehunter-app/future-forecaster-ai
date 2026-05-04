import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Lightbulb, Wallet, BarChart2, History, Settings,
  ChevronLeft, ChevronRight, Moon, Sun, Activity, GitCompare, Download,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

export function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const open = useAppStore((s) => s.ui.sidebarOpen);
  const darkMode = useAppStore((s) => s.ui.darkMode);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const suggestionsCount = useAppStore((s) => s.suggestions.length);
  const xmCount = useAppStore((s) => s.crossMarketOpps.length);
  const { canInstall, isInstalled, install } = usePWA();

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true } as const,
    { to: "/suggestions", label: "Suggestions", icon: Lightbulb, badge: suggestionsCount, badgeColor: "info" as const },
    { to: "/wallets", label: "Wallets", icon: Wallet },
    { to: "/markets", label: "Markets", icon: BarChart2 },
    { to: "/cross-market", label: "Cross-Market", icon: GitCompare, badge: xmCount || undefined, badgeColor: "warning" as const },
    { to: "/history", label: "History", icon: History },
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
        <div className="relative h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-info to-purple flex items-center justify-center shadow-glow-blue">
          <Activity className="h-5 w-5 text-white" />
        </div>
        {open && (
          <div className="flex flex-col overflow-hidden leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-foreground tracking-tight">EdgeHunter</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate">Stop guessing. Start hunting.</span>
          </div>
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