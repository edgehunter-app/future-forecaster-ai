import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";
import type { GolfAnalysisResult } from "@/components/sports/GolfAnalysisPanel";
import { scanSportsGames } from "@/hooks/useBestBet";

/** Max games analyzed per sport tab to build its Top 5. */
const MAX_ANALYZED = 10;

export interface Top5Entry {
  score: number;
  confidence: number;
  edge: number;
  game: FullGame;
  analysis: GameAnalysisResult;
}

export interface Top5Golf {
  tournament: string;
  confidence: number;
  edge: number;
  picks: Array<{ player: string; odds?: number; book?: string; reason?: string }>;
}

interface CacheShape {
  entries?: Top5Entry[];
  golf?: Top5Golf | null;
  analyzed: number;
  at: string;
}

const inFlight = new Set<string>();

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's games (local date), not started more than 3h ago, soonest first. */
function todaysGames(games: FullGame[], wholeWeek = false): FullGame[] {
  const today = localDateKey();
  const cutoff = Date.now() - 3 * 3600000;
  return games
    .filter((g) => {
      const t = new Date(g.commenceTime);
      return Number.isFinite(t.getTime()) && (wholeWeek || localDateKey(t) === today) && t.getTime() >= cutoff;
    })
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());
}

function readCache(key: string): CacheShape | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

/**
 * Runs only when the user taps Scan; results cached per sport per day. Uses the exact
 * Best Bet Today scoring: confidence*0.6 + edge*100*0.4, x0.6 for heavy
 * favorites (< -350), NO_EDGE dropped.
 */
export function useSportTop5(sportKey: string, games: FullGame[], golfTournamentName?: string) {
  const settings = useAppStore((s) => s.settings);
  const trackedWallets = useAppStore((s) => s.trackedWallets ?? []);
  const isGolf = sportKey === "golf";
  const cacheKey = `eh_top5_${sportKey}_${localDateKey()}`;

  const [data, setData] = useState<CacheShape | null>(() => readCache(cacheKey));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const golfGame = isGolf ? games.find((g) => g.isOutright && (g.players?.length ?? 0) > 0) : undefined;
  const candidates = isGolf ? [] : todaysGames(games, sportKey === "americanfootball_ncaaf").slice(0, MAX_ANALYZED);
  const readyKey = isGolf ? (golfGame ? "g" : "") : candidates.map((g) => g.id ?? `${g.homeTeam}-${g.awayTeam}`).join("|");

  useEffect(() => {
    setData(readCache(cacheKey));
    setError(null);
  }, [cacheKey]);

  const scan = useCallback(() => {
    if (!sportKey || sportKey === "all") return;
    if (!readyKey) return; // nothing to analyze (no games today)
    if (inFlight.has(cacheKey)) return;
    inFlight.add(cacheKey);
    const cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const maxPositionPct = (settings.maxPosition ?? 0.05) * 100;
        let result: CacheShape;
        if (isGolf && golfGame) {
          setProgress({ done: 0, total: 1 });
          const players = (golfGame.players ?? []).slice(0, 30).map((p) => ({
            name: p.name,
            bestOdds: p.bestOdds,
            bestBook: p.bestBook,
            bookOdds: Object.fromEntries(p.lines.map((l) => [l.book, l.odds])),
          }));
          const tournament = golfTournamentName || golfGame.league || golfGame.homeTeam || "Golf Tournament";
          const { data: d, error: e } = await supabase.functions.invoke("analyze-market", {
            body: {
              type: "golf",
              tournamentName: tournament,
              dates: "TBD",
              course: null,
              purse: 0,
              leaderboard: [],
              players,
              bankroll: settings.bankroll,
              kellyMultiplier: settings.kellyMultiplier,
              maxPositionPct,
            },
          });
          if (e) throw e;
          const g = (d ?? {}) as GolfAnalysisResult & { error?: string };
          if (typeof g.error === "string") throw new Error(g.error);
          const picks = (g.topPicks ?? [])
            .filter((p) => p.player)
            .slice(0, 5)
            .map((p) => ({ player: p.player as string, odds: p.odds, book: p.book, reason: p.reason }));
          result = {
            golf: picks.length
              ? { tournament, confidence: Math.round(g.confidence ?? 0), edge: g.edge ?? 0, picks }
              : null,
            analyzed: 1,
            at: new Date().toISOString(),
          };
          setProgress({ done: 1, total: 1 });
        } else {
          setProgress({ done: 0, total: candidates.length });
          const res = await scanSportsGames(
            candidates,
            trackedWallets,
            { bankroll: settings.bankroll, kellyMultiplier: settings.kellyMultiplier, maxPositionPct },
            () => {},
            (n) => !cancelled && setProgress({ done: n, total: candidates.length }),
          );
          const entries = res
            .filter((c) => c.sports)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((c) => ({
              score: c.score,
              confidence: c.confidence,
              edge: c.edge,
              game: c.sports!.game,
              analysis: c.sports!.analysis,
            }));
          result = { entries, analyzed: candidates.length, at: new Date().toISOString() };
        }
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          /* storage full — keep in memory */
        }
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't build Top 5");
      } finally {
        inFlight.delete(cacheKey);
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, readyKey, settings, trackedWallets, golfTournamentName]);


  return {
    entries: data?.entries ?? [],
    golf: data?.golf ?? null,
    analyzed: data?.analyzed ?? 0,
    hasResult: !!data,
    hasGamesToday: isGolf ? !!golfGame : candidates.length > 0,
    loading,
    progress,
    error,
    scan,
    lastScannedAt: data?.at ? new Date(data.at) : null,
  };
}
