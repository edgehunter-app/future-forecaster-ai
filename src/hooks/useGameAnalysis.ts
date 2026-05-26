import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { FullGame } from "@/lib/oddsApi";
import type { FullBookmakerLine } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";
import { bumpSportsAnalyses } from "@/lib/analysisCounter";


export interface PolymarketGapInput {
  polyImplied: number;
  gap: number;
}

export interface PredictionMarketInput {
  kalshi?: { name: string; homeMoneyline: number; awayMoneyline: number } | undefined;
  polymarket?: { name: string; homeMoneyline: number; awayMoneyline: number } | undefined;
}

export function useGameAnalysis() {
  const settings = useAppStore((s) => s.settings);
  const trackedWallets = useAppStore((s) => s.trackedWallets ?? []);

  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, GameAnalysisResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const analyzeGame = useCallback(
    async (
      game: FullGame,
      polymarketGap?: PolymarketGapInput | null,
      predictionMarkets?: PredictionMarketInput,
      overrideBookmakers?: FullBookmakerLine[],
    ) => {
      const gameId = game.id;
      if (analyzing[gameId]) return;

      setAnalyzing((prev) => ({ ...prev, [gameId]: true }));
      setErrors((prev) => ({ ...prev, [gameId]: "" }));

      try {
        const maxPositionPct = (settings.maxPosition ?? 0.05) * 100;
        const sourceBookmakers = overrideBookmakers ?? game.bookmakers ?? [];
        const mappedBookmakers = sourceBookmakers.map((b) => ({
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
        }));
        // eslint-disable-next-line no-console
        console.log(
          "[useGameAnalysis] sending bookmakers:",
          mappedBookmakers.length,
          mappedBookmakers.map((b) => `${b.name}(${b.category})`),
        );
        const { data, error } = await supabase.functions.invoke("analyze-market", {
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
            polymarketGap: polymarketGap ?? null,
            // Full bookmaker array so Claude can see line shopping context
            bookmakers: mappedBookmakers,
            vegasConsensus: game.vegasConsensus ?? null,
            kalshi: predictionMarkets?.kalshi
              ? {
                  home: predictionMarkets.kalshi.homeMoneyline,
                  away: predictionMarkets.kalshi.awayMoneyline,
                  vegasHome: game.vegasConsensus?.home ?? null,
                  vegasAway: game.vegasConsensus?.away ?? null,
                }
              : null,
            polymarket: predictionMarkets?.polymarket
              ? {
                  home: predictionMarkets.polymarket.homeMoneyline,
                  away: predictionMarkets.polymarket.awayMoneyline,
                  vegasHome: game.vegasConsensus?.home ?? null,
                  vegasAway: game.vegasConsensus?.away ?? null,
                }
              : null,
            wallets: trackedWallets
              .filter((w) => w.tier === "S" || w.tier === "A")
              .slice(0, 5)
              .map((w) => ({
                label: w.label,
                tier: w.tier,
                winRate: w.winRate,
              })),
            bankroll: settings.bankroll,
            kellyMultiplier: settings.kellyMultiplier,
            maxPositionPct,
          },
        });

        if (error) throw error;

        if (data?.code) {
          const msg =
            data.code === "UPSTREAM_ERROR" && data.upstreamStatus === 529
              ? "Claude is busy — try again in 30 seconds"
              : data.error ?? "Analysis failed";
          throw new Error(msg);
        }

        const result = data as GameAnalysisResult;
        if (!result || typeof result.recommendation !== "string") {
          throw new Error("Analysis returned an invalid result");
        }

        const maxPos = (settings.bankroll * (settings.maxPosition ?? 0.05));
        result.suggestedAmount = Math.min(
          Math.round(result.suggestedAmount ?? 0),
          Math.round(maxPos),
        );
        result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence ?? 0)));
        result.keyFactors = Array.isArray(result.keyFactors) ? result.keyFactors : [];
        result.warningFlags = Array.isArray(result.warningFlags) ? result.warningFlags : [];

        setResults((prev) => ({ ...prev, [gameId]: result }));
        bumpSportsAnalyses();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analysis failed — try again";
        setErrors((prev) => ({ ...prev, [gameId]: msg }));
      } finally {
        setAnalyzing((prev) => ({ ...prev, [gameId]: false }));
      }
    },
    [analyzing, settings, trackedWallets],
  );

  const clearResult = useCallback((gameId: string) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }, []);

  return {
    analyzeGame,
    clearResult,
    isAnalyzing: (id: string) => analyzing[id] ?? false,
    getResult: (id: string): GameAnalysisResult | null => results[id] ?? null,
    getError: (id: string) => errors[id] ?? "",
  };
}