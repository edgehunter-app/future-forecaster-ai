import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Wallet, Suggestion, Market, CrossMarketOpp } from "@/types";
import type { FullGame, GameProps, SportsMispricing } from "@/lib/oddsApi";

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
  oddsApiKeySecondary: string;
  /** Default refresh interval for sportsbook data in minutes */
  sportsRefreshMinutes: number;
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

  // Live data caches (NOT persisted — survive navigation, reset on full reload)
  cachedMarkets: Market[];
  marketsLastUpdated: Date | null;
  marketsIsLive: boolean;
  fullGames: FullGame[];
  sportsLastScanned: Date | null;
  sportsLoading: boolean;
  sportsError: string | null;
  sportsMispricings: SportsMispricing[];
  crossMarketLastScanned: Date | null;
  crossMarketLoading: boolean;
  propsCache: Record<string, GameProps>;

  setCachedMarkets: (m: Market[], isLive: boolean) => void;
  setMarketsLastUpdated: (d: Date) => void;
  setFullGames: (g: FullGame[]) => void;
  setSportsLastScanned: (d: Date) => void;
  setSportsLoading: (b: boolean) => void;
  setSportsError: (e: string | null) => void;
  setSportsMispricings: (m: SportsMispricing[]) => void;
  setCrossMarketLastScanned: (d: Date) => void;
  setCrossMarketLoading: (b: boolean) => void;
  setPropsCache: (c: Record<string, GameProps>) => void;

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
  sportsGapThreshold: 0.02,
  alertOnSportsMispricings: false,
  oddsApiKeySecondary: "",
  sportsRefreshMinutes: 10,
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

      cachedMarkets: [],
      marketsLastUpdated: null,
      marketsIsLive: false,
      fullGames: [],
      sportsLastScanned: null,
      sportsLoading: false,
      sportsError: null,
      sportsMispricings: [],
      crossMarketLastScanned: null,
      crossMarketLoading: false,
      propsCache: {},

      setCachedMarkets: (m, isLive) =>
        set({ cachedMarkets: m, marketsIsLive: isLive, marketsLastUpdated: new Date() }),
      setMarketsLastUpdated: (d) => set({ marketsLastUpdated: d }),
      setFullGames: (g) => set({ fullGames: g }),
      setSportsLastScanned: (d) => set({ sportsLastScanned: d }),
      setSportsLoading: (b) => set({ sportsLoading: b }),
      setSportsError: (e) => set({ sportsError: e }),
      setSportsMispricings: (m) => set({ sportsMispricings: m }),
      setCrossMarketLastScanned: (d) => set({ crossMarketLastScanned: d }),
      setCrossMarketLoading: (b) => set({ crossMarketLoading: b }),
      setPropsCache: (c) => set({ propsCache: c }),

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
      partialize: (s) => ({ settings: s.settings, ui: { darkMode: s.ui.darkMode } }),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (persistedState?.settings && version < 2) {
          persistedState.settings.sportsGapThreshold = 0.02;
        }
        return persistedState;
      },
    },
  ),
);

// Compatibility helper for old API
export type SortBy = "confidence" | "edge" | "newest" | "expiring";
export type DirectionFilter = "all" | "YES" | "NO";
export type StatusFilter = "active" | "expired" | "won" | "lost";
