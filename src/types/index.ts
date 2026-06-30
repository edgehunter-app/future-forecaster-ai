export type Tier = "S" | "A" | "B" | "C";
export type Direction = "YES" | "NO";
export type SuggestionStatus = "active" | "expired" | "executed" | "dismissed" | "won" | "lost";
export type AlertChannel = "telegram" | "discord" | "email";

export interface OddsBookmaker {
  key: string;
  title: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
}

export interface OddsGame {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: OddsBookmaker[];
  consensusProb: { home: number; away: number; draw?: number };
}

export interface SportsMispricing {
  id: string;
  question: string;
  game: OddsGame;
  polyImplied: number;
  vegasImplied: number;
  spread: number;
  edge: number;
  direction: "YES" | "NO";
  favoredSide: string;
  bestBook: string;
  bestOdds: number;
  confidence: number;
  league: string;
  claudeAnalysis?: unknown | null;
}

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

export interface WalletPosition {
  marketId: string;
  question: string;
  direction: "YES" | "NO";
  amount: number;
  currentValue: number;
  entryPrice: number;
  pnl: number;
  size: number;
}

export interface WalletActivity {
  action: "BUY" | "SELL";
  direction: "YES" | "NO";
  question: string;
  amount: number;
  price: number;
  timestamp: string;
  marketId: string;
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

export type BetStatus = "pending" | "won" | "lost" | "push" | "void";

export interface Bet {
  id: string;
  user_id: string;
  title: string;
  sport: string;
  bet_type: string;
  pick: string;
  odds: number;
  amount: number;
  sportsbook: string | null;
  suggestion_id?: string | null;
  status: BetStatus;
  profit_loss: number;
  game_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  opening_odds?: number | null;
  current_odds?: number | null;
  opening_line?: number | null;
  current_line?: number | null;
  line_alerts?: unknown[] | null;
  last_line_check?: string | null;
}

export interface GameAnalysisResult {
  recommendation: "HOME" | "AWAY" | "OVER" | "UNDER" | "NO_EDGE" | string;
  recommendedTeam: string;
  betType: "moneyline" | "spread" | "total" | string;
  /** Spread line for spread bets, signed from the recommended team's perspective. */
  spreadLine?: number | null;
  confidence: number;
  edge: number;
  suggestedAmount: number;
  odds: number;
  impliedProbability: number;
  consensusImplied?: number;
  bestBook?: string;
  lineShopping?: {
    bestBook?: string;
    bestOdds?: number | string;
    worstBook?: string;
    worstOdds?: number | string;
    edgeCents?: number;
    recommendation?: string;
  } | null;
  reasoning: string;
  keyFactors: string[];
  riskLevel: "low" | "medium" | "high";
  warningFlags: string[];
}

export interface BestBetResult {
  /** Source of the recommendation. Defaults to "sports" when omitted (legacy). */
  source?: BestBetSource;
  /** Present when source === "sports". */
  game?: import("@/lib/oddsApi").FullGame;
  analysis?: GameAnalysisResult;
  /** Present when source === "prediction_market". */
  prediction?: PredictionMarketBest;
  /** Present when source === "wallet_signal". */
  wallet?: WalletSignalBest;
  scannedCount: number;
  generatedAt: Date;
}

export type BestBetSource = "sports" | "prediction_market" | "wallet_signal";

export interface PredictionMarketBest {
  market: Market;
  polyPriceCents: number;
  kalshiPriceCents: number;
  gapCents: number;
  bestPlatform: "Polymarket" | "Kalshi";
  bestPriceCents: number;
  favoredSide: "YES" | "NO";
  confidence: number;
  edge: number;
  suggestedAmount: number;
  reasoning: string;
  keyFactors: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface WalletSignalBest {
  market: Market;
  walletCount: number;
  totalValue: number;
  topWallets: { label: string; tier: string; winRate: number; positionValue: number }[];
  favoredSide: "YES" | "NO";
  confidence: number;
  edge: number;
  suggestedAmount: number;
  reasoning: string;
  keyFactors: string[];
  riskLevel: "low" | "medium" | "high";
}
