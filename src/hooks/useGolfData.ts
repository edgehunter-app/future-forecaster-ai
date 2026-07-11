import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GolfTournament {
  tournId: string;
  name: string;
  format: string | null;
  purse: number;
  winnersShare: number;
  fedexCupPoints: number;
  startMs: number;
  endMs: number;
  startIso: string | null;
  endIso: string | null;
}

export interface GolfLeaderboardRow {
  position: string;
  firstName: string;
  lastName: string;
  playerId: string;
  status: string;
  isAmateur: boolean;
  total: string;
  currentRoundScore: string;
  totalStrokesFromCompletedRounds: number;
  courseId: string;
  rounds: {
    roundId: number;
    strokes: number;
    scoreToPar: string;
    courseName: string;
    courseId: string;
  }[];
}

export interface GolfLeaderboard {
  status: string;
  roundId: number;
  rows: GolfLeaderboardRow[];
  cutLines: { cutCount: number; cutScore: string }[];
}

interface GolfCurrentResponse {
  ok: boolean;
  tournament: GolfTournament | null;
  leaderboard: GolfLeaderboard | null;
  isLive: boolean;
  error?: string;
  cachedAt?: string;
  nextRefreshAt?: string;
  cacheMinutes?: number;
  servedFromCache?: boolean;
}

const CACHE_KEY = "eh.golfDataCache.v4";
const TTL_MS = 30 * 60 * 1000; // 30 min — matches server cache
const MANUAL_REFRESH_KEY = "golf_manual_refresh";
const MANUAL_REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

interface CachedPayload {
  fetchedAt: number;
  data: GolfCurrentResponse;
}

function readCache(): CachedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: GolfCurrentResponse) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data } satisfies CachedPayload),
    );
  } catch {
    // ignore quota errors
  }
}

export function useGolfData() {
  const cached = readCache();
  const [tournament, setTournament] = useState<GolfTournament | null>(
    cached?.data?.tournament ?? null,
  );
  const [leaderboard, setLeaderboard] = useState<GolfLeaderboard | null>(
    cached?.data?.leaderboard ?? null,
  );
  const [isLive, setIsLive] = useState<boolean>(cached?.data?.isLive ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(cached?.fetchedAt ?? null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(
    cached?.data?.nextRefreshAt ? new Date(cached.data.nextRefreshAt).getTime() : null,
  );
  const inflight = useRef<Promise<void> | null>(null);

  const fetchCurrent = useCallback(async (force = false): Promise<void> => {
    if (inflight.current) return inflight.current;
    // Rate-limit forced refreshes to protect the 250 req/MONTH quota.
    if (force && typeof window !== "undefined") {
      const last = Number(window.localStorage.getItem(MANUAL_REFRESH_KEY) ?? "0");
      if (last && Date.now() - last < MANUAL_REFRESH_COOLDOWN_MS) {
        console.log("[useGolfData] manual refresh blocked (cooldown active)");
        return;
      }
      window.localStorage.setItem(MANUAL_REFRESH_KEY, String(Date.now()));
    }
    if (!force) {
      const c = readCache();
      if (c) {
        console.log("[useGolfData] cache hit, tournament:", c.data.tournament?.name ?? "NONE",
          "isLive:", c.data.isLive, "rows:", c.data.leaderboard?.rows?.length ?? 0);
        setTournament(c.data.tournament);
        setLeaderboard(c.data.leaderboard);
        setIsLive(c.data.isLive);
        setFetchedAt(c.fetchedAt);
        if (c.data.nextRefreshAt) setNextRefreshAt(new Date(c.data.nextRefreshAt).getTime());
        return;
      }
    }
    setLoading(true);
    setError(null);
    console.log("[useGolfData] fetching current tournament (force=" + force + ")...");
    const p = (async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke<GolfCurrentResponse>(
          "fetch-golf-data",
          { body: { type: "current", forceRefresh: force } },
        );
        if (invokeError) throw invokeError;
        if (!data) throw new Error("empty response");
        console.log("[useGolfData] response:",
          "tournament=", data.tournament?.name ?? "NONE",
          "rows=", data.leaderboard?.rows?.length ?? 0,
          "isLive=", data.isLive,
          "ok=", data.ok,
          "fromCache=", !!data.servedFromCache);
        // Only overwrite state when we actually got real data back.
        // Upstream 429s / transient errors return nulls — keep the
        // previously-rendered leaderboard visible instead of blanking it.
        if (data.tournament) setTournament(data.tournament);
        if (data.leaderboard && (data.leaderboard.rows?.length ?? 0) > 0) {
          setLeaderboard(data.leaderboard);
        }
        if (data.ok && data.isLive !== undefined) setIsLive(!!data.isLive);
        if (data.ok) {
          writeCache(data);
          setFetchedAt(Date.now());
          if (data.nextRefreshAt) setNextRefreshAt(new Date(data.nextRefreshAt).getTime());
        }
        if (!data.ok && data.error) setError(data.error);
        console.log("[useGolfData] SET leaderboard rows:",
          data.leaderboard?.rows?.length ?? "kept-previous");
      } catch (err) {
        console.warn("[useGolfData] fetch failed:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    // Fetch on mount but DO NOT force — server-side golf_cache (30 min TTL)
    // handles freshness, avoiding a quota call on every page load.
    void fetchCurrent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    tournament, leaderboard, isLive, loading, error, fetchCurrent,
    fetchedAt, nextRefreshAt,
  };
}