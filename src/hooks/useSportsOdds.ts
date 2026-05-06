import { useCallback, useEffect, useRef, useState } from "react";
import type { Market } from "@/types";
import {
  fetchOdds,
  findSportsMispricings,
  getRemainingRequests,
  fetchPolymarketSportsMarkets,
  getLastScanDebug,
  getLastEdgeResponse,
  getLastEdgeError,
  getLastGames,
  fetchFullOdds,
  isSportsMarket,
  type OddsGame,
  type SportsScanDebug,
} from "@/lib/oddsApi";
import { useAppStore } from "@/store/useAppStore";
import { SPORTS } from "@/lib/oddsApi";

const STALE_MS = 30 * 60 * 1000;

export function useSportsOdds(polymarkets: Market[]) {
  const settings = useAppStore((s) => s.settings);
  const threshold = settings.sportsGapThreshold ?? 0.02;

  // Store-backed state (survives navigation)
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
  const fetchingRef = useRef(false);

  const scan = useCallback(async () => {
    if (fetchingRef.current) return;
    if (remainingRequests !== null && remainingRequests <= 0) return;
    fetchingRef.current = true;
    setSportsLoading(true);
    setSportsError(null);
    try {
      const results = await findSportsMispricings(polymarkets, "server-managed", threshold);
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

      // Serialize sport fetches with a small delay to avoid Odds API freq limit (429).
      const allFull: any[] = [];
      for (const s of selectedSports) {
        try {
          const games = await fetchFullOdds(s);
          if (games?.length) allFull.push(...games);
        } catch (e) {
          console.warn("fetchFullOdds failed for", s, e);
        }
        await new Promise((r) => setTimeout(r, 250));
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
    remainingRequests,
    selectedSports,
    setFullGames,
    setMispricings,
    setSportsError,
    setSportsLastScanned,
    setSportsLoading,
  ]);

  const loadGamesForSport = useCallback(async (sportKey: string) => {
    setSportsLoading(true);
    try {
      const data = await fetchOdds(sportKey);
      setGames(data);
      setRemainingRequests(getRemainingRequests());
    } finally {
      setSportsLoading(false);
    }
  }, [setSportsLoading]);

  useEffect(() => {
    const isStale =
      !lastScanned ||
      Date.now() - new Date(lastScanned).getTime() > STALE_MS;
    if (fullGames.length > 0 && !isStale) {
      // fresh — skip
      return;
    }
    if (polymarkets.length > 0 || fullGames.length === 0) {
      void scan();
    }
    const interval = setInterval(() => { void scan(); }, STALE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  };
}
