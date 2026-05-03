import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Lightbulb, Wallet, BarChart2, History, Settings,
  ChevronLeft, ChevronRight, Moon, Sun, Activity,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/suggestions", label: "Suggestions", icon: Lightbulb, badge: 3 },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/markets", label: "Markets", icon: BarChart2 },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const open = useAppStore((s) => s.ui.sidebarOpen);
  const darkMode = useAppStore((s) => s.ui.darkMode);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        open ? "w-60" : "w-[68px]",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border h-16">
        <div className="relative h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-info to-purple flex items-center justify-center shadow-glow-blue">
          <Activity className="h-5 w-5 text-white" />
        </div>
        {open && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-semibold text-base text-foreground tracking-tight">PolySignal</span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
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
                {open && item.badge !== undefined && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-info/20 px-1.5 text-[10px] font-semibold text-info">
                    {item.badge}
                  </span>
                )}
                {!open && item.badge !== undefined && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-info" />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-1">
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
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          title={!open ? "Expand" : undefined}
        >
          {open ? <ChevronLeft className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
          {open && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;