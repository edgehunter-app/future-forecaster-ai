import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings, AlertChannel, Wallet, Suggestion } from "@/types";
import { MOCK_WALLETS, MOCK_SUGGESTIONS } from "@/data/mockData";

interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  activePage: string;
}

export type SortBy = "confidence" | "edge" | "newest" | "expiring";
export type DirectionFilter = "all" | "YES" | "NO";
export type StatusFilter = "active" | "expired" | "won" | "lost";

export interface SuggestionFilters {
  category: string;
  direction: DirectionFilter;
  status: StatusFilter;
  sortBy: SortBy;
}

interface AppState {
  settings: Settings;
  alerts: AlertChannel[];
  ui: UIState;
  searchQuery: string;
  selectedCategory: string;
  trackedWallets: Wallet[];
  suggestions: Suggestion[];
  suggestionFilters: SuggestionFilters;
  setSettings: (patch: Partial<Settings>) => void;
  setAlerts: (alerts: AlertChannel[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setActivePage: (page: string) => void;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (c: string) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (address: string) => void;
  dismissSuggestion: (id: string) => void;
  setSuggestionFilters: (patch: Partial<SuggestionFilters>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        bankroll: 5000,
        kellyMultiplier: 0.25,
        maxPosition: 250,
        minConfidence: 0.65,
        telegramId: "",
        discordWebhook: "",
        alertEmail: "",
      },
      alerts: ["telegram"],
      ui: { darkMode: true, sidebarOpen: true, activePage: "dashboard" },
      searchQuery: "",
      selectedCategory: "All",
      trackedWallets: MOCK_WALLETS,
      suggestions: MOCK_SUGGESTIONS,
      suggestionFilters: { category: "All", direction: "all", status: "active", sortBy: "confidence" },
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setAlerts: (alerts) => set({ alerts }),
      toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } })),
      setSidebarOpen: (open) => set((s) => ({ ui: { ...s.ui, sidebarOpen: open } })),
      toggleDarkMode: () => set((s) => ({ ui: { ...s.ui, darkMode: !s.ui.darkMode } })),
      setActivePage: (activePage) => set((s) => ({ ui: { ...s.ui, activePage } })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
      addWallet: (wallet) =>
        set((s) =>
          s.trackedWallets.some((w) => w.address === wallet.address)
            ? s
            : { trackedWallets: [wallet, ...s.trackedWallets] },
        ),
      removeWallet: (address) =>
        set((s) => ({ trackedWallets: s.trackedWallets.filter((w) => w.address !== address) })),
      dismissSuggestion: (id) =>
        set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
      setSuggestionFilters: (patch) =>
        set((s) => ({ suggestionFilters: { ...s.suggestionFilters, ...patch } })),
    }),
    { name: "polysignal-store" },
  ),
);
