import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings, AlertChannel } from "@/types";

interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  activePage: string;
}

interface AppState {
  settings: Settings;
  alerts: AlertChannel[];
  ui: UIState;
  setSettings: (patch: Partial<Settings>) => void;
  setAlerts: (alerts: AlertChannel[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setActivePage: (page: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        bankroll: 10000,
        kellyMultiplier: 0.25,
        maxPosition: 500,
        minConfidence: 0.65,
        telegramId: "",
        discordWebhook: "",
        alertEmail: "",
      },
      alerts: ["telegram"],
      ui: {
        darkMode: true,
        sidebarOpen: true,
        activePage: "dashboard",
      },
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setAlerts: (alerts) => set({ alerts }),
      toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } })),
      setSidebarOpen: (open) => set((s) => ({ ui: { ...s.ui, sidebarOpen: open } })),
      toggleDarkMode: () => set((s) => ({ ui: { ...s.ui, darkMode: !s.ui.darkMode } })),
      setActivePage: (activePage) => set((s) => ({ ui: { ...s.ui, activePage } })),
    }),
    { name: "polysignal-store" },
  ),
);