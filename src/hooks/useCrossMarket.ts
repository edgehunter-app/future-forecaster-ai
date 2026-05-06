import { useCallback, useEffect, useState } from "react";
import { findCrossMarketOpportunities, fetchKalshiMarkets } from "@/lib/kalshi";
import { useAppStore } from "@/store/useAppStore";

const STALE_MS = 15 * 60 * 1000;

export function useCrossMarket() {
  const markets = useAppStore((s) => s.markets);
  const opportunities = useAppStore((s) => s.crossMarketOpps);
  const setCrossMarketOpps = useAppStore((s) => s.setCrossMarketOpps);
  const lastScanned = useAppStore((s) => s.crossMarketLastScanned);
  const setCrossMarketLastScanned = useAppStore((s) => s.setCrossMarketLastScanned);
  const loading = useAppStore((s) => s.crossMarketLoading);
  const setLoading = useAppStore((s) => s.setCrossMarketLoading);

  const [error, setError] = useState<string | null>(null);
  const [kalshiAvailable, setKalshiAvailable] = useState(true);

  const scan = useCallback(async () => {
    if (markets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const kalshiMarkets = await fetchKalshiMarkets({ limit: 30 });
      setKalshiAvailable(kalshiMarkets.length > 0);
      const opps = await findCrossMarketOpportunities(markets);
      setCrossMarketOpps(opps);
      setCrossMarketLastScanned(new Date());
    } catch {
      setError("Scan failed. Kalshi may be temporarily unavailable.");
      setKalshiAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [markets, setLoading, setCrossMarketOpps, setCrossMarketLastScanned]);

  useEffect(() => {
    const isStale =
      !lastScanned || Date.now() - new Date(lastScanned).getTime() > STALE_MS;
    if (opportunities.length > 0 && !isStale) return;
    if (markets.length > 0) void scan();
    const interval = setInterval(() => void scan(), STALE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets.length]);

  return {
    opportunities,
    loading,
    lastScanned: lastScanned ? new Date(lastScanned) : null,
    error,
    kalshiAvailable,
    scan,
  };
}
