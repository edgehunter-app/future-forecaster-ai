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
  type SportsMispricing,
  type SportsScanDebug,
  type FullGame,
} from "@/lib/oddsApi";
import { useAppStore } from "@/store/useAppStore";
import { SPORTS } from "@/lib/oddsApi";

const CACHE_KEY = "eh_sports_cache";
const CACHE_TTL = 30 * 60 * 1000;

export function useSportsOdds(polymarkets: Market[]) {
  const settings = useAppStore((s) => s.settings);
  const threshold = settings.sportsGapThreshold ?? 0.03;

  const [mispricings, setMispricings] = useState<SportsMispricing[]>([]);
  const [games, setGames] = useState<OddsGame[]>([]);
  const [sportsMarkets, setSportsMarkets] = useState<Market[]>([]);
  const [debug, setDebug] = useState<SportsScanDebug | null>(null);
  const [polymarketsCount, setPolymarketsCount] = useState(0);
  const [vegasGamesCount, setVegasGamesCount] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [edgeResponse, setEdgeResponse] = useState<any>(null);
  const [edgeError, setEdgeError] = useState<any>(null);
  const [fullGames, setFullGames] = useState<FullGame[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>(
    SPORTS.slice(0, 4).map((s) => s.key),
  );
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL) {
          setMispricings(data);
          setLastScanned(new Date(timestamp));
          setFromCache(true);
        }
      }
    } catch {}
  }, []);

  const scan = useCallback(async () => {
    if (fetchingRef.current) return;
    if (remainingRequests !== null && remainingRequests <= 0) return;
    localStorage.removeItem(CACHE_KEY);
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const results = await findSportsMispricings(polymarkets, "server-managed", 0.02);
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

      // Fetch full odds (h2h+spreads+totals) for selected sports
      const fullResults = await Promise.allSettled(
        selectedSports.map((s) => fetchFullOdds(s)),
      );
      const allFull = fullResults
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => (r as PromiseFulfilledResult<FullGame[]>).value);

      // Try matching to a Polymarket market by team words
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
      setLastScanned(new Date());
      setFromCache(false);
      setRemainingRequests(getRemainingRequests());
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: results, timestamp: Date.now() }));
    } catch {
      setError("Sports odds unavailable right now. Try again shortly.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [polymarkets, threshold, remainingRequests, selectedSports]);

  const loadGamesForSport = useCallback(
    async (sportKey: string) => {
      setLoading(true);
      try {
        const data = await fetchOdds(sportKey);
        setGames(data);
        setRemainingRequests(getRemainingRequests());
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (polymarkets.length > 0) void scan();
    const interval = setInterval(() => { void scan(); }, 30 * 60 * 1000);
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
    lastScanned,
    fromCache,
    error,
    remainingRequests,
    hasApiKey: true,
    scan,
    loadGamesForSport,
  };
}
