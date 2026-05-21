import type { BetStatus } from "@/types";

/** Implied probability from American odds. */
export function americanToImplied(odds: number): number {
  if (!odds) return 0;
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Profit (not payout) on a winning bet of `amount` at American `odds`. */
export function americanProfit(odds: number, amount: number): number {
  if (!odds || !amount) return 0;
  return odds > 0 ? amount * (odds / 100) : amount * (100 / Math.abs(odds));
}

/** Total payout (stake + profit) on a winning bet. */
export function americanPayout(odds: number, amount: number): number {
  return amount + americanProfit(odds, amount);
}

/** Realized profit/loss for a resolved bet. */
export function resolveProfitLoss(
  status: BetStatus,
  odds: number,
  amount: number,
): number {
  if (status === "won") return americanProfit(odds, amount);
  if (status === "lost") return -amount;
  return 0; // push / void / pending
}

/** Convert a fractional implied probability (e.g. 0.62) to American odds. */
export function impliedToAmericanInt(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  return prob >= 0.5
    ? -Math.round((prob / (1 - prob)) * 100)
    : Math.round(((1 - prob) / prob) * 100);
}