import type { Market, CrossMarketOpp } from "@/types";
import { MOCK_MARKETS } from "@/data/mockData";

const KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2";

let _token: { value: string; expiresAt: number } | null = null;

export async function getKalshiToken(): Promise<string | null> {
  const email = import.meta.env.VITE_KALSHI_EMAIL;
  const password = import.meta.env.VITE_KALSHI_API_KEY;
  if (!email || !password) return null;
  if (_token && _token.expiresAt > Date.now()) return _token.value;
  try {
    const resp = await fetch(`${KALSHI_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    _token = { value: data.token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
    return _token.value;
  } catch { return null; }
}

interface KalshiMarketRaw {
  ticker: string;
  title: string;
  category?: string;
  yes_ask?: number;
  no_ask?: number;
  volume_24h?: number;
  volume?: number;
  close_time?: string;
}

function mapMarket(m: KalshiMarketRaw): Market {
  return {
    id: `kalshi_${m.ticker}`,
    question: m.title,
    category: m.category || "General",
    yesPrice: (m.yes_ask ?? 50) / 100,
    noPrice: (m.no_ask ?? 50) / 100,
    volume24h: m.volume_24h ?? 0,
    totalVolume: m.volume ?? 0,
    endDate: m.close_time?.split("T")[0] ?? "",
    trend: "up",
    change24h: 0,
    source: "kalshi",
  };
}

export async function fetchKalshiMarkets(params: {
  limit?: number; cursor?: string; event_ticker?: string; series_ticker?: string; status?: string;
} = {}): Promise<Market[]> {
  const token = await getKalshiToken();
  if (!token) return mockKalshiMarkets();
  try {
    const q = new URLSearchParams();
    q.set("limit", String(params.limit ?? 20));
    q.set("status", params.status ?? "open");
    if (params.cursor) q.set("cursor", params.cursor);
    if (params.event_ticker) q.set("event_ticker", params.event_ticker);
    if (params.series_ticker) q.set("series_ticker", params.series_ticker);
    const resp = await fetch(`${KALSHI_API}/markets?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return mockKalshiMarkets();
    const data = await resp.json();
    return (data.markets ?? []).map(mapMarket);
  } catch { return mockKalshiMarkets(); }
}

export async function fetchKalshiMarket(ticker: string): Promise<Market | null> {
  const token = await getKalshiToken();
  if (!token) return null;
  try {
    const resp = await fetch(`${KALSHI_API}/markets/${ticker}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.market ? mapMarket(data.market) : null;
  } catch { return null; }
}

function mockKalshiMarkets(): Market[] {
  // Mock with slightly different prices to simulate spreads
  return MOCK_MARKETS.map((m, i) => ({
    ...m,
    id: `kalshi_${m.id}`,
    yesPrice: Math.max(0.02, Math.min(0.98, m.yesPrice + (i % 2 === 0 ? 0.07 : -0.06))),
    noPrice: Math.max(0.02, Math.min(0.98, m.noPrice + (i % 2 === 0 ? -0.07 : 0.06))),
    source: "kalshi",
  }));
}

function normalize(s: string): string[] {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a));
  const wb = new Set(normalize(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let matches = 0;
  wa.forEach((w) => { if (wb.has(w)) matches++; });
  const union = new Set([...wa, ...wb]).size;
  return matches / union;
}

export async function findCrossMarketOpportunities(): Promise<CrossMarketOpp[]> {
  const [polyMarkets, kalshiMarkets] = await Promise.all([
    Promise.resolve(MOCK_MARKETS.slice(0, 20)),
    fetchKalshiMarkets({ limit: 20 }),
  ]);

  const opps: CrossMarketOpp[] = [];
  for (const p of polyMarkets) {
    let best: { k: Market; sim: number } | null = null;
    for (const k of kalshiMarkets) {
      const sim = similarity(p.question, k.question);
      if (sim > 0.6 && (!best || sim > best.sim)) best = { k, sim };
    }
    if (!best) continue;
    const spread = Math.abs(p.yesPrice - best.k.yesPrice);
    if (spread <= 0.05) continue;
    const favored: "polymarket" | "kalshi" = p.yesPrice < best.k.yesPrice ? "polymarket" : "kalshi";
    opps.push({
      question: p.question,
      polymarket: { ...p, source: "polymarket" },
      kalshi: best.k,
      polyYes: p.yesPrice,
      kalshiYes: best.k.yesPrice,
      spread,
      edge: spread * 0.85,
      favoredPlatform: favored,
      direction: "YES",
    });
  }

  return opps.sort((a, b) => b.spread - a.spread).slice(0, 5);
}
