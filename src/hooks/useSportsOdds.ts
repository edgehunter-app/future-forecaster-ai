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
const GOLF_CACHE_VERSION_KEY = "eh.sportsOddsCacheVersion";
const GOLF_CACHE_VERSION = "wc-7day-filter-v2";
const GOLF_CACHE_KEYS = [
  "golf",
  "golf_pga_tour",
  "golf_liv_golf",
  "golf_the_open_championship_winner",
  "golf_masters_tournament_winner",
  "golf_pga_championship_winner",
  "golf_us_open_winner",
];

function isGolfGame(game: FullGame): boolean {
  const sport = (game.sport ?? "").toLowerCase();
  const league = (game.league ?? "").toLowerCase();
  return sport.startsWith("golf") || league.includes("golf") || game.isOutright === true;
}

function isWorldCupGame(game: FullGame): boolean {
  const sport = (game.sport ?? "").toLowerCase();
  const league = (game.league ?? "").toLowerCase();
  const sportRaw = game.sport ?? "";
  const leagueRaw = game.league ?? "";
  return (
    sport.includes("world_cup") ||
    sport.includes("fifa") ||
    sport.includes("fifa_wc") ||
    league.includes("world cup") ||
    league.includes("fifa") ||
    sportRaw.toUpperCase() === "FIFA_WC" ||
    leagueRaw.toUpperCase() === "FIFA_WC"
  );
}

function isMMAGame(game: FullGame): boolean {
  const sport = (game.sport ?? "").toLowerCase();
  const league = (game.league ?? "").toLowerCase();
  return sport.includes("mma") || sport.includes("ufc") || league.includes("ufc") || league.includes("mma");
}

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
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const daysOut = (days: number) =>
      new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return games.filter((game) => {
      // Golf outrights — always show when player odds exist.
      if (game.isOutright === true) {
        return (game.players?.length ?? 0) > 0;
      }

      const gameTime = new Date(game.commenceTime);

      // Must not have started more than 3 hours ago
      if (gameTime < threeHoursAgo) return false;

      // World Cup: keep games even without posted odds — lines populate later.
      if (isWorldCupGame(game)) return gameTime <= daysOut(7);

      // Must have at least 1 book with odds
      const hasOdds = game.bookmakers?.some(
        (b) => b.homeMoneyline !== 0 || b.awayMoneyline !== 0,
      );
      if (!hasOdds) return false;

      const sport = (game.sport ?? "").toLowerCase();

      // 7-day window: World Cup, MMA/UFC, NFL (lines posted early week).
      if (isMMAGame(game)) return gameTime <= daysOut(7);
      if (sport.includes("americanfootball")) return gameTime <= daysOut(7);

      // 3-day window: MLB, NBA, NHL, Soccer, and everything else.
      return gameTime <= daysOut(3);
    });
  }, []);

  const sortGamesForDisplay = useCallback((games: FullGame[]): FullGame[] => {
    const rank = (g: FullGame) => {
      if (isWorldCupGame(g)) return 0; // World Cup pinned to top
      const t = new Date(g.commenceTime).getTime();
      const now = Date.now();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (t <= endOfToday.getTime() && t >= now - 3 * 60 * 60 * 1000) return 1;
      return 2;
    };
    return [...games].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
    });
  }, []);

  const fetchOneSport = useCallback(
    async (sport: string, trigger: string = "unknown", force = false): Promise<FullGame[]> => {
      // RapidAPI/Sportsbook quota is enforced inside the edge function.
      const games = await fetchFullOdds(sport, false, trigger, force);
      return games ?? [];
    },
    [],
  );

  const clearGolfCache = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.toLowerCase().includes("golf"))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch (err) {
        console.warn("Failed to clear local golf cache", err);
      }
    }

    const withoutGolf = (useAppStore.getState().fullGames ?? []).filter((game) => !isGolfGame(game));
    setFullGames(withoutGolf);
    setLoadedSports((prev) => {
      const next = new Set(prev);
      GOLF_CACHE_KEYS.forEach((key) => next.delete(key));
      return next;
    });
    setFromCache(false);
  }, [setFullGames]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(GOLF_CACHE_VERSION_KEY) === GOLF_CACHE_VERSION) return;
      clearGolfCache();
      window.localStorage.setItem(GOLF_CACHE_VERSION_KEY, GOLF_CACHE_VERSION);
    } catch (err) {
      console.warn("Failed to invalidate stale golf cache", err);
    }
  }, [clearGolfCache]);

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
        const rawGames = await fetchOneSport(currentSportRef.current, trigger);
        allFull = sortGamesForDisplay(filterRelevantGames(rawGames));
        console.log("Relevant games today:", allFull.length, "of", rawGames.length);
      } catch (e) {
        console.warn("fetchFullOdds failed", e);
      }
      console.log("[useSportsOdds] mapped games:", allFull.length,
        "sports:", [...new Set(allFull.map((g) => g.sport))]);
      setLoadedSports(() => {
        const loaded = new Set(SPORTS.map((s) => s.key));
        if (!allFull.some(isGolfGame)) loaded.delete("golf");
        return loaded;
      });

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
    filterRelevantGames,
    sortGamesForDisplay,
    setFullGames,
    setMispricings,
    setSportsError,
    setSportsLastScanned,
    setSportsLoading,
  ]);

  // Lazy-load a single sport on demand (e.g. tab click)
  const loadGamesForSport = useCallback(
    async (sportKey: string, force = false) => {
      if (!force && loadedSports.has(sportKey)) return;
      setSportsLoading(true);
      try {
        if (force && sportKey === "golf") clearGolfCache();
        const raw = await fetchOneSport(sportKey, force ? "force-reload" : "tab-click", force);
        const isWC = sportKey === "soccer_fifa_world_cup";
        if (isWC) {
          console.log("[WC] games fetched:", raw?.length);
          console.log("[WC] raw game fields:", raw?.map((g) => ({
            sport: g.sport,
            league: g.league,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            commenceTime: g.commenceTime,
            bookmakerCount: g.bookmakers?.length ?? 0,
            hasOdds: g.bookmakers?.some((b) => b.homeMoneyline !== 0 || b.awayMoneyline !== 0) ?? false,
          })));
          console.log("[WC] game dates:", raw?.map((g) => ({
            teams: `${g.awayTeam} vs ${g.homeTeam}`,
            time: g.commenceTime,
            daysOut: Math.round((new Date(g.commenceTime).getTime() - Date.now()) / 86400000),
          })));
        }
        const got = filterRelevantGames(raw);
        const gotForSport = sportKey === "golf" ? got.filter(isGolfGame) : got;
        if (isWC) console.log("[WC] after filter:", gotForSport.length);
        if (gotForSport.length || force) {
          const current = useAppStore.getState().fullGames ?? [];
          const base = sportKey === "golf" || force
            ? current.filter((game) => sportKey === "golf" ? !isGolfGame(game) : game.sport !== sportKey)
            : current;
          const merged = [...base, ...gotForSport];
          setFullGames(sortGamesForDisplay(merged));
        }
        setLoadedSports((prev) => {
          const next = new Set(prev);
          if (sportKey === "golf" && !gotForSport.some(isGolfGame)) {
            next.delete("golf");
          } else {
            next.add(sportKey);
          }
          return next;
        });
        setRemainingRequests(getRemainingRequests());
      } finally {
        setSportsLoading(false);
      }
    },
    [loadedSports, fetchOneSport, filterRelevantGames, sortGamesForDisplay, setFullGames, setSportsLoading, clearGolfCache],
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
    clearGolfCache,
    loadedSports,
    nextScanAt,
    currentSport,
    setCurrentSport,
  };
}
