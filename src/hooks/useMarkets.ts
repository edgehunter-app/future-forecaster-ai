import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_MARKETS } from "@/data/mockData";
import type { Market } from "@/types";

const STALE_MS = 5 * 60 * 1000;

function mapMarket(m: any): Market {
  let outcomePrices: any = m.outcomePrices ?? m.outcome_prices;
  if (typeof outcomePrices === "string") {
    try { outcomePrices = JSON.parse(outcomePrices); } catch { outcomePrices = null; }
  }
  const yesRaw = outcomePrices?.[0] ?? m.bestAsk ?? m.lastTradePrice ?? "0.5";
  const yesPrice = parseFloat(String(yesRaw));
  const noRaw = outcomePrices?.[1] ?? String(1 - yesPrice);
  const noPrice = parseFloat(String(noRaw));
  return {
    id: String(m.id ?? m.condition_id ?? m.conditionId ?? m.slug ?? ""),
    question: m.question ?? m.title ?? "Unknown",
    category: m.category ?? m.tags?.[0] ?? "General",
    yesPrice: Math.min(Math.max(isFinite(yesPrice) ? yesPrice : 0.5, 0.01), 0.99),
    noPrice: Math.min(Math.max(isFinite(noPrice) ? noPrice : 0.5, 0.01), 0.99),
    volume24h: parseFloat(String(m.volume24hr ?? m.volume24h ?? "0")) || 0,
    totalVolume: parseFloat(String(m.volume ?? "0")) || 0,
    endDate: (m.end_date_iso ?? m.endDate ?? "").toString().split("T")[0] ?? "",
    trend: "up",
    change24h: parseFloat(String(m.oneDayPriceChange ?? m.change24h ?? "0")) || 0,
    source: "polymarket",
  };
}

export function useMarkets() {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const cachedMarkets = useAppStore((s) => s.cachedMarkets);
  const marketsLastUpdated = useAppStore((s) => s.marketsLastUpdated);
  const marketsIsLive = useAppStore((s) => s.marketsIsLive);
  const setCachedMarkets = useAppStore((s) => s.setCachedMarkets);

  const [loading, setLoading] = useState(cachedMarkets.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(marketsIsLive);

  const writeMarkets = useCallback(
    (m: Market[], live: boolean) => {
      setCachedMarkets(m, live);
      useAppStore.setState({ markets: m });
      setIsLive(live);
    },
    [setCachedMarkets],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log("useMarkets: starting fetch...");

    if (isDemoMode) {
      writeMarkets(MOCK_MARKETS, false);
      setLoading(false);
      return;
    }

    const endpoints = [
      "https://gamma-api.polymarket.com/markets?limit=20&active=true&order=volume24hr&ascending=false",
      "https://gamma-api.polymarket.com/markets?limit=20&closed=false",
      "https://gamma-api.polymarket.com/markets?limit=20",
    ];
    for (const url of endpoints) {
      try {
        console.log("Trying:", url);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        console.log("Status:", res.status);
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : data.markets ?? data.data ?? [];
          console.log("Markets found:", raw.length);
          if (raw.length > 0) {
            const mapped = raw.map(mapMarket).filter((m: Market) => m.question && m.yesPrice > 0);
            if (mapped.length > 0) {
              writeMarkets(mapped, true);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Endpoint failed:", url, err);
      }
    }

    try {
      console.log("Trying CORS proxy...");
      const proxied =
        "https://corsproxy.io/?" +
        encodeURIComponent(
          "https://gamma-api.polymarket.com/markets?limit=20&active=true",
        );
      const res = await fetch(proxied);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.markets ?? [];
        if (raw.length > 0) {
          const mapped = raw.map(mapMarket).filter((m: Market) => m.question);
          writeMarkets(mapped, false);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("CORS proxy failed:", err);
    }

    console.warn("All endpoints failed — using mock data");
    writeMarkets(MOCK_MARKETS, false);
    setError("Live market data unavailable — showing samples. Click refresh to try again.");
    setLoading(false);
  }, [isDemoMode, writeMarkets]);

  useEffect(() => {
    const isStale =
      !marketsLastUpdated ||
      Date.now() - new Date(marketsLastUpdated).getTime() > STALE_MS;
    if (cachedMarkets.length > 0 && !isStale) {
      // Use cache, also sync to legacy `markets` slot
      useAppStore.setState({ markets: cachedMarkets });
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    markets: cachedMarkets,
    loading,
    error,
    isLive,
    lastUpdated: marketsLastUpdated,
    reload: load,
    refresh: load,
  };
}
