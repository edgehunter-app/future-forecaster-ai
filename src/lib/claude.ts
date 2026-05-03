// TODO: Move to /api/analyze in production
import type { Market, Wallet, Suggestion, ClaudeAnalysis } from "@/types";
import { fmtUSD } from "@/lib/utils";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

interface AnalyzeParams {
  market: Market;
  wallets: Wallet[];
  crossMarketData?: { kalshiYes: number; spread: number } | null;
  bankroll: number;
  kellyMultiplier: number;
}

export async function analyzeMarketWithClaude(params: AnalyzeParams): Promise<ClaudeAnalysis | null> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const { market, wallets, crossMarketData, bankroll, kellyMultiplier } = params;

  const prompt = `You are a quantitative prediction market analyst with expertise in probability assessment and edge detection.

MARKET: "${market.question}"
Category: ${market.category}
Platform: ${market.source || "Polymarket"}

CURRENT PRICING:
- YES: ${(market.yesPrice * 100).toFixed(1)}%
- NO: ${(market.noPrice * 100).toFixed(1)}%
- 24h Volume: ${fmtUSD(market.volume24h)}
- 24h Price Change: ${market.change24h > 0 ? "+" : ""}${(market.change24h * 100).toFixed(1)}%

SMART WALLET SIGNALS:
${wallets.map((w) => `- ${w.label}: ${(w.winRate * 100).toFixed(0)}% win rate, Sharpe ${w.sharpe}, Tier ${w.tier}`).join("\n")}
${crossMarketData ? `
CROSS-MARKET DATA:
- Kalshi pricing same event at: ${(crossMarketData.kalshiYes * 100).toFixed(1)}% YES
- Spread vs Polymarket: ${(crossMarketData.spread * 100).toFixed(1)}%
- This is a potential cross-market mispricing opportunity
` : ""}
USER RISK PROFILE:
- Bankroll: $${bankroll}
- Kelly multiplier: ${kellyMultiplier}x
- Max single position: 5% = $${(bankroll * 0.05).toFixed(0)}

Analyze this market and respond with ONLY a valid JSON object, no markdown, no explanation outside the JSON:
{
  "direction": "YES" or "NO",
  "confidence": integer 0-100,
  "edge": decimal e.g. 0.08 for 8% edge,
  "suggestedAmount": dollar amount integer,
  "reasoning": "2-3 sentences max, specific and actionable",
  "riskLevel": "low" | "medium" | "high",
  "keySignals": ["signal1", "signal2", "signal3"],
  "crossMarketEdge": "one sentence if cross-market opportunity exists, else null"
}`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = (data.content as { type: string; text?: string }[]).find((b) => b.type === "text")?.text;
    if (!text) return null;
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ClaudeAnalysis;
    parsed.suggestedAmount = Math.min(parsed.suggestedAmount, Math.floor(bankroll * 0.05));
    return parsed;
  } catch {
    return null;
  }
}

export async function analyzeAllMarkets(params: {
  markets: Market[];
  wallets: Wallet[];
  crossMarketOpps: { polymarket: Market; kalshiYes: number; spread: number }[];
  bankroll: number;
  kellyMultiplier: number;
  minConfidence: number;
}): Promise<Suggestion[]> {
  const { markets, wallets, crossMarketOpps, bankroll, kellyMultiplier, minConfidence } = params;
  const out: Suggestion[] = [];
  const top = markets.slice(0, 5);
  for (const m of top) {
    const xm = crossMarketOpps.find((o) => o.polymarket.id === m.id);
    const r = await analyzeMarketWithClaude({
      market: m,
      wallets,
      crossMarketData: xm ? { kalshiYes: xm.kalshiYes, spread: xm.spread } : null,
      bankroll,
      kellyMultiplier,
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
