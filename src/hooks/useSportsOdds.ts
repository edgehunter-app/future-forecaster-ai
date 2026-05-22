import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Market } from "@/types";
import {
  findSportsMispricings,
  getRemainingRequests,
  fetchPolymarketSportsMarkets,
  getLastScanDebug,
  getLastEdgeResponse,
  getLastEdgeError,
  getLastGames,
  fetchFullOdds,
  getLastKeyResponse,
  isSportsMarket,
  fetchSportsbookGaps,
  gapToMispricing,
  type OddsGame,
  type SportsScanDebug,
  type FullGame,
} from "@/lib/oddsApi";
import { useAppStore } from "@/store/useAppStore";
import { SPORTS } from "@/lib/oddsApi";
import { getDailyCount, DAILY_CAP } from "@/lib/oddsDailyCap";
import {
  loadKeyUsage,
  saveKeyUsage,
  getActiveKey,
  markKeyExhausted,
  updateKeyUsage,
  getOptimalInterval,
  getUsageSummary,
  type KeyManager,
} from "@/lib/oddsApiKeyManager";

const DEFAULT_SPORT = "americanfootball_nfl";

export function useSportsOdds(polymarkets: Market[]) {
  const settings = useAppStore((s) => s.settings);
  const threshold = settings.sportsGapThreshold ?? 0.02;

  // Store-backed
  const fullGames = useAppStore((s) => s.fullGames);
  const lastScanned = useAppStore((s) => s.sportsLastScanned);
  const loading = useAppStore((s) => s.sportsLoading);
  const error = useAppStore((s) => s.sportsError);
  const mispricings = useAppStore((s) => s.sportsMispricings);
  const setFullGames = useAppStore((s) => s.setFullGames);
  const setSportsLastScanned = useAppStore((s) => s.setSportsLastScanned);
  const setSportsLoading = useAppStore((s) => s.setSportsLoading);
  const setSportsError = useAppStore((s) => s.setSportsError);
  const setMispricings = useAppStore((s) => s.setSportsMispricings);

  // Local UI state
  const [games, setGames] = useState<OddsGame[]>([]);
  const [sportsMarkets, setSportsMarkets] = useState<Market[]>([]);
  const [debug, setDebug] = useState<SportsScanDebug | null>(null);
  const [polymarketsCount, setPolymarketsCount] = useState(0);
  const [vegasGamesCount, setVegasGamesCount] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [edgeResponse, setEdgeResponse] = useState<any>(null);
  const [edgeError, setEdgeError] = useState<any>(null);
  const [selectedSports, setSelectedSports] = useState<string[]>(SPORTS.map((s) => s.key));
  const [remainingRequests, setRemainingRequests] = useState<number | null>(getRemainingRequests());
  const [fromCache, setFromCache] = useState(false);
  const [loadedSports, setLoadedSports] = useState<Set<string>>(new Set([DEFAULT_SPORT]));
  const [currentSport, setCurrentSport] = useState<string>(DEFAULT_SPORT);
  const [keyUsage, setKeyUsage] = useState<KeyManager>(loadKeyUsage);
  const fetchingRef = useRef(false);
  const keyUsageRef = useRef<KeyManager>(keyUsage);
  useEffect(() => { keyUsageRef.current = keyUsage; }, [keyUsage]);
  const currentSportRef = useRef(currentSport);
  useEffect(() => { currentSportRef.current = currentSport; }, [currentSport]);
  const [nextScanAt, setNextScanAt] = useState<Date | null>(null);

  // Default to MANUAL refresh only (0). Auto-scan burns through quota fast.
  const refreshMinutes = settings.sportsRefreshMinutes ?? 0;

  const activeKey = getActiveKey(keyUsage);
  const usageSummary = useMemo(() => getUsageSummary(keyUsage), [keyUsage]);
  const scanInterval = usageSummary.intervalMs;

  const persistUsage = useCallback((updater: (u: KeyManager) => KeyManager) => {
    setKeyUsage((prev) => {
      const next = updater(prev);
      saveKeyUsage(next);
      keyUsageRef.current = next;
      return next;
    });
  }, []);

  const fetchOneSport = useCallback(
    async (sport: string, trigger: string = "unknown"): Promise<FullGame[]> => {
      // RapidAPI/Sportsbook quota is enforced inside the edge function; do
      // not gate on the legacy TheOddsAPI key manager.
      const ak = getActiveKey(keyUsageRef.current);
      const games = await fetchFullOdds(sport, ak === "secondary", trigger);
      const last = getLastKeyResponse();
      if (last.code === "QUOTA_EXHAUSTED") {
        if (ak) persistUsage((u) => markKeyExhausted(u, ak));
        return [];
      }
      if (last.keyUsed && typeof last.remaining === "number") {
        persistUsage((u) => updateKeyUsage(u, last.keyUsed!, last.remaining!));
      }
      return games ?? [];
    },
    [persistUsage],
  );

  const scan = useCallback(async (trigger: string = "manual") => {
    if (fetchingRef.current) return;
    const ak = getActiveKey(keyUsageRef.current);
    console.log("Sports scan starting...", {
      trigger,
      activeKey: ak,
      dailyCount: `${getDailyCount()}/${DAILY_CAP}`,
      fullGamesInStore: useAppStore.getState().fullGames?.length ?? 0,
      lastScanned: useAppStore.getState().sportsLastScanned,
    });
    // No longer gate on the legacy TheOddsAPI key manager — the Sportsbook
    // edge function enforces its own daily limit.
    fetchingRef.current = true;
    setSportsLoading(true);
    setSportsError(null);
    try {
      // Cross-market gaps now come from Sportsbook API directly (one call,
      // shared via edge fn cache with the per-sport fetches below).
      try {
        const { gaps } = await fetchSportsbookGaps(trigger);
        const mispricingsFromGaps = gaps
          .filter((g) => Math.abs(g.edgePct) / 100 >= threshold)
          .slice(0, 20)
          .map(gapToMispricing);
        setMispricings(mispricingsFromGaps);
        const sm = await fetchPolymarketSportsMarkets(polymarkets);
        setSportsMarkets(sm);
        setEdgeResponse(getLastEdgeResponse());
        setEdgeError(getLastEdgeError());
        setGames(getLastGames());
      } catch (e) {
        console.warn("sportsbook gaps fetch failed", e);
      }

      // Sportsbook API returns every sport in one call, so a single refresh
      // fully repopulates the board across all leagues.
      let allFull: FullGame[] = [];
      try {
        allFull = await fetchOneSport(currentSportRef.current, trigger);
      } catch (e) {
        console.warn("fetchFullOdds failed", e);
      }
      console.log("[useSportsOdds] mapped games:", allFull.length,
        "sports:", [...new Set(allFull.map((g) => g.sport))]);
      setLoadedSports(new Set([...SPORTS.map((s) => s.key)]));

      const polySports = polymarkets.filter((m) => isSportsMarket(m));
      for (const game of allFull) {
        const homeWord = game.homeTeam.split(" ").pop()?.toLowerCase() ?? "";
        const awayWord = game.awayTeam.split(" ").pop()?.toLowerCase() ?? "";
        const match = polySports.find((m) => {
          const q = m.question.toLowerCase();
          return homeWord && awayWord && q.includes(homeWord) && q.includes(awayWord);
        });
        if (match) {
          game.polymarketMatch = match;
          game.polymarketImplied = match.yesPrice;
          game.mispricingGap = match.yesPrice - game.moneyline.homeImplied;
        }
      }
      setFullGames(allFull);
      console.log("[useSportsOdds] fullGames set to:", allFull.length);
      setSportsLastScanned(new Date());
      setFromCache(false);
      setRemainingRequests(getRemainingRequests());
    } catch {
      setSportsError("Sports odds unavailable right now. Try again shortly.");
    } finally {
      setSportsLoading(false);
      fetchingRef.current = false;
    }
  }, [
    polymarkets,
    threshold,
    fetchOneSport,
    setFullGames,
    setMispricings,
    setSportsError,
    setSportsLastScanned,
    setSportsLoading,
  ]);

  // Lazy-load a single sport on demand (e.g. tab click)
  const loadGamesForSport = useCallback(
    async (sportKey: string) => {
      if (loadedSports.has(sportKey)) return;
      setSportsLoading(true);
      try {
        const got = await fetchOneSport(sportKey, "tab-click");
        if (got.length) {
          const merged = [...(useAppStore.getState().fullGames ?? []), ...got];
          setFullGames(merged);
        }
        setLoadedSports((prev) => new Set([...prev, sportKey]));
        setRemainingRequests(getRemainingRequests());
      } finally {
        setSportsLoading(false);
      }
    },
    [loadedSports, fetchOneSport, setFullGames, setSportsLoading],
  );

  // Mount-only fetch: fire ONCE per mount, only if store is empty AND last
  // scan was 4+ hours ago AND not already loading. No setInterval — manual
  // refresh only after that.
  useEffect(() => {
    if (loading) return;
    console.log("[useSportsOdds] mount check", {
      storeFullGames: useAppStore.getState().fullGames?.length ?? 0,
      storeLastScanned: useAppStore.getState().sportsLastScanned,
    });
    if (fullGames.length === 0) {
      console.log("No games in store — force fetching");
      void scan("manual");
      return;
    }
    const lastScannedTime = lastScanned ? new Date(lastScanned).getTime() : 0;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const isStale = Date.now() - lastScannedTime > FOUR_HOURS;
    if (isStale) void scan("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh on the user's chosen interval — refreshes only the current sport.
  useEffect(() => {
    if (!refreshMinutes || refreshMinutes <= 0) {
      setNextScanAt(null);
      return;
    }
    const ms = refreshMinutes * 60 * 1000;
    setNextScanAt(new Date(Date.now() + ms));
    const id = setInterval(() => {
      void scan("auto");
      setNextScanAt(new Date(Date.now() + ms));
    }, ms);
    return () => clearInterval(id);
  }, [refreshMinutes, scan]);

  return {
    mispricings,
    games,
    fullGames,
    selectedSports,
    setSelectedSports,
    sportsMarkets,
    debug,
    polymarketsCount,
    vegasGamesCount,
    matchesCount,
    edgeResponse,
    edgeError,
    threshold,
    loading,
    lastScanned: lastScanned ? new Date(lastScanned) : null,
    fromCache,
    error,
    remainingRequests,
    hasApiKey: true,
    scan,
    loadGamesForSport,
    keyUsage,
    usageSummary,
    scanInterval,
    activeKey,
    loadedSports,
    nextScanAt,
    currentSport,
    setCurrentSport,
  };
}
