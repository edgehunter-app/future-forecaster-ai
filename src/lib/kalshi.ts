import type { Market, CrossMarketOpp } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export async function fetchKalshiMarkets(params?: {
  limit?: number;
  status?: string;
  series_ticker?: string;
}): Promise<Market[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-kalshi-markets", {
      body: { limit: params?.limit ?? 20 },
    });
    if (error) throw error;
    console.log("Kalshi edge function:", data?.source, data?.markets?.length);
    const raw = data?.markets ?? [];
    return raw.map(mapKalshiMarket).filter((m: Market) => m.question && m.yesPrice > 0);
  } catch (err) {
    console.error("fetchKalshiMarkets failed:", err);
    return [];
  }
}

export async function fetchKalshiMarket(_ticker: string): Promise<Market | null> {
  return null;
}

export async function fetchKalshiEvents(_params?: { limit?: number; series_ticker?: string }): Promise<any[]> {
  return [];
}

function mapKalshiMarket(m: any): Market {
  // Kalshi now returns *_dollars fields (USD strings) on most endpoints,
  // but legacy responses still use cent-based integers (yes_ask, etc.).
  const parseDollar = (v: unknown) => {
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const yesDollar =
    parseDollar(m.yes_ask_dollars) ??
    parseDollar(m.yes_bid_dollars) ??
    parseDollar(m.last_price_dollars);
  const noDollar =
    parseDollar(m.no_ask_dollars) ??
    parseDollar(m.no_bid_dollars);
  const yesPrice =
    yesDollar ??
    (m.yes_ask ?? m.yes_bid ?? m.last_price ?? 50) / 100;
  const noPrice =
    noDollar ??
    (m.no_ask ?? m.no_bid ?? (100 - (m.yes_ask ?? 50))) / 100;
  const volume24h =
    parseDollar(m.volume_24h_fp) ?? m.volume_24h ?? m.volume ?? 0;
  const totalVolume =
    parseDollar(m.volume_fp) ?? m.volume ?? m.open_interest ?? 0;
  return {
    id: `kalshi_${m.ticker ?? m.id ?? m.event_ticker ?? ""}`,
    question: m.title ?? m.question ?? m.name ?? "Unknown market",
    category: normalizeKalshiCategory(m.category ?? m.series_ticker ?? "General"),
    yesPrice: Math.min(Math.max(yesPrice, 0.01), 0.99),
    noPrice: Math.min(Math.max(noPrice, 0.01), 0.99),
    volume24h,
    totalVolume,
    endDate:
      m.close_time?.split("T")[0] ??
      m.expected_expiration_time?.split("T")[0] ??
      "",
    trend: "up",
    change24h: 0,
    source: "kalshi",
  };
}

function normalizeKalshiCategory(raw: string): string {
  if (!raw) return "General";
  const map: Record<string, string> = {
    politics: "Politics",
    economics: "Economics",
    financials: "Finance",
    crypto: "Crypto",
    climate: "Science",
    sports: "Sports",
    technology: "Science",
    health: "Science",
  };
  return map[raw.toLowerCase()] ?? raw;
}

export async function findCrossMarketOpportunities(polymarkets: Market[]): Promise<CrossMarketOpp[]> {
  try {
    const kalshiMarkets = await fetchKalshiMarkets({ limit: 30 });
    if (kalshiMarkets.length === 0) return [];

    const opportunities: CrossMarketOpp[] = [];
    for (const poly of polymarkets) {
      const match = findBestMatch(poly, kalshiMarkets);
      if (!match) continue;
      const spread = Math.abs(poly.yesPrice - match.yesPrice);
      if (spread < 0.05) continue;
      const favoredPlatform: "polymarket" | "kalshi" =
        poly.yesPrice < match.yesPrice ? "polymarket" : "kalshi";
      opportunities.push({
        question: poly.question,
        polymarket: { ...poly, source: "polymarket" },
        kalshi: match,
        polyYes: poly.yesPrice,
        kalshiYes: match.yesPrice,
        spread,
        edge: spread * 0.85,
        favoredPlatform,
        direction: "YES",
      });
    }
    return opportunities.sort((a, b) => b.spread - a.spread).slice(0, 5);
  } catch (err) {
    console.warn("Cross-market scan failed:", err);
    return [];
  }
}

function findBestMatch(poly: Market, kalshiMarkets: Market[]): Market | null {
  const polyWords = normalizeQuestion(poly.question);
  let bestMatch: Market | null = null;
  let bestScore = 0;
  for (const k of kalshiMarkets) {
    const score = jaccardSimilarity(polyWords, normalizeQuestion(k.question));
    if (score > 0.25 && score > bestScore) {
      bestScore = score;
      bestMatch = k;
    }
  }
  return bestMatch;
}

function normalizeQuestion(q: string): Set<string> {
  const stopWords = new Set([
    "will", "the", "a", "an", "be", "is", "in", "of", "to", "by",
    "or", "and", "at", "on", "for", "this", "that", "with", "before", "after",
  ]);
  return new Set(
    q.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}