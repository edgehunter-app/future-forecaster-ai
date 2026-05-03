export type Tier = "S" | "A" | "B" | "C";
export type Direction = "YES" | "NO";
export type SuggestionStatus = "active" | "expired" | "executed" | "dismissed" | "won" | "lost";
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
  source?: "polymarket" | "kalshi" | "both";
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
  keySignals?: string[];
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

export interface CrossMarketOpp {
  question: string;
  polymarket: Market;
  kalshi: Market;
  polyYes: number;
  kalshiYes: number;
  spread: number;
  edge: number;
  favoredPlatform: "polymarket" | "kalshi";
  direction: "YES" | "NO";
  claudeAnalysis?: ClaudeAnalysis | null;
}

export interface ClaudeAnalysis {
  direction: "YES" | "NO";
  confidence: number;
  edge: number;
  suggestedAmount: number;
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  keySignals: string[];
  crossMarketEdge?: string | null;
}
