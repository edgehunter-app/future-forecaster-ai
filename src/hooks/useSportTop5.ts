import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";

export interface Top5Entry {
  score: number;
  confidence: number;
  edge: number;
  game: FullGame;
  analysis: GameAnalysisResult;
}

export interface Top5Golf {
  tournament: string;
  confidence: number;
  edge: number;
  picks: Array<{ player: string; odds?: number; book?: string; reason?: string }>;
}

interface CacheShape {
  entries?: Top5Entry[];
  golf?: Top5Golf | null;
  analyzed: number;
  at: string;
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEK_SPORTS = new Set(["americanfootball_ncaaf", "americanfootball_nfl"]);
export const isWeekSport = (k: string) => WEEK_SPORTS.has(k);
/** Sports the morning job pre-populates. */
export const SCHEDULED_TOP5_SPORTS = new Set(["baseball_mlb", "basketball_nba", "icehockey_nhl", "soccer_epl", "soccer_usa_mls", "mma_mixed_martial_arts", ...WEEK_SPORTS]);

/** Thursday that starts the current Thu–Mon football week (Tue/Wed → upcoming Thu). */
function weekStartKey(now = new Date()) {
  const d = new Date(now);
  d.setDate(now.getDate() + [-3, -4, 2, 1, 0, -1, -2][now.getDay()]);
  return `wk-${localDateKey(d)}`;
}

function readCache(key: string): CacheShape | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

/**
 * Read-only: Top 5 is pre-populated each morning by the scheduled-top5 backend
 * job and shared through top5_cache. Users can't trigger a scan.
 */
export function useSportTop5(sportKey: string, games: FullGame[]) {
  const isGolf = sportKey === "golf";
  const periodKey = isWeekSport(sportKey) ? weekStartKey() : localDateKey();
  const cacheKey = `eh_top5_${sportKey}_${periodKey}`;
  const [data, setData] = useState<CacheShape | null>(() => readCache(cacheKey));

  useEffect(() => {
    let alive = true;
    setData(readCache(cacheKey));
    if (!sportKey || sportKey === "all") return;
    void supabase
      .from("top5_cache")
      .select("payload, scanned_at")
      .eq("sport_key", sportKey)
      .eq("period_key", periodKey)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!alive || !row) return;
        const shared = { ...(row.payload as unknown as CacheShape), at: row.scanned_at };
        setData(shared);
        try { localStorage.setItem(cacheKey, JSON.stringify(shared)); } catch { /* ignore */ }
      });
    return () => { alive = false; };
  }, [cacheKey, sportKey, periodKey]);

  const hasGames = isGolf
    ? games.some((g) => g.isOutright && (g.players?.length ?? 0) > 0)
    : games.some((g) => {
        const t = new Date(g.commenceTime);
        return Number.isFinite(t.getTime()) && (isWeekSport(sportKey) || localDateKey(t) === localDateKey());
      });

  return {
    entries: data?.entries ?? [],
    golf: data?.golf ?? null,
    analyzed: data?.analyzed ?? 0,
    hasResult: !!data,
    hasGamesToday: hasGames,
    isScheduled: SCHEDULED_TOP5_SPORTS.has(sportKey),
    lastScannedAt: data?.at ? new Date(data.at) : null,
  };
}
