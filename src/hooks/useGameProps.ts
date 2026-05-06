import { useCallback, useEffect, useState } from "react";
import { fetchGameProps, type GameProps } from "@/lib/oddsApi";
import { useAppStore } from "@/store/useAppStore";

const PROPS_CACHE_KEY = "eh_props_cache";
const PROPS_CACHE_TTL = 2 * 60 * 60 * 1000;

function saveCache(cache: Record<string, GameProps>) {
  try { localStorage.setItem(PROPS_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export function useGameProps() {
  const propsCache = useAppStore((s) => s.propsCache);
  const setPropsCache = useAppStore((s) => s.setPropsCache);
  const [loadingGames, setLoadingGames] = useState<Set<string>>(new Set());

  // Hydrate from localStorage on first mount if store is empty
  useEffect(() => {
    if (Object.keys(propsCache).length === 0) {
      try {
        const raw = localStorage.getItem(PROPS_CACHE_KEY);
        if (raw) setPropsCache(JSON.parse(raw));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCached = useCallback(
    (gameId: string) => {
      const cached = propsCache[gameId];
      return !!cached && Date.now() - cached.fetchedAt < PROPS_CACHE_TTL;
    },
    [propsCache],
  );

  const getCached = useCallback(
    (gameId: string) => (isCached(gameId) ? propsCache[gameId] : null),
    [propsCache, isCached],
  );

  const isLoading = useCallback(
    (gameId: string) => loadingGames.has(gameId),
    [loadingGames],
  );

  const fetchProps = useCallback(
    async (sportKey: string, gameId: string): Promise<GameProps | null> => {
      const cached = propsCache[gameId];
      if (cached && Date.now() - cached.fetchedAt < PROPS_CACHE_TTL) return cached;
      if (loadingGames.has(gameId)) return null;
      setLoadingGames((prev) => new Set([...prev, gameId]));
      try {
        const result = await fetchGameProps(sportKey, gameId);
        if (result) {
          const next = { ...propsCache, [gameId]: result };
          setPropsCache(next);
          saveCache(next);
        }
        return result;
      } finally {
        setLoadingGames((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });
      }
    },
    [propsCache, loadingGames, setPropsCache],
  );

  const clearCache = useCallback(() => {
    setPropsCache({});
    localStorage.removeItem(PROPS_CACHE_KEY);
  }, [setPropsCache]);

  return { fetchProps, isLoading, isCached, getCached, clearCache, propsCache };
}
