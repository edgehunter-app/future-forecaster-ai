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
  game: FullGame;
  bestBook: string;
  timestamp: Date;
  type: "LINE_IMPROVED" | "LINE_MOVED_AGAINST";
  severity: "low" | "medium" | "high";
  message: string;
}

const toImplied = (odds: number) =>
  odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);

function buildAlertMessage(
  opening: number,
  current: number,
  change: number,
  edgeChange: number,
): string {
  const direction = change > 0 ? "improved" : "moved against you";
  const absChange = Math.abs(change);
  const edgePct = (Math.abs(edgeChange) * 100).toFixed(1);
  if (change > 0) {
    return `Line ${direction} ${absChange} cents. You bet at ${opening}, best available is now ${current}. Your edge increased by ${edgePct}%.`;
  }
  return `Line ${direction} ${absChange} cents. You bet at ${opening}, market now at ${current}. Your original edge reduced by ${edgePct}%. ${
    absChange >= 25
      ? "Consider whether this bet still has value."
      : "Still within normal variance."
  }`;
}

function matchSide(game: FullGame, bet: Bet): "home" | "away" | null {
  const pick = (bet.pick ?? "").toLowerCase();
  const title = (bet.title ?? "").toLowerCase();
  const home = (game.homeTeam ?? "").toLowerCase();
  const away = (game.awayTeam ?? "").toLowerCase();
  if (home && (pick.includes(home) || title.includes(home))) return "home";
  if (away && (pick.includes(away) || title.includes(away))) return "away";
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
  const [alerts, setAlerts] = useState<LineAlert[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const checkLines = useCallback(async () => {
    const pendingBets = bets.filter((b) => b.status === "pending");
    if (pendingBets.length === 0 || fullGames.length === 0) return;

    setChecking(true);
    const newAlerts: LineAlert[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      for (const bet of pendingBets) {
        const game = matchGame(fullGames, bet);
        if (!game) continue;
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
            message: buildAlertMessage(openingOdds, currentBestOdds, oddsChange, edgeChange),
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
  }, [bets, fullGames]);

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