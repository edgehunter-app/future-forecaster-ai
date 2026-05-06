import type { Market, Wallet, Suggestion } from "@/types";

export const MOCK_MARKETS: Market[] = [
  { id: "m1", question: "Will the Fed cut rates in June 2025?", category: "Economics", yesPrice: 0.62, noPrice: 0.38, volume24h: 847320, totalVolume: 4200000, endDate: "2025-06-30", trend: "up", change24h: 0.04 },
  { id: "m2", question: "Will Bitcoin exceed $100k before July?", category: "Crypto", yesPrice: 0.44, noPrice: 0.56, volume24h: 2341000, totalVolume: 12800000, endDate: "2025-07-01", trend: "down", change24h: -0.02 },
  { id: "m3", question: "Will there be a US recession in 2025?", category: "Economics", yesPrice: 0.31, noPrice: 0.69, volume24h: 523000, totalVolume: 3100000, endDate: "2025-12-31", trend: "up", change24h: 0.06 },
  { id: "m4", question: "Will SpaceX Starship reach orbit in Q2 2025?", category: "Science", yesPrice: 0.71, noPrice: 0.29, volume24h: 389000, totalVolume: 1800000, endDate: "2025-06-30", trend: "up", change24h: 0.03 },
  { id: "m5", question: "Will the S&P 500 end 2025 above 5500?", category: "Finance", yesPrice: 0.58, noPrice: 0.42, volume24h: 1120000, totalVolume: 6700000, endDate: "2025-12-31", trend: "up", change24h: 0.01 },
];

export const MOCK_WALLETS: Wallet[] = [
  { address: "0xA1b2...c3D4", label: "CryptoWhale_01", winRate: 0.73, sharpe: 2.41, roi30d: 0.34, totalVolume: 892000, recentTrades: 47, consistency: 0.81, tier: "S" },
  { address: "0xF5e6...7890", label: "PredictionPro", winRate: 0.68, sharpe: 1.97, roi30d: 0.22, totalVolume: 445000, recentTrades: 31, consistency: 0.74, tier: "A" },
  { address: "0xBc3d...4Ef5", label: "MarketSage", winRate: 0.64, sharpe: 1.63, roi30d: 0.18, totalVolume: 278000, recentTrades: 22, consistency: 0.69, tier: "A" },
  { address: "0x9Gh0...1Ij2", label: "AlphaSeeker", winRate: 0.59, sharpe: 1.22, roi30d: 0.11, totalVolume: 134000, recentTrades: 15, consistency: 0.61, tier: "B" },
];

export const MOCK_SUGGESTIONS: Suggestion[] = [
  { id: "s1", marketId: "m1", question: "Will the Fed cut rates in June 2025?", direction: "YES", currentOdds: 0.62, suggestedAmount: 450, confidence: 82, edge: 0.11, category: "Economics", reasoning: "3 top-tier wallets entered YES positions in last 4h. Volume spike +340% above average. CME FedWatch implied 73% vs market 62% — significant edge detected.", walletSignals: ["CryptoWhale_01", "PredictionPro"], status: "active", createdAt: "2h ago", expiresAt: "18h" },
  { id: "s2", marketId: "m3", question: "Will there be a US recession in 2025?", direction: "YES", currentOdds: 0.31, suggestedAmount: 280, confidence: 71, edge: 0.14, category: "Economics", reasoning: "Contrarian play. Smart wallet cluster buying YES at discount. GDP growth data revision expected next week. Risk/reward favorable at current 31% pricing.", walletSignals: ["MarketSage", "AlphaSeeker"], status: "active", createdAt: "5h ago", expiresAt: "41h" },
  { id: "s3", marketId: "m4", question: "Will SpaceX Starship reach orbit in Q2 2025?", direction: "YES", currentOdds: 0.71, suggestedAmount: 190, confidence: 65, edge: 0.07, category: "Science", reasoning: "Moderate confidence. High-performing wallet (CryptoWhale_01) increased position by 40%. FAA approval rumors circulating. Lower size due to moderate edge.", walletSignals: ["CryptoWhale_01"], status: "active", createdAt: "8h ago", expiresAt: "28h" },
  { id: "s4", marketId: "m2", question: "Will Bitcoin exceed $100k before July?", direction: "NO", currentOdds: 0.56, suggestedAmount: 320, confidence: 74, edge: 0.09, category: "Crypto", reasoning: "Smart money shifting to NO. Exchange outflows declining. Macro headwinds from rate uncertainty. Multiple S/A-tier wallets reducing YES exposure this week.", walletSignals: ["PredictionPro", "CryptoWhale_01"], status: "active", createdAt: "12h ago", expiresAt: "55h" },
];
