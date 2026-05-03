import { useCallback, useEffect, useState } from "react";
import { findCrossMarketOpportunities } from "@/lib/kalshi";
import type { CrossMarketOpp } from "@/types";

export function useCrossMarket() {
  const [opportunities, setOpportunities] = useState<CrossMarketOpp[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const opps = await findCrossMarketOpportunities();
      setOpportunities(opps);
      setLastScanned(new Date());
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void scan();
    const interval = setInterval(() => void scan(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scan]);

  return { opportunities, loading, lastScanned, scan };
}
