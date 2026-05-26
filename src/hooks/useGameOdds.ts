import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FullGame, FullBookmakerLine } from "@/lib/oddsApi";

function vegasBooksWithOdds(books: FullBookmakerLine[]): FullBookmakerLine[] {
  return books.filter(
    (b) =>
      b.category !== "prediction_market" &&
      (b.homeMoneyline !== 0 || b.awayMoneyline !== 0),
  );
}

/**
 * Lazy per-event odds fetch. If the game already has 2+ Vegas books, we keep
 * what we have. Otherwise we call the `fetch-game-odds` edge function and
 * merge fresh Vegas books with any existing prediction-market lines (Kalshi
 * / Polymarket) so we don't lose them.
 */
export function useGameOdds(game: FullGame) {
  const [bookmakers, setBookmakers] = useState<FullBookmakerLine[]>(
    game.bookmakers ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // When the parent re-fetches the slate (manual Refresh), the game prop may
  // arrive with more bookmakers than what we had cached locally. Sync in that
  // case and reset the lazy-fetch gate so we can try again if still sparse.
  const lastSeenRef = useRef(game.bookmakers);
  useEffect(() => {
    if (game.bookmakers === lastSeenRef.current) return;
    lastSeenRef.current = game.bookmakers;
    const incoming = game.bookmakers ?? [];
    const incomingVegas = vegasBooksWithOdds(incoming).length;
    const currentVegas = vegasBooksWithOdds(bookmakers).length;
    if (incomingVegas > currentVegas) {
      setBookmakers(incoming);
      setFetched(false);
    }
  }, [game.bookmakers, bookmakers]);

  const fetchOdds = useCallback(async () => {
    if (loading || fetched) return;
    if (vegasBooksWithOdds(bookmakers).length >= 2) {
      setFetched(true);
      return;
    }

    setLoading(true);
    try {
      console.log(
        "[useGameOdds] fetching for:",
        game.homeTeam,
        "vs",
        game.awayTeam,
        "eventId:",
        game.id,
      );
      const { data, error } = await supabase.functions.invoke("fetch-game-odds", {
        body: {
          eventId: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          sport: game.sport,
        },
      });

      if (error) {
        console.warn("[useGameOdds] invoke error:", error.message);
      }

      const fetchedBooks: FullBookmakerLine[] = Array.isArray(data?.bookmakers)
        ? data.bookmakers
        : [];
      console.log(
        "[useGameOdds] response:",
        fetchedBooks.length,
        "books",
        data?.source,
      );
      console.log("[useGameOdds] books:", fetchedBooks.map((b) => b.name));

      if (fetchedBooks.length > 0) {
        // Keep existing prediction-market lines (Kalshi / Polymarket / ProphetX)
        // and any books that the per-event call didn't return.
        const fetchedKeys = new Set(fetchedBooks.map((b) => b.key));
        const preserved = bookmakers.filter((b) => !fetchedKeys.has(b.key));
        setBookmakers([...fetchedBooks, ...preserved]);
      }
    } catch (err) {
      console.error("[useGameOdds] failed:", err);
    } finally {
      setFetched(true);
      setLoading(false);
    }
  }, [bookmakers, fetched, loading, game.id, game.homeTeam, game.awayTeam, game.sport]);

  return { bookmakers, loading, fetched, fetchOdds };
}
