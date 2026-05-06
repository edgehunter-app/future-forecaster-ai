import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Wallet, Suggestion, Market, CrossMarketOpp } from "@/types";

export interface AlertChannelTelegram { enabled: boolean; chatId: string; }
export interface AlertChannelDiscord { enabled: boolean; webhookUrl: string; }
export interface AlertChannelEmail { enabled: boolean; address: string; frequency: string; }

export interface SettingsState {
  bankroll: number;
  kellyMultiplier: number;
  /** Max single position as fraction of bankroll, e.g. 0.05 */
  maxPosition: number;
  /** Min confidence to display, 0-100 */
  minConfidence: number;
  /** Min confidence to alert, 0-100 */
  alertThreshold: number;
  scanInterval: "15m" | "30m" | "1h" | "manual";
  showPositionDetails: boolean;
  showWalletAddresses: boolean;
  compactCards: boolean;
  favoriteCategories: string[];
  favoriteSports: string[];
  sportsGapThreshold: number;
  alertOnSportsMispricings: boolean;
  alerts: {
    telegram: AlertChannelTelegram;
    discord: AlertChannelDiscord;
    email: AlertChannelEmail;
  };
}

export interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  activePage: string;
}

export interface SuggestionFilters {
  category: string;
  direction: string; // "all" | "YES" | "NO"
  status: string;    // "active" | "expired" | "won" | "lost"
  sortBy: string;    // "confidence" | "edge" | "newest" | "expiring"
}

export interface MarketFilters {
  searchQuery: string;
  category: string;
}

export interface AppState {
  settings: SettingsState;
  ui: UIState;
  suggestions: Suggestion[];
  trackedWallets: Wallet[];
  markets: Market[];
  suggestionFilters: SuggestionFilters;
  marketFilters: MarketFilters;
  crossMarketOpps: CrossMarketOpp[];
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
  setCrossMarketOpps: (opps: CrossMarketOpp[]) => void;

  updateSettings: (partial: Partial<SettingsState>) => void;
  updateAlerts: (
    channel: "telegram" | "discord" | "email",
    partial: Partial<AlertChannelTelegram & AlertChannelDiscord & AlertChannelEmail>,
  ) => void;

  setDarkMode: (val: boolean) => void;
  setSidebarOpen: (val: boolean) => void;
  setActivePage: (val: string) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;

  dismissSuggestion: (id: string) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (address: string) => void;

  setSuggestionFilters: (partial: Partial<SuggestionFilters>) => void;
  setMarketFilters: (partial: Partial<MarketFilters>) => void;
}

const defaultSettings: SettingsState = {
  bankroll: 5000,
  kellyMultiplier: 0.25,
  maxPosition: 0.05,
  minConfidence: 65,
  alertThreshold: 75,
  scanInterval: "30m",
  showPositionDetails: true,
  showWalletAddresses: true,
  compactCards: false,
  favoriteCategories: ["Economics", "Crypto"],
  favoriteSports: ["americanfootball_nfl", "basketball_nba"],
  sportsGapThreshold: 0.03,
  alertOnSportsMispricings: false,
  alerts: {
    telegram: { enabled: true, chatId: "" },
    discord: { enabled: false, webhookUrl: "" },
    email: { enabled: false, address: "", frequency: "Hourly digest" },
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      ui: { darkMode: true, sidebarOpen: true, activePage: "dashboard" },
      suggestions: [],
      trackedWallets: [],
      markets: [],
      suggestionFilters: { category: "All", direction: "all", status: "active", sortBy: "confidence" },
      marketFilters: { searchQuery: "", category: "All" },
      crossMarketOpps: [],
      isDemoMode: false,
      setDemoMode: (val) => set({ isDemoMode: val }),
      setCrossMarketOpps: (opps) => set({ crossMarketOpps: opps }),

      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      updateAlerts: (channel, partial) =>
        set((s) => ({
          settings: {
            ...s.settings,
            alerts: {
              ...s.settings.alerts,
              [channel]: { ...s.settings.alerts[channel], ...partial },
            },
          },
        })),

      setDarkMode: (val) => set((s) => ({ ui: { ...s.ui, darkMode: val } })),
      setSidebarOpen: (val) => set((s) => ({ ui: { ...s.ui, sidebarOpen: val } })),
      setActivePage: (val) => set((s) => ({ ui: { ...s.ui, activePage: val } })),
      toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } })),
      toggleDarkMode: () => set((s) => ({ ui: { ...s.ui, darkMode: !s.ui.darkMode } })),

      dismissSuggestion: (id) =>
        set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
      addWallet: (wallet) =>
        set((s) =>
          s.trackedWallets.some((w) => w.address === wallet.address)
            ? s
            : { trackedWallets: [wallet, ...s.trackedWallets] },
        ),
      removeWallet: (address) =>
        set((s) => ({ trackedWallets: s.trackedWallets.filter((w) => w.address !== address) })),

      setSuggestionFilters: (partial) =>
        set((s) => ({ suggestionFilters: { ...s.suggestionFilters, ...partial } })),
      setMarketFilters: (partial) =>
        set((s) => ({ marketFilters: { ...s.marketFilters, ...partial } })),
    }),
    {
      name: "edgehunter-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, ui: { darkMode: s.ui.darkMode }, isDemoMode: s.isDemoMode }),
    },
  ),
);

// Compatibility helper for old API
export type SortBy = "confidence" | "edge" | "newest" | "expiring";
export type DirectionFilter = "all" | "YES" | "NO";
export type StatusFilter = "active" | "expired" | "won" | "lost";
