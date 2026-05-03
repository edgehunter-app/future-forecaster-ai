import { useCallback, useEffect, useState } from "react";
import { findCrossMarketOpportunities, fetchKalshiMarkets } from "@/lib/kalshi";
import { useAppStore } from "@/store/useAppStore";
import type { CrossMarketOpp } from "@/types";

export function useCrossMarket() {
  const markets = useAppStore((s) => s.markets);
  const [opportunities, setOpportunities] = useState<CrossMarketOpp[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
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
      setOpportunities(opps);
      setLastScanned(new Date());
    } catch {
      setError("Scan failed. Kalshi may be temporarily unavailable.");
      setOpportunities([]);
      setKalshiAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [markets]);

  useEffect(() => {
    if (markets.length > 0) void scan();
    const interval = setInterval(() => void scan(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scan, markets.length]);

  return { opportunities, loading, lastScanned, error, kalshiAvailable, scan };
}
