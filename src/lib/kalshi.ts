import type { Market, CrossMarketOpp } from "@/types";

const KALSHI_PUBLIC_API = "https://trading-api.kalshi.com/trade-api/v2";

function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithCORSFallback(url: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) return await res.json();
  } catch {}
  try {
    const proxied = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxied);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function fetchKalshiMarkets(params?: {
  limit?: number;
  status?: string;
  series_ticker?: string;
}): Promise<Market[]> {
  const query = new URLSearchParams({
    limit: String(params?.limit ?? 20),
    status: params?.status ?? "open",
  }).toString();
  const data = await fetchWithCORSFallback(`${KALSHI_PUBLIC_API}/markets?${query}`);
  if (!data) return [];
  const markets = data.markets ?? [];
  return markets.map((m: any) => mapKalshiMarket(m));
}

export async function fetchKalshiMarket(ticker: string): Promise<Market | null> {
  const data = await fetchWithCORSFallback(`${KALSHI_PUBLIC_API}/markets/${ticker}`);
  if (!data?.market) return null;
  return mapKalshiMarket(data.market);
}

export async function fetchKalshiEvents(params?: { limit?: number; series_ticker?: string }): Promise<any[]> {
  const query = new URLSearchParams({ limit: String(params?.limit ?? 20) }).toString();
  const data = await fetchWithCORSFallback(`${KALSHI_PUBLIC_API}/events?${query}`);
  return data?.events ?? [];
}

function mapKalshiMarket(m: any): Market {
  const yesPrice = (m.yes_ask ?? m.yes_bid ?? 50) / 100;
  const noPrice = (m.no_ask ?? m.no_bid ?? 50) / 100;
  return {
    id: `kalshi_${m.ticker ?? m.id}`,
    question: m.title ?? m.question ?? "Unknown market",
    category: normalizeKalshiCategory(m.category),
    yesPrice: Math.min(Math.max(yesPrice, 0.01), 0.99),
    noPrice: Math.min(Math.max(noPrice, 0.01), 0.99),
    volume24h: m.volume_24h ?? 0,
    totalVolume: m.volume ?? 0,
    endDate: m.close_time?.split("T")[0] ?? "",
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