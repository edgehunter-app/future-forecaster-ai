import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { FullGame } from "@/lib/oddsApi";
import type {
  GameAnalysisResult,
  BestBetResult,
  PredictionMarketBest,
  WalletSignalBest,
  Market,
  Wallet,
} from "@/types";
import { bumpSportsAnalyses } from "@/lib/analysisCounter";

type ScanStage = "idle" | "sports" | "prediction_markets" | "wallet_signals" | "ranking";

export type BestBetAvailability = "within_12h" | "within_24h" | "none";

interface Candidate {
  source: "sports" | "prediction_market" | "wallet_signal";
  score: number;
  confidence: number;
  edge: number;
  // payloads
  sports?: { game: FullGame; analysis: GameAnalysisResult };
  prediction?: PredictionMarketBest;
  wallet?: WalletSignalBest;
}

function scoreOf(confidence: number, edge: number): number {
  return confidence * 0.6 + edge * 100 * 0.4;
}

export function useBestBet() {
  const [loading, setLoading] = useState(false);
  const [scannedSoFar, setScannedSoFar] = useState(0);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    stage: ScanStage;
  }>({ current: 0, total: 0, stage: "idle" });
  const [result, setResult] = useState<BestBetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fullGames = useAppStore((s) => s.fullGames);
  const settings = useAppStore((s) => s.settings);
  const trackedWallets = useAppStore((s) => s.trackedWallets ?? []);
  const cachedMarkets = useAppStore((s) => s.cachedMarkets ?? []);
  const crossMarketOpps = useAppStore((s) => s.crossMarketOpps ?? []);
  const setLastBestBet = useAppStore((s) => s.setLastBestBet);

  const availability: BestBetAvailability = useMemo(() => {
    const now = Date.now();
    let has12 = false;
    let has24 = false;
    for (const g of fullGames ?? []) {
      const t = new Date(g.commenceTime).getTime();
      if (!Number.isFinite(t)) continue;
      const h = (t - now) / 3600000;
      if (h <= 12 && h >= -0.5) has12 = true;
      else if (h <= 24 && h >= -0.5) has24 = true;
      if (has12) break;
    }
    if (has12) return "within_12h";
    if (has24) return "within_24h";
    return "none";
  }, [fullGames]);

  const findBestBet = useCallback(async () => {
    if (!fullGames || fullGames.length === 0) {
      setError("No games loaded. Hit Refresh first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setScannedSoFar(0);
    setScanProgress({ current: 0, total: 0, stage: "sports" });

    try {
      // Best Bet must be actionable RIGHT NOW. Only consider games starting in
      // the next 12 hours (or up to 30 minutes ago for live value). If nothing
      // qualifies, expand once to 24 hours. Never go beyond 24 hours — a game
      // two days out is not a "bet today".
      const now = Date.now();
      const withinHours = (g: FullGame, maxH: number) => {
        const t = new Date(g.commenceTime).getTime();
        if (!Number.isFinite(t)) return false;
        const h = (t - now) / 3600000;
        return h <= maxH && h >= -0.5;
      };
      let upcomingGames = fullGames.filter((g) => withinHours(g, 12));
      if (upcomingGames.length === 0) {
        upcomingGames = fullGames.filter((g) => withinHours(g, 24));
      }
      if (upcomingGames.length === 0) {
        setError(
          "No games with live odds right now. Check back later today or tonight for the best available bet.",
        );
        setLoading(false);
        return;
      }

      const isWorldCup = (g: FullGame) =>
        (g.sport ?? "").toLowerCase().includes("world_cup") ||
        (g.league ?? "").toLowerCase().includes("world cup");

      // Sort: World Cup first (highest volume event right now), then urgency,
      // then by bookmaker count, then by start time.
      const sortedByUrgency = [...upcomingGames].sort((a, b) => {
        const aWC = isWorldCup(a);
        const bWC = isWorldCup(b);
        if (aWC && !bWC) return -1;
        if (!aWC && bWC) return 1;
        const aTime = new Date(a.commenceTime).getTime();
        const bTime = new Date(b.commenceTime).getTime();
        const aIn4h = aTime < now + 4 * 3600000;
        const bIn4h = bTime < now + 4 * 3600000;
        if (aIn4h && !bIn4h) return -1;
        if (!aIn4h && bIn4h) return 1;
        const bookDiff = (b.bookmakers?.length ?? 0) - (a.bookmakers?.length ?? 0);
        if (bookDiff !== 0) return bookDiff;
        return aTime - bTime;
      });

      const sortedGames = sortedByUrgency.slice(0, 5);

      const maxPositionPct = (settings.maxPosition ?? 0.05) * 100;

      // Build prediction-market and wallet-signal candidate lists (capped).
      const predictionCandidates = pickPredictionMarkets(crossMarketOpps, cachedMarkets).slice(0, 5);
      const walletCandidates = pickWalletSignals(cachedMarkets, trackedWallets).slice(0, 3);

      const sportsTotal = sortedGames.length;
      const predTotal = predictionCandidates.length;
      const walletTotal = walletCandidates.length;
      const grandTotal = sportsTotal + predTotal + walletTotal;

      setScanProgress({ current: 0, total: grandTotal, stage: "sports" });

      if (grandTotal === 0) {
        setError("No upcoming games or markets available right now. Check back later today.");
        setLoading(false);
        return;
      }

      const incProgress = (stage: ScanStage) =>
        setScanProgress((prev) => ({ ...prev, stage, current: prev.current + 1 }));

      // ===== Run all three sources in parallel =====
      const [sportsRes, predictionRes, walletRes] = await Promise.all([
        scanSportsGames(sortedGames, trackedWallets, {
          bankroll: settings.bankroll,
          kellyMultiplier: settings.kellyMultiplier,
          maxPositionPct,
        }, incProgress, setScannedSoFar),
        scanPredictionMarkets(predictionCandidates, settings.bankroll, maxPositionPct, () =>
          incProgress("prediction_markets"),
        ),
        scanWalletSignals(walletCandidates, settings.bankroll, maxPositionPct, () =>
          incProgress("wallet_signals"),
        ),
      ]);

      setScanProgress((prev) => ({ ...prev, stage: "ranking" }));

      const all: Candidate[] = [...sportsRes, ...predictionRes, ...walletRes];
      if (all.length === 0) {
        setError("Couldn't find a strong bet today. Try again when more data is available.");
        return;
      }
      const best = all.reduce((a, b) => (a.score >= b.score ? a : b));

      const maxPos = settings.bankroll * (settings.maxPosition ?? 0.05);
      const generatedAt = new Date();
      let resultObj: BestBetResult;

      if (best.source === "sports" && best.sports) {
        const analysis = best.sports.analysis;
        analysis.suggestedAmount = Math.min(
          Math.round(analysis.suggestedAmount ?? 0),
          Math.round(maxPos),
        );
        analysis.keyFactors = Array.isArray(analysis.keyFactors) ? analysis.keyFactors : [];
        analysis.warningFlags = Array.isArray(analysis.warningFlags) ? analysis.warningFlags : [];
        bumpSportsAnalyses();
        resultObj = {
          source: "sports",
          game: best.sports.game,
          analysis,
          scannedCount: grandTotal,
          generatedAt,
        };
      } else if (best.source === "prediction_market" && best.prediction) {
        const p = best.prediction;
        p.suggestedAmount = Math.min(Math.round(p.suggestedAmount ?? 0), Math.round(maxPos));
        resultObj = {
          source: "prediction_market",
          prediction: p,
          scannedCount: grandTotal,
          generatedAt,
        };
      } else if (best.source === "wallet_signal" && best.wallet) {
        const w = best.wallet;
        w.suggestedAmount = Math.min(Math.round(w.suggestedAmount ?? 0), Math.round(maxPos));
        resultObj = {
          source: "wallet_signal",
          wallet: w,
          scannedCount: grandTotal,
          generatedAt,
        };
      } else {
        setError("Couldn't find a strong bet today.");
        return;
      }

      setResult(resultObj);
      setLastBestBet(resultObj);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setLoading(false);
      setScanProgress((prev) => ({ ...prev, stage: "idle" }));
    }
  }, [fullGames, settings, trackedWallets, cachedMarkets, crossMarketOpps, setLastBestBet]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setScannedSoFar(0);
    setScanProgress({ current: 0, total: 0, stage: "idle" });
    setLastBestBet(null);
  }, [setLastBestBet]);

  return { findBestBet, loading, scannedSoFar, scanProgress, result, error, clear, availability };
}

// ============================================================================
// Sports scan
// ============================================================================

async function scanSportsGames(
  sortedGames: FullGame[],
  trackedWallets: Wallet[],
  cfg: { bankroll: number; kellyMultiplier: number; maxPositionPct: number },
  onTick: (stage: ScanStage) => void,
  setScannedSoFar: (n: number) => void,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i];
    try {
      const vegasOnly = (game.bookmakers ?? []).filter((b) => b.category !== "prediction_market");
      const bestOver = vegasOnly
        .filter((b) => b.totalLine && Number.isFinite(b.overOdds) && b.overOdds !== 0)
        .reduce(
          (a, b) => (b.overOdds > a.odds ? { odds: b.overOdds, book: b.name } : a),
          { odds: -99999, book: "" },
        );
      const bestUnder = vegasOnly
        .filter((b) => b.totalLine && Number.isFinite(b.underOdds) && b.underOdds !== 0)
        .reduce(
          (a, b) => (b.underOdds > a.odds ? { odds: b.underOdds, book: b.name } : a),
          { odds: -99999, book: "" },
        );
        // Best spread odds (juice) across books, plus consensus line.
        const spreadBooks = vegasOnly.filter(
          (b) =>
            Number.isFinite(b.spreadHomeOdds) &&
            b.spreadHomeOdds !== 0 &&
            Number.isFinite(b.spreadAwayOdds) &&
            b.spreadAwayOdds !== 0,
        );
        const bestHomeSpreadObj = spreadBooks.reduce(
          (a, b) => (b.spreadHomeOdds > a.odds ? { odds: b.spreadHomeOdds, book: b.name } : a),
          { odds: -99999, book: "" },
        );
        const bestAwaySpreadObj = spreadBooks.reduce(
          (a, b) => (b.spreadAwayOdds > a.odds ? { odds: b.spreadAwayOdds, book: b.name } : a),
          { odds: -99999, book: "" },
        );
        const consensusSpreadLine = game.spread?.homeSpread ?? null;
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
            spreadLine: consensusSpreadLine,
            bestHomeSpread: bestHomeSpreadObj.book ? bestHomeSpreadObj.odds : null,
            bestHomeSpreadBook: bestHomeSpreadObj.book || null,
            bestAwaySpread: bestAwaySpreadObj.book ? bestAwaySpreadObj.odds : null,
            bestAwaySpreadBook: bestAwaySpreadObj.book || null,
          total: game.total?.line ?? null,
          bestOverOdds: bestOver.book ? bestOver.odds : null,
          bestOverBook: bestOver.book || null,
          bestUnderOdds: bestUnder.book ? bestUnder.odds : null,
          bestUnderBook: bestUnder.book || null,
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
              ? { line: b.totalLine, over: b.overOdds, under: b.underOdds, overOdds: b.overOdds, underOdds: b.underOdds }
              : null,
          })),
          vegasConsensus: game.vegasConsensus ?? null,
          wallets: trackedWallets
            .filter((w) => w.tier === "S" || w.tier === "A")
            .slice(0, 5)
            .map((w) => ({ label: w.label, tier: w.tier, winRate: w.winRate })),
          bankroll: cfg.bankroll,
          kellyMultiplier: cfg.kellyMultiplier,
          maxPositionPct: cfg.maxPositionPct,
        },
      });
      setScannedSoFar(i + 1);
      onTick("sports");
      if (invokeError || !data) continue;
      if ((data as Record<string, unknown>)?.code) continue;
      const analysis = data as GameAnalysisResult;
      if (!analysis || typeof analysis.recommendation !== "string") continue;
      if (analysis.recommendation === "NO_EDGE") continue;
        console.log(
          "[BestBet] Claude returned:",
          analysis.betType,
          analysis.recommendation,
          analysis.spreadLine,
          analysis.odds,
          analysis.bestBook,
        );
      const confidence = Math.max(0, Math.min(100, Math.round(analysis.confidence ?? 0)));
      const edge = analysis.edge ?? 0;
      const isFavoriteHeavy = (analysis.odds ?? 0) < -350;
      const baseScore = scoreOf(confidence, edge);
      const adjustedScore = isFavoriteHeavy ? baseScore * 0.6 : baseScore;
      out.push({
        source: "sports",
        score: adjustedScore,
        confidence,
        edge,
        sports: { game, analysis: { ...analysis, confidence } },
      });

      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.warn("[useBestBet] sports game failed:", game.homeTeam, err);
    }
  }
  return out;
}

// ============================================================================
// Prediction-market scan (cross-market gaps Polymarket vs Kalshi)
// ============================================================================

interface PMCandidate {
  market: Market;
  polyPriceCents: number;
  kalshiPriceCents: number;
  gapCents: number;
  bestPlatform: "Polymarket" | "Kalshi";
  bestPriceCents: number;
  volume: number;
  closesAt: string;
}

function pickPredictionMarkets(
  crossMarketOpps: { question: string; polymarket: Market; kalshi: Market; polyYes: number; kalshiYes: number; spread: number; favoredPlatform: "polymarket" | "kalshi" }[],
  _cachedMarkets: Market[],
): PMCandidate[] {
  const nowMs = Date.now();
  const horizonMs = nowMs + 24 * 3600 * 1000;
  const items: PMCandidate[] = [];

  for (const opp of crossMarketOpps) {
    const poly = opp.polymarket;
    const kal = opp.kalshi;
    if (!poly || !kal) continue;
    const vol = Math.max(poly.volume24h ?? 0, kal.volume24h ?? 0);
    if (vol < 10_000) continue;
    const endTs = new Date(poly.endDate || kal.endDate || "").getTime();
    const isSports = (poly.category || kal.category || "").toLowerCase().includes("sport");
    const closesSoon = Number.isFinite(endTs)
      ? endTs <= horizonMs
      : false;
    if (!closesSoon && !isSports) continue;

    const polyCents = Math.round(opp.polyYes * 100);
    const kalshiCents = Math.round(opp.kalshiYes * 100);
    const gapCents = Math.abs(polyCents - kalshiCents);
    const bestPlatform: "Polymarket" | "Kalshi" =
      polyCents <= kalshiCents ? "Polymarket" : "Kalshi";
    const bestPriceCents = Math.min(polyCents, kalshiCents);

    items.push({
      market: poly,
      polyPriceCents: polyCents,
      kalshiPriceCents: kalshiCents,
      gapCents,
      bestPlatform,
      bestPriceCents,
      volume: vol,
      closesAt: poly.endDate || kal.endDate || "",
    });
  }

  return items.sort((a, b) => b.gapCents - a.gapCents);
}

async function scanPredictionMarkets(
  candidates: PMCandidate[],
  bankroll: number,
  maxPositionPct: number,
  onTick: () => void,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of candidates) {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("analyze-market", {
        body: {
          type: "cross-market",
          question: c.market.question,
          platform1: "Polymarket",
          platform2: "Kalshi",
          platform1Yes: c.polyPriceCents / 100,
          platform2Yes: c.kalshiPriceCents / 100,
          spread: c.gapCents / 100,
          favoredPlatform: c.bestPlatform.toLowerCase(),
          polymarketPrice: c.polyPriceCents,
          kalshiPrice: c.kalshiPriceCents,
          volume: c.volume,
          closesAt: c.closesAt,
          category: c.market.category,
          bankroll,
          maxPositionPct,
        },
      });
      onTick();
      if (invokeError || !data) continue;
      const d = data as Record<string, unknown>;
      if (d.code) continue;
      const confidence = Math.max(0, Math.min(100, Math.round(Number(d.confidence ?? 0))));
      const edge = Number(d.edge ?? 0);
      if (!confidence) continue;
      const favoredSide: "YES" | "NO" =
        (d.favoredSide === "NO" ? "NO" : "YES") as "YES" | "NO";
      const suggestedAmount = Math.round(Number(d.suggestedAmount ?? 0));
      const reasoning = String(d.reasoning ?? "");
      const keyFactors = Array.isArray(d.keySignals) ? (d.keySignals as string[]) : [];
      const riskLevel = (d.riskLevel as "low" | "medium" | "high") ?? "medium";
      const prediction: PredictionMarketBest = {
        market: c.market,
        polyPriceCents: c.polyPriceCents,
        kalshiPriceCents: c.kalshiPriceCents,
        gapCents: c.gapCents,
        bestPlatform: c.bestPlatform,
        bestPriceCents: c.bestPriceCents,
        favoredSide,
        confidence,
        edge,
        suggestedAmount,
        reasoning,
        keyFactors,
        riskLevel,
      };
      out.push({
        source: "prediction_market",
        score: scoreOf(confidence, edge),
        confidence,
        edge,
        prediction,
      });
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.warn("[useBestBet] cross-market failed:", c.market.question, err);
    }
  }
  return out;
}

// ============================================================================
// Wallet signal scan
// ============================================================================

interface WalletPositionLite {
  marketId: string;
  side: "YES" | "NO";
  value: number;
}
interface WalletWithPositions extends Wallet {
  positions?: WalletPositionLite[];
}

interface WSCandidate {
  market: Market;
  bullishWallets: WalletWithPositions[];
  totalValue: number;
}

function pickWalletSignals(
  cachedMarkets: Market[],
  trackedWallets: Wallet[],
): WSCandidate[] {
  const elite = (trackedWallets as WalletWithPositions[]).filter(
    (w) => (w.tier === "S" || w.tier === "A") && Array.isArray(w.positions),
  );
  if (elite.length === 0) return [];
  const polymarkets = cachedMarkets.filter(
    (m) => m.source === "polymarket" || m.source === "both",
  );
  const out: WSCandidate[] = [];
  for (const market of polymarkets) {
    const bullish = elite.filter((w) =>
      w.positions?.some(
        (p) => p.marketId === market.id && p.side === "YES" && p.value > 100,
      ),
    );
    if (bullish.length >= 3) {
      const totalValue = bullish.reduce((sum, w) => {
        const pos = w.positions?.find((p) => p.marketId === market.id);
        return sum + (pos?.value ?? 0);
      }, 0);
      out.push({ market, bullishWallets: bullish, totalValue });
    }
  }
  return out.sort((a, b) => b.bullishWallets.length - a.bullishWallets.length);
}

async function scanWalletSignals(
  candidates: WSCandidate[],
  bankroll: number,
  maxPositionPct: number,
  onTick: () => void,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of candidates) {
    const topWallets = c.bullishWallets.slice(0, 3).map((w) => {
      const pos = w.positions?.find((p) => p.marketId === c.market.id);
      return {
        label: w.label,
        tier: w.tier,
        winRate: w.winRate,
        positionValue: pos?.value ?? 0,
      };
    });
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("analyze-market", {
        body: {
          type: "wallet-strategy",
          question: c.market.question,
          currentPrice: c.market.yesPrice,
          walletCount: c.bullishWallets.length,
          totalValue: c.totalValue,
          topWallets,
          // also send fields the wallet-strategy prompt expects
          address: topWallets[0]?.label ?? "",
          label: topWallets[0]?.label ?? "",
          tier: topWallets[0]?.tier ?? "A",
          winRate: topWallets[0]?.winRate ?? 0,
          sharpe: 0,
          roi30d: 0,
          totalVolume: c.totalValue,
          recentTrades: c.bullishWallets.length,
          consistency: 0,
          positions: [],
          activity: [],
          bankroll,
          maxPositionPct,
        },
      });
      onTick();
      if (invokeError || !data) continue;
      const d = data as Record<string, unknown>;
      if (d.code) continue;
      // wallet-strategy returns strengthScore (0-100); reuse as confidence proxy.
      const confidence = Math.max(
        0,
        Math.min(100, Math.round(Number(d.strengthScore ?? d.confidence ?? 0))),
      );
      // Estimate edge from wallet conviction (no explicit edge in prompt).
      const followRec = String(d.followRecommendation ?? "");
      const edge =
        followRec === "YES" ? 0.06 : followRec === "PARTIAL" ? 0.03 : 0.01;
      const reasoning = String(d.strategyDescription ?? d.currentPositionsTake ?? "");
      const keyFactors = Array.isArray(d.keyInsights) ? (d.keyInsights as string[]) : [];
      const riskLevel = (d.riskProfile as "low" | "medium" | "high") ?? "medium";
      const suggested = Math.round(bankroll * (maxPositionPct / 100) * 0.6);
      const wallet: WalletSignalBest = {
        market: c.market,
        walletCount: c.bullishWallets.length,
        totalValue: c.totalValue,
        topWallets,
        favoredSide: "YES",
        confidence,
        edge,
        suggestedAmount: suggested,
        reasoning,
        keyFactors,
        riskLevel,
      };
      out.push({
        source: "wallet_signal",
        score: scoreOf(confidence, edge),
        confidence,
        edge,
        wallet,
      });
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.warn("[useBestBet] wallet signal failed:", c.market.question, err);
    }
  }
  return out;
}