import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useBetTracker } from "@/hooks/useBetTracker";
import type { Bet } from "@/types";
import type { FullGame } from "@/lib/oddsApi";

export interface LineAlert {
  betId: string;
  betTitle: string;
  pick: string;
  openingOdds: number;
  currentOdds: number;
  oddsChange: number;
  edgeChange: number;
  game: FullGame | null;
  bestBook: string;
  timestamp: Date;
  type:
    | "LINE_IMPROVED"
    | "LINE_MOVED_AGAINST"
    | "PREDICTION_MARKET"
    | "NO_GAME_MATCH";
  severity: "low" | "medium" | "high";
  message: string;
  sportsbook?: string;
  loggedAt?: string;
  marketVolume?: number;
  openingImplied?: number;
  currentImplied?: number;
}

const toImplied = (odds: number) =>
  odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);

const impliedToAmerican = (p: number): number => {
  if (p <= 0 || p >= 1) return 0;
  return p >= 0.5
    ? -Math.round((p / (1 - p)) * 100)
    : Math.round(((1 - p) / p) * 100);
};

function buildAlertMessage(
  bet: Bet,
  opening: number,
  current: number,
  change: number,
  edgeChange: number,
  bestBook: string,
): string {
  const absChange = Math.abs(change);
  const openEdgePct = ((1 - toImplied(opening)) * 100).toFixed(1);
  const curEdgePct = ((1 - toImplied(current)) * 100).toFixed(1);
  const pick = bet.pick || bet.title;
  if (change > 0) {
    return (
      `You bet ${pick} at ${fmt(opening)} · ` +
      `Current best: ${fmt(current)}${bestBook ? ` at ${bestBook}` : ""}. ` +
      `Line improved ${absChange} cents in your favor. ` +
      `Edge: +${openEdgePct}% → +${curEdgePct}%.`
    );
  }
  return (
    `You bet ${pick} at ${fmt(opening)} · ` +
    `Line moved to ${fmt(current)}${bestBook ? ` at ${bestBook}` : ""}. ` +
    `Moved ${absChange} cents against you. ` +
    `Edge: +${openEdgePct}% → +${curEdgePct}%. ` +
    (absChange >= 25
      ? "Consider whether the original thesis still holds."
      : "Still within normal variance.")
  );
}

function fmt(o: number): string {
  return `${o > 0 ? "+" : ""}${o}`;
}

function buildPredictionAlertMessage(
  bet: Bet,
  loggedImplied: number,
  currentPrice: number,
  centsChange: number,
  marketVolume: number,
): string {
  const loggedPct = Math.round(loggedImplied * 100);
  const currentPct = Math.round(currentPrice * 100);
  const direction = centsChange >= 0 ? "moved in your favor" : "moved against you";
  const absChange = Math.abs(centsChange);
  const volStr =
    marketVolume > 0
      ? ` Market volume: $${
          marketVolume >= 1_000_000
            ? (marketVolume / 1_000_000).toFixed(1) + "M"
            : (marketVolume / 1000).toFixed(0) + "k"
        }.`
      : "";
  return (
    `${bet.pick} on ${bet.title}: ` +
    `You bought at ${loggedPct}¢. ` +
    `Currently trading at ${currentPct}¢ — ${direction} by ${absChange} cents.${volStr}`
  );
}

function matchSide(game: FullGame, bet: Bet): "home" | "away" | null {
  const pick = (bet.pick ?? "").toLowerCase();
  const title = (bet.title ?? "").toLowerCase();
  const teams = [
    game.homeTeam?.toLowerCase() ?? "",
    game.awayTeam?.toLowerCase() ?? "",
    game.homeTeamShort?.toLowerCase() ?? "",
    game.awayTeamShort?.toLowerCase() ?? "",
  ];
  const betTokens = [pick, title].filter(Boolean);

  for (const team of teams) {
    if (!team) continue;
    for (const token of betTokens) {
      if (!token) continue;
      if (
        team.includes(token) ||
        token.includes(team) ||
        team.split(" ").pop() === token.split(" ").pop() ||
        team.split(" ")[0] === token.split(" ")[0]
      ) {
        if (
          team === (game.homeTeam?.toLowerCase() ?? "") ||
          team === (game.homeTeamShort?.toLowerCase() ?? "")
        ) {
          return "home";
        }
        return "away";
      }
    }
  }
  return null;
}

function matchGame(games: FullGame[], bet: Bet): FullGame | null {
  for (const g of games) {
    if (matchSide(g, bet)) return g;
  }
  return null;
}

export function useLineMonitor() {
  const { bets } = useBetTracker();
  const fullGames = useAppStore((s) => s.fullGames);
  const markets = useAppStore((s) => s.markets);
  const [alerts, setAlerts] = useState<LineAlert[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const checkLines = useCallback(async () => {
    const pendingBets = bets.filter(
      (b) =>
        b.status === "pending" &&
        b.sportsbook !== "Polymarket" &&
        b.sportsbook !== "Kalshi",
    );
    const predictionBets = bets.filter(
      (b) =>
        b.status === "pending" &&
        (b.sportsbook === "Polymarket" || b.sportsbook === "Kalshi"),
    );

    const hasWork = pendingBets.length > 0 || predictionBets.length > 0;
    const needsGames = pendingBets.length > 0;
    if (!hasWork || (needsGames && fullGames.length === 0)) return;

    setChecking(true);
    const newAlerts: LineAlert[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      for (const bet of predictionBets) {
        if (dismissedRef.current.has(bet.id)) continue;

        const betTitle = (bet.title ?? "").toLowerCase();
        const matchingMarket = markets.find((m) => {
          const question = (m.question ?? "").toLowerCase();
          if (!question || !betTitle) return false;
          if (question.includes(betTitle) || betTitle.includes(question)) return true;
          const qHead = question.split(" ").slice(0, 3).join(" ");
          return qHead.length > 4 && betTitle.includes(qHead);
        });

        if (matchingMarket) {
          const isYes = (bet.pick ?? "").toLowerCase().includes("yes");
          const currentPrice = isYes ? matchingMarket.yesPrice : matchingMarket.noPrice;
          const loggedOdds = bet.opening_odds ?? bet.odds ?? 0;
          const loggedImplied = toImplied(loggedOdds);
          const priceChange = currentPrice - loggedImplied;
          const centsChange = Math.round(priceChange * 100);
          const currentOddsAm = impliedToAmerican(currentPrice);

          newAlerts.push({
            betId: bet.id,
            betTitle: bet.title,
            pick: bet.pick,
            openingOdds: loggedOdds,
            currentOdds: currentOddsAm,
            oddsChange: centsChange,
            edgeChange: priceChange,
            game: null,
            bestBook: bet.sportsbook ?? "",
            timestamp: new Date(),
            type: centsChange >= 0 ? "LINE_IMPROVED" : "LINE_MOVED_AGAINST",
            severity: Math.abs(centsChange) >= 10 ? "high" : "low",
            message: buildPredictionAlertMessage(
              bet,
              loggedImplied,
              currentPrice,
              centsChange,
              matchingMarket.totalVolume ?? matchingMarket.volume24h ?? 0,
            ),
            sportsbook: bet.sportsbook ?? undefined,
            loggedAt: bet.created_at,
            marketVolume: matchingMarket.totalVolume ?? matchingMarket.volume24h ?? 0,
            openingImplied: loggedImplied,
            currentImplied: currentPrice,
          });
        } else {
          newAlerts.push({
            betId: bet.id,
            betTitle: bet.title,
            pick: bet.pick,
            openingOdds: bet.odds,
            currentOdds: bet.odds,
            oddsChange: 0,
            edgeChange: 0,
            game: null,
            bestBook: bet.sportsbook ?? "",
            timestamp: new Date(),
            type: "PREDICTION_MARKET",
            severity: "low",
            message: `Check ${bet.sportsbook ?? "your prediction market"} directly for the current ${bet.pick} price.`,
            sportsbook: bet.sportsbook ?? undefined,
            loggedAt: bet.created_at,
          });
        }
      }

      for (const bet of pendingBets) {
        const game = matchGame(fullGames, bet);
        if (!game) {
          if (dismissedRef.current.has(bet.id)) continue;
          newAlerts.push({
            betId: bet.id,
            betTitle: bet.title,
            pick: bet.pick,
            openingOdds: bet.opening_odds ?? bet.odds,
            currentOdds: bet.opening_odds ?? bet.odds,
            oddsChange: 0,
            edgeChange: 0,
            game: null,
            bestBook: bet.sportsbook ?? "",
            timestamp: new Date(),
            type: "NO_GAME_MATCH",
            severity: "low",
            message:
              "Game may have started or completed. Check your sportsbook for live cash out options.",
            sportsbook: bet.sportsbook ?? undefined,
            loggedAt: bet.created_at,
          });
          continue;
        }
        const side = matchSide(game, bet);
        if (!side) continue;

        let currentBestOdds = -9999;
        let bestBook = "";
        for (const b of game.bookmakers ?? []) {
          const o = side === "home" ? b.homeMoneyline : b.awayMoneyline;
          if (typeof o === "number" && o > currentBestOdds) {
            currentBestOdds = o;
            bestBook = b.name ?? b.key ?? "";
          }
        }
        if (currentBestOdds === -9999) continue;

        const openingOdds = bet.opening_odds ?? bet.odds;
        const oddsChange = currentBestOdds - openingOdds;
        const edgeChange = toImplied(openingOdds) - toImplied(currentBestOdds);

        console.log(
          `[LineMonitor] ${bet.title}: opening ${openingOdds} current ${currentBestOdds} change ${
            oddsChange > 0 ? "+" : ""
          }${oddsChange}`,
        );

        if (Math.abs(oddsChange) >= 10 && !dismissedRef.current.has(bet.id)) {
          const absChange = Math.abs(oddsChange);
          newAlerts.push({
            betId: bet.id,
            betTitle: bet.title,
            pick: bet.pick,
            openingOdds,
            currentOdds: currentBestOdds,
            oddsChange,
            edgeChange,
            game,
            bestBook,
            timestamp: new Date(),
            type: oddsChange > 0 ? "LINE_IMPROVED" : "LINE_MOVED_AGAINST",
            severity: absChange >= 30 ? "high" : absChange >= 20 ? "medium" : "low",
            message: buildAlertMessage(bet, openingOdds, currentBestOdds, oddsChange, edgeChange, bestBook),
            sportsbook: bet.sportsbook ?? undefined,
            loggedAt: bet.created_at,
            openingImplied: toImplied(openingOdds),
            currentImplied: toImplied(currentBestOdds),
          });
        }

        if (userId) {
          await supabase
            .from("bets")
            .update({
              current_odds: currentBestOdds,
              last_line_check: new Date().toISOString(),
            })
            .eq("id", bet.id)
            .eq("user_id", userId);
        }
      }

      if (newAlerts.length > 0) {
        setAlerts((prev) => {
          const byId = new Map<string, LineAlert>();
          for (const a of [...newAlerts, ...prev]) byId.set(a.betId, a);
          return Array.from(byId.values()).slice(0, 10);
        });
      }
      setLastCheck(new Date());
    } finally {
      setChecking(false);
    }
  }, [bets, fullGames, markets]);

  useEffect(() => {
    if (fullGames.length > 0 && bets.length > 0) {
      void checkLines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGames.length]);

  const dismissAlert = useCallback((betId: string) => {
    dismissedRef.current.add(betId);
    setAlerts((prev) => prev.filter((a) => a.betId !== betId));
  }, []);

  return { alerts, checkLines, dismissAlert, checking, lastCheck };
}
