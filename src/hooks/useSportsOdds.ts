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

const DEFAULT_AUTO_SPORTS = ["americanfootball_nfl", "basketball_nba"];

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
  const [loadedSports, setLoadedSports] = useState<Set<string>>(new Set(DEFAULT_AUTO_SPORTS));
  const [keyUsage, setKeyUsage] = useState<KeyManager>(loadKeyUsage);
  const fetchingRef = useRef(false);
  const keyUsageRef = useRef<KeyManager>(keyUsage);
  useEffect(() => { keyUsageRef.current = keyUsage; }, [keyUsage]);

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
      const ak = getActiveKey(keyUsageRef.current);
      if (!ak) return [];
      const games = await fetchFullOdds(sport, ak === "secondary", trigger);
      const last = getLastKeyResponse();
      if (last.code === "QUOTA_EXHAUSTED") {
        // mark whichever was tried as exhausted
        persistUsage((u) => markKeyExhausted(u, ak));
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
    if (!ak) {
      setSportsError("quota_exhausted");
      return;
    }
    fetchingRef.current = true;
    setSportsLoading(true);
    setSportsError(null);
    try {
      // Mispricings still scan against polymarket sports markets
      try {
        const results = await findSportsMispricings(polymarkets, "server-managed", threshold, trigger);
        setMispricings(results);
        const dbg = getLastScanDebug();
        setDebug(dbg);
        setVegasGamesCount(dbg.vegasGamesFetched);
        setMatchesCount(dbg.matchesFound);
        setPolymarketsCount(dbg.polymarketSportsMarkets);
        const sm = await fetchPolymarketSportsMarkets(polymarkets);
        setSportsMarkets(sm);
        setEdgeResponse(getLastEdgeResponse());
        setEdgeError(getLastEdgeError());
        setGames(getLastGames());
      } catch (e) {
        console.warn("mispricings scan failed", e);
      }

      // Fetch only auto-loaded sports (default 2) sequentially with delay
      const allFull: FullGame[] = [];
      const autoSports = Array.from(loadedSports).length > 0
        ? Array.from(loadedSports)
        : DEFAULT_AUTO_SPORTS;
      for (const sport of autoSports) {
        if (!getActiveKey(keyUsageRef.current)) break;
        try {
          const got = await fetchOneSport(sport, trigger);
          if (got?.length) allFull.push(...got);
        } catch (e) {
          console.warn("fetchFullOdds failed for", sport, e);
        }
        await new Promise((r) => setTimeout(r, 500));
      }

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
    loadedSports,
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
      const ak = getActiveKey(keyUsageRef.current);
      if (!ak) return;
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

  const nextScanAt = null;

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
  };
}
