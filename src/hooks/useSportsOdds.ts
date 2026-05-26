import { useCallback, useEffect, useRef, useState } from "react";
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
  const fetchingRef = useRef(false);
  const currentSportRef = useRef(currentSport);
  useEffect(() => { currentSportRef.current = currentSport; }, [currentSport]);
  const [nextScanAt, setNextScanAt] = useState<Date | null>(null);

  // Default to MANUAL refresh only (0). Auto-scan burns through quota fast.
  const refreshMinutes = settings.sportsRefreshMinutes ?? 0;

  const filterRelevantGames = useCallback((games: FullGame[]): FullGame[] => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);

    return games.filter((game) => {
      const gameTime = new Date(game.commenceTime);

      // Must start before tomorrow 6am
      if (gameTime > tomorrow) return false;

      // Must not have started more than 3 hours ago
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      if (gameTime < threeHoursAgo) return false;

      // Must have at least 1 book with odds
      const hasOdds = game.bookmakers?.some(
        (b) => b.homeMoneyline !== 0 || b.awayMoneyline !== 0,
      );
      if (!hasOdds) return false;

      return true;
    });
  }, []);

  const fetchOneSport = useCallback(
    async (sport: string, trigger: string = "unknown"): Promise<FullGame[]> => {
      // RapidAPI/Sportsbook quota is enforced inside the edge function.
      const games = await fetchFullOdds(sport, false, trigger);
      return games ?? [];
    },
    [],
  );

  const scan = useCallback(async (trigger: string = "manual") => {
    if (fetchingRef.current) return;
    console.log("Sports scan starting...", {
      trigger,
      dailyCount: `${getDailyCount()}/${DAILY_CAP}`,
      fullGamesInStore: useAppStore.getState().fullGames?.length ?? 0,
      lastScanned: useAppStore.getState().sportsLastScanned,
    });
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
      setSportsError("scan_failed");
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

  // Manual refresh only — no auto-scan interval.
  useEffect(() => {
    setNextScanAt(null);
  }, [refreshMinutes]);

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
    loadedSports,
    nextScanAt,
    currentSport,
    setCurrentSport,
  };
}
