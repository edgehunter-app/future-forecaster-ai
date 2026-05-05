import { useCallback, useEffect, useRef, useState } from "react";
import type { Market } from "@/types";
import {
  fetchOdds,
  findSportsMispricings,
  getRemainingRequests,
  type OddsGame,
  type SportsMispricing,
} from "@/lib/oddsApi";
import { useAppStore } from "@/store/useAppStore";

const CACHE_KEY = "eh_sports_cache";
const CACHE_TTL = 30 * 60 * 1000;

export function useSportsOdds(polymarkets: Market[]) {
  const settings = useAppStore((s) => s.settings);
  const threshold = settings.sportsGapThreshold ?? 0.05;

  const [mispricings, setMispricings] = useState<SportsMispricing[]>([]);
  const [games, setGames] = useState<OddsGame[]>([]);
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
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const results = await findSportsMispricings(polymarkets, threshold);
      setMispricings(results);
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
  }, [polymarkets, threshold, remainingRequests]);

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
