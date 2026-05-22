import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult, BestBetResult } from "@/types";
import { bumpSportsAnalyses } from "@/lib/analysisCounter";


function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function useBestBet() {
  const [loading, setLoading] = useState(false);
  const [scannedSoFar, setScannedSoFar] = useState(0);
  const [result, setResult] = useState<BestBetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fullGames = useAppStore((s) => s.fullGames);
  const settings = useAppStore((s) => s.settings);
  const trackedWallets = useAppStore((s) => s.trackedWallets ?? []);
  const setLastBestBet = useAppStore((s) => s.setLastBestBet);

  const findBestBet = useCallback(async () => {
    if (!fullGames || fullGames.length === 0) {
      setError("No games loaded. Hit Refresh first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setScannedSoFar(0);

    try {
      const todayGames = fullGames.filter((g) => isToday(g.commenceTime));
      const eligible = todayGames.length > 0 ? todayGames : fullGames.slice(0, 10);
      const sortedGames = [...eligible]
        .sort((a, b) => (b.bookmakers?.length ?? 0) - (a.bookmakers?.length ?? 0))
        .slice(0, 8);

      const maxPositionPct = (settings.maxPosition ?? 0.05) * 100;
      let bestResult: GameAnalysisResult | null = null;
      let bestGame: FullGame | null = null;
      let bestScore = 0;

      for (let i = 0; i < sortedGames.length; i++) {
        const game = sortedGames[i];
        try {
          const { data, error: invokeError } = await supabase.functions.invoke("analyze-market", {
            body: {
              type: "sports",
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              league: game.league,
              gameTime: game.commenceTime,
              homeImplied: game.moneyline?.homeImplied ?? 0,
              awayImplied: game.moneyline?.awayImplied ?? 0,
              bestHomeOdds: game.moneyline?.bestHomeOdds ?? game.moneyline?.home ?? 0,
              bestAwayOdds: game.moneyline?.bestAwayOdds ?? game.moneyline?.away ?? 0,
              bestHomeBook: game.moneyline?.bestHomeBook ?? "",
              bestAwayBook: game.moneyline?.bestAwayBook ?? "",
              spread: game.spread?.homeSpread ?? null,
              total: game.total?.line ?? null,
              bookmakers: (game.bookmakers ?? []).map((b) => ({
                name: b.name,
                key: b.key,
                category: b.category,
                regulatoryNote: b.regulatoryNote,
                moneyline: { home: b.homeMoneyline, away: b.awayMoneyline },
                spread: b.homeSpread
                  ? { line: b.homeSpread, homeOdds: b.spreadHomeOdds, awayOdds: b.spreadAwayOdds }
                  : null,
                total: b.totalLine
                  ? { line: b.totalLine, overOdds: b.overOdds, underOdds: b.underOdds }
                  : null,
              })),
              vegasConsensus: game.vegasConsensus ?? null,
              wallets: trackedWallets
                .filter((w) => w.tier === "S" || w.tier === "A")
                .slice(0, 5)
                .map((w) => ({ label: w.label, tier: w.tier, winRate: w.winRate })),
              bankroll: settings.bankroll,
              kellyMultiplier: settings.kellyMultiplier,
              maxPositionPct,
            },
          });

          setScannedSoFar(i + 1);

          if (invokeError || !data) continue;
          if ((data as any)?.code) continue;

          const analysis = data as GameAnalysisResult;
          if (!analysis || typeof analysis.recommendation !== "string") continue;
          if (analysis.recommendation === "NO_EDGE") continue;

          const confidence = Math.max(0, Math.min(100, Math.round(analysis.confidence ?? 0)));
          const edge = analysis.edge ?? 0;
          const score = confidence * 0.6 + edge * 100 * 0.4;

          if (score > bestScore) {
            bestScore = score;
            bestResult = { ...analysis, confidence };
            bestGame = game;
          }

          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.warn("[useBestBet] game failed:", game.homeTeam, err);
          continue;
        }
      }

      if (bestResult && bestGame) {
        const maxPos = settings.bankroll * (settings.maxPosition ?? 0.05);
        bestResult.suggestedAmount = Math.min(
          Math.round(bestResult.suggestedAmount ?? 0),
          Math.round(maxPos),
        );
        bestResult.keyFactors = Array.isArray(bestResult.keyFactors) ? bestResult.keyFactors : [];
        bestResult.warningFlags = Array.isArray(bestResult.warningFlags) ? bestResult.warningFlags : [];
        bumpSportsAnalyses();
        setResult({
          game: bestGame,
          analysis: bestResult,
          scannedCount: sortedGames.length,
          generatedAt: new Date(),
        });
      } else {
        setError("Couldn't find a strong bet today. Try again when more games are available.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [fullGames, settings, trackedWallets]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setScannedSoFar(0);
  }, []);

  return { findBestBet, loading, scannedSoFar, result, error, clear };
}