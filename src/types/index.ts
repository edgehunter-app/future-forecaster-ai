export type Tier = "S" | "A" | "B" | "C";
export type Direction = "YES" | "NO";
export type SuggestionStatus = "active" | "expired" | "executed" | "dismissed";
export type AlertChannel = "telegram" | "discord" | "email";

export interface Market {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  endDate: string;
  trend: "up" | "down" | "flat";
  change24h: number;
}

export interface Wallet {
  address: string;
  label: string;
  winRate: number;
  sharpe: number;
  roi30d: number;
  totalVolume: number;
  recentTrades: number;
  consistency: number;
  tier: Tier;
}

export interface Suggestion {
  id: string;
  marketId: string;
  question: string;
  direction: Direction;
  currentOdds: number;
  suggestedAmount: number;
  /** 0-100 */
  confidence: number;
  edge: number;
  category: string;
  reasoning: string;
  /** wallet labels */
  walletSignals: string[];
  status: SuggestionStatus | "active";
  createdAt: string;
  expiresAt: string;
}

export interface Settings {
  bankroll: number;
  kellyMultiplier: number;
  maxPosition: number;
  minConfidence: number;
  telegramId: string;
  discordWebhook: string;
  alertEmail: string;
}

export interface HistoryPoint {
  date: string;
  pnl: number;
  cumulative: number;
  win: boolean;
}
