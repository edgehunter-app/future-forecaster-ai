import type { Market, Wallet, Suggestion, ClaudeAnalysis } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyzeMarketParams {
  market: Market;
  wallets: Wallet[];
  bankroll: number;
  kellyMultiplier: number;
  /** Max position as percent of bankroll, e.g. 5 for 5% */
  maxPositionPct: number;
  crossMarketData?: {
    kalshiYes: number;
    spread: number;
    favoredPlatform: string;
  } | null;
}

export async function analyzeMarketWithClaude(
  params: AnalyzeMarketParams,
): Promise<ClaudeAnalysis | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-market", {
      body: params,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || data.error) return null;

    const result = data as ClaudeAnalysis;
    const maxPosition = (params.bankroll * params.maxPositionPct) / 100;
    result.suggestedAmount = Math.min(
      Math.round(result.suggestedAmount ?? 0),
      Math.floor(maxPosition),
    );
    result.confidence = Math.max(0, Math.min(100, result.confidence ?? 0));
    result.edge = Math.max(0, Math.min(0.5, result.edge ?? 0));
    return result;
  } catch (err) {
    console.error("Claude analysis failed:", err);
    return null;
  }
}

export async function analyzeAllMarkets(params: {
  markets: Market[];
  wallets: Wallet[];
  crossMarketOpps: { polymarket: Market; kalshiYes: number; spread: number; favoredPlatform: string }[];
  bankroll: number;
  kellyMultiplier: number;
  minConfidence: number;
  maxPositionPct?: number;
}): Promise<Suggestion[]> {
  const { markets, wallets, crossMarketOpps, bankroll, kellyMultiplier, minConfidence, maxPositionPct = 5 } = params;
  const out: Suggestion[] = [];
  const top = markets.slice(0, 5);
  for (const m of top) {
    const xm = crossMarketOpps.find((o) => o.polymarket.id === m.id);
    const r = await analyzeMarketWithClaude({
      market: m,
      wallets,
      crossMarketData: xm
        ? { kalshiYes: xm.kalshiYes, spread: xm.spread, favoredPlatform: xm.favoredPlatform }
        : null,
      bankroll,
      kellyMultiplier,
      maxPositionPct,
    });
    if (r && r.confidence >= minConfidence) {
      out.push({
        id: `claude_${m.id}_${Date.now()}`,
        marketId: m.id,
        question: m.question,
        direction: r.direction,
        currentOdds: r.direction === "YES" ? m.yesPrice : m.noPrice,
        suggestedAmount: r.suggestedAmount,
        confidence: r.confidence,
        edge: r.edge,
        category: m.category,
        reasoning: r.reasoning,
        walletSignals: wallets.slice(0, 2).map((w) => w.label),
        status: "active",
        createdAt: "just now",
        expiresAt: "24h",
      });
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  return out;
}
