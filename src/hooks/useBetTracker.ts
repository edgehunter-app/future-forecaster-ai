import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/store/useAppStore";
import type { Bet, BetStatus } from "@/types";
import { resolveProfitLoss } from "@/lib/betMath";
import { useIsDemo } from "@/hooks/useIsDemo";
import { getDemoBets } from "@/lib/demoData";
import { openDemoGate } from "@/lib/demoGate";

export interface BetStats {
  total: number;
  pending: number;
  won: number;
  lost: number;
  push: number;
  void: number;
  resolved: number;
  winRate: number;
  totalWagered: number;
  totalPL: number;
  roi: number;
  streak: number;
  streakType: BetStatus | "";
  longestWinStreak: number;
  bankrollHistory: Array<{ date: string; value: number; bet: string }>;
  bySport: Array<{ key: string; bets: number; won: number; lost: number; winRate: number; pl: number; roi: number }>;
  bySportsbook: Array<{ key: string; bets: number; winRate: number; pl: number }>;
}

export type NewBetInput = Omit<
  Bet,
  "id" | "user_id" | "created_at" | "updated_at" | "resolved_at" | "profit_loss" | "status"
> & { status?: BetStatus; profit_loss?: number };

export function useBetTracker() {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const bankroll = useAppStore((s) => s.settings.bankroll);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setBets([]);
      setLoading(false);
      return;
    }
    if (isDemo) {
      setBets(getDemoBets(user.id));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.warn("load bets failed", error);
    setBets((data as Bet[]) ?? []);
    setLoading(false);
  }, [user, isDemo]);

  useEffect(() => { void load(); }, [load]);

  const logBet = useCallback(
    async (input: NewBetInput) => {
      if (!user) return null;
      if (isDemo) {
        openDemoGate("Log a bet to track it in your personal Tracker.");
        return null;
      }
      const row = {
        user_id: user.id,
        title: input.title,
        sport: input.sport,
        bet_type: input.bet_type,
        pick: input.pick,
        odds: input.odds,
        amount: input.amount,
        sportsbook: input.sportsbook ?? "Other",
        suggestion_id: input.suggestion_id ?? null,
        status: input.status ?? "pending",
        profit_loss: input.profit_loss ?? 0,
        game_date: input.game_date ?? null,
        notes: input.notes ?? null,
        opening_odds: input.odds,
        current_odds: input.odds,
      };
      const { data, error } = await supabase.from("bets").insert(row).select().single();
      if (error) {
        console.error("logBet failed", error);
        return null;
      }
      setBets((prev) => [data as Bet, ...prev]);
      return data as Bet;
    },
    [user, isDemo],
  );

  const resolveBet = useCallback(
    async (id: string, status: BetStatus) => {
      if (!user) return;
      if (isDemo) { openDemoGate("Resolve bets in your personal Tracker."); return; }
      const bet = bets.find((b) => b.id === id);
      if (!bet) return;
      const pl = resolveProfitLoss(status, bet.odds, Number(bet.amount));
      const { data, error } = await supabase
        .from("bets")
        .update({
          status,
          profit_loss: pl,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) {
        console.error("resolveBet failed", error);
        return;
      }
      setBets((prev) => prev.map((b) => (b.id === id ? (data as Bet) : b)));
    },
    [bets, user, isDemo],
  );

  const deleteBet = useCallback(
    async (id: string) => {
      if (!user) return;
      if (isDemo) { openDemoGate("Manage your bets with a free account."); return; }
      await supabase.from("bets").delete().eq("id", id).eq("user_id", user.id);
      setBets((prev) => prev.filter((b) => b.id !== id));
    },
    [user, isDemo],
  );

  const stats = useMemo<BetStats>(() => {
    const resolved = bets.filter((b) => b.status !== "pending" && b.status !== "void");
    const won = resolved.filter((b) => b.status === "won");
    const lost = resolved.filter((b) => b.status === "lost");
    const push = resolved.filter((b) => b.status === "push");
    const voided = bets.filter((b) => b.status === "void");
    const pending = bets.filter((b) => b.status === "pending");

    const totalWagered = bets
      .filter((b) => b.status !== "void")
      .reduce((s, b) => s + Number(b.amount), 0);
    const totalPL = resolved.reduce((s, b) => s + Number(b.profit_loss ?? 0), 0);
    const roi = totalWagered > 0 ? (totalPL / totalWagered) * 100 : 0;
    const winRate =
      won.length + lost.length > 0
        ? (won.length / (won.length + lost.length)) * 100
        : 0;

    // Streak — walk resolved bets from most-recent backward
    const chronoDesc = [...resolved].sort((a, b) => {
      const at = new Date(a.resolved_at ?? a.created_at).getTime();
      const bt = new Date(b.resolved_at ?? b.created_at).getTime();
      return bt - at;
    });
    let streak = 0;
    let streakType: BetStatus | "" = "";
    for (const b of chronoDesc) {
      if (b.status !== "won" && b.status !== "lost") break;
      if (streak === 0) { streakType = b.status; streak = 1; continue; }
      if (b.status === streakType) streak++;
      else break;
    }

    // Longest win streak
    const chronoAsc = [...resolved].sort((a, b) => {
      const at = new Date(a.resolved_at ?? a.created_at).getTime();
      const bt = new Date(b.resolved_at ?? b.created_at).getTime();
      return at - bt;
    });
    let longestWinStreak = 0;
    let current = 0;
    for (const b of chronoAsc) {
      if (b.status === "won") { current++; longestWinStreak = Math.max(longestWinStreak, current); }
      else current = 0;
    }

    // Bankroll line
    let running = bankroll || 0;
    const bankrollHistory = [
      { date: chronoAsc[0]?.created_at ?? new Date().toISOString(), value: running, bet: "Starting bankroll" },
      ...chronoAsc.map((b) => {
        running += Number(b.profit_loss ?? 0);
        return {
          date: b.resolved_at ?? b.created_at,
          value: running,
          bet: b.title,
        };
      }),
    ];

    // Group helpers
    const groupBy = (key: keyof Bet) => {
      const map = new Map<string, Bet[]>();
      for (const b of bets) {
        const k = (b[key] as string) || "Unknown";
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(b);
      }
      return map;
    };

    const bySport = [...groupBy("sport").entries()].map(([key, list]) => {
      const r = list.filter((b) => b.status === "won" || b.status === "lost");
      const w = r.filter((b) => b.status === "won").length;
      const l = r.filter((b) => b.status === "lost").length;
      const wagered = list.filter((b) => b.status !== "void").reduce((s, b) => s + Number(b.amount), 0);
      const pl = list.reduce((s, b) => s + Number(b.profit_loss ?? 0), 0);
      return {
        key, bets: list.length, won: w, lost: l,
        winRate: r.length ? (w / r.length) * 100 : 0,
        pl, roi: wagered > 0 ? (pl / wagered) * 100 : 0,
      };
    }).sort((a, b) => b.bets - a.bets);

    const bySportsbook = [...groupBy("sportsbook" as keyof Bet).entries()].map(([key, list]) => {
      const r = list.filter((b) => b.status === "won" || b.status === "lost");
      const w = r.filter((b) => b.status === "won").length;
      const pl = list.reduce((s, b) => s + Number(b.profit_loss ?? 0), 0);
      return {
        key, bets: list.length,
        winRate: r.length ? (w / r.length) * 100 : 0,
        pl,
      };
    }).sort((a, b) => b.bets - a.bets);

    return {
      total: bets.length,
      pending: pending.length,
      won: won.length,
      lost: lost.length,
      push: push.length,
      void: voided.length,
      resolved: resolved.length,
      winRate,
      totalWagered,
      totalPL,
      roi,
      streak,
      streakType,
      longestWinStreak,
      bankrollHistory,
      bySport,
      bySportsbook,
    };
  }, [bets, bankroll]);

  return { bets, loading, stats, logBet, resolveBet, deleteBet, reload: load };
}