import type { Wallet, Tier } from "@/types";

export function scoreWallet(w: Wallet): number {
  const s =
    w.winRate * 40 +
    Math.min(w.sharpe / 3, 1) * 30 +
    w.consistency * 20 +
    Math.min(w.roi30d / 0.5, 1) * 10;
  return Math.round(Math.max(0, Math.min(100, s)));
}

export function getTier(score: number): Tier {
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  return "C";
}
