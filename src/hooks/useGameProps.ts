import { useCallback, useState } from "react";
import { fetchGameProps, type GameProps } from "@/lib/oddsApi";

const PROPS_CACHE_KEY = "eh_props_cache";
const PROPS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

function loadCache(): Record<string, GameProps> {
  try {
    const raw = localStorage.getItem(PROPS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, GameProps>) {
  try {
    localStorage.setItem(PROPS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function useGameProps() {
  const [loadingGames, setLoadingGames] = useState<Set<string>>(new Set());
  const [propsCache, setPropsCache] = useState<Record<string, GameProps>>(loadCache);

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
          setPropsCache((prev) => {
            const next = { ...prev, [gameId]: result };
            saveCache(next);
            return next;
          });
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
    [propsCache, loadingGames],
  );

  const clearCache = useCallback(() => {
    setPropsCache({});
    localStorage.removeItem(PROPS_CACHE_KEY);
  }, []);

  return { fetchProps, isLoading, isCached, getCached, clearCache, propsCache };
}
