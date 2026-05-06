import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_MARKETS } from "@/data/mockData";
import type { Market } from "@/types";

function mapMarketRow(row: any): Market {
  return {
    id: row.id,
    question: row.question ?? "",
    category: row.category ?? "General",
    yesPrice: Number(row.yes_price ?? 0),
    noPrice: Number(row.no_price ?? 0),
    volume24h: Number(row.volume_24h ?? 0),
    totalVolume: Number(row.total_volume ?? 0),
    endDate: row.end_date ?? "",
    trend: (row.trend ?? "flat") as Market["trend"],
    change24h: Number(row.change_24h ?? 0),
    source: (row.source ?? "polymarket") as Market["source"],
  };
}

export function useMarkets() {
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const updateStore = (markets: Market[]) =>
    useAppStore.setState({ markets });
  const [markets, setMarkets] = useState<Market[]>(isDemoMode ? MOCK_MARKETS : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isDemoMode) {
      setMarkets(MOCK_MARKETS);
      updateStore(MOCK_MARKETS);
      setLoading(false);
      return;
    }
    try {
      const { data, error: dbErr } = await supabase
        .from("markets_cache")
        .select("*")
        .order("volume_24h", { ascending: false })
        .limit(50);
      if (dbErr) throw dbErr;
      const mapped = (data ?? []).map(mapMarketRow);
      setMarkets(mapped);
      updateStore(mapped);
    } catch (e) {
      console.error("Markets load failed:", e);
      setError("Could not load markets.");
      setMarkets([]);
      updateStore([]);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    load();
  }, [load]);

  return { markets, loading, error, reload: load };
}