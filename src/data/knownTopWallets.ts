import type { Wallet } from "@/types";

export const KNOWN_TOP_WALLETS: Wallet[] = [
  {
    address: "0x1fc52cf68eb71b0b7a2122d43fa6f7e9cc9e4f10",
    label: "TopTrader_01",
    winRate: 0.68, sharpe: 1.9, roi30d: 0.22,
    totalVolume: 450000, recentTrades: 35,
    consistency: 0.72, tier: "A",
  },
  {
    address: "0x8a3bc23e6db11d4b8eed29cb6f17e9c4e5af8d2a",
    label: "SharpMoney_02",
    winRate: 0.71, sharpe: 2.1, roi30d: 0.28,
    totalVolume: 620000, recentTrades: 42,
    consistency: 0.77, tier: "A",
  },
  {
    address: "0x4c7e1f2a9b3d5e6f8c0a2b4d6e8f0a1b3c5d7e9f",
    label: "EdgeFinder_03",
    winRate: 0.65, sharpe: 1.7, roi30d: 0.19,
    totalVolume: 280000, recentTrades: 28,
    consistency: 0.68, tier: "A",
  },
];