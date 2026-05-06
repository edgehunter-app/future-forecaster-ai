import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";

export interface HistoryEntry {
  id: string;
  question: string;
  direction: "YES" | "NO";
  category: string;
  confidence: number;
  edge: number;
  suggestedAmount: number;
  entryOdds: number;
  pnl?: number;
  status: "active" | "won" | "lost" | "dismissed" | "expired";
  source: "polymarket" | "kalshi" | "cross-market" | "sports";
  createdAt: string;
  resolvedAt?: string;
  marketId: string;
}

export interface HistoryStats {
  totalTrades: number;
  wins: number;
  losses: number;
  activeTrades: number;
  winRate: number;
  totalPnL: number;
  avgEdge: number;
  sharpe: number;
  maxWin: number;
  maxLoss: number;
  avgTradeSize: number;
  byCategory: Record<string, { trades: number; pnl: number }>;
  byMonth: { month: string; pnl: number; trades: number }[];
  streak: { current: number; type: "win" | "loss" | "none" };
}

function calculateStats(entries: HistoryEntry[]): HistoryStats {
  const resolved = entries.filter((e) => e.status === "won" || e.status === "lost");
  const wins = resolved.filter((e) => e.status === "won");
  const losses = resolved.filter((e) => e.status === "lost");
  const active = entries.filter((e) => e.status === "active");

  const totalPnL = resolved.reduce((s, e) => s + (e.pnl ?? 0), 0);
  const avgEdge = entries.length ? entries.reduce((s, e) => s + (e.edge ?? 0), 0) / entries.length : 0;

  const pnls = resolved.map((e) => e.pnl ?? 0);
  const avgPnL = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length
    ? pnls.reduce((s, p) => s + Math.pow(p - avgPnL, 2), 0) / pnls.length
    : 0;
  const sharpe = variance > 0 ? avgPnL / Math.sqrt(variance) : 0;

  const byCategory: Record<string, { trades: number; pnl: number }> = {};
  for (const e of resolved) {
    const cat = e.category || "General";
    byCategory[cat] ??= { trades: 0, pnl: 0 };
    byCategory[cat].trades++;
    byCategory[cat].pnl += e.pnl ?? 0;
  }

  const byMonthMap: Record<string, { pnl: number; trades: number }> = {};
  for (const e of resolved) {
    const month = new Date(e.resolvedAt ?? e.createdAt).toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
    byMonthMap[month] ??= { pnl: 0, trades: 0 };
    byMonthMap[month].pnl += e.pnl ?? 0;
    byMonthMap[month].trades++;
  }
  const byMonth = Object.entries(byMonthMap).map(([month, data]) => ({ month, ...data }));

  let streak = { current: 0, type: "none" as "win" | "loss" | "none" };
  const sorted = [...resolved].sort(
    (a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime(),
  );
  if (sorted.length > 0) {
    const latest = sorted[0].status as "won" | "lost";
    streak.type = latest === "won" ? "win" : "loss";
    for (const e of sorted) {
      if (e.status === sorted[0].status) streak.current++;
      else break;
    }
  }

  return {
    totalTrades: resolved.length,
    wins: wins.length,
    losses: losses.length,
    activeTrades: active.length,
    winRate: resolved.length > 0 ? wins.length / resolved.length : 0,
    totalPnL,
    avgEdge,
    sharpe,
    maxWin: wins.length ? Math.max(...wins.map((e) => e.pnl ?? 0)) : 0,
    maxLoss: losses.length ? Math.min(...losses.map((e) => e.pnl ?? 0)) : 0,
    avgTradeSize: entries.length ? entries.reduce((s, e) => s + e.suggestedAmount, 0) / entries.length : 0,
    byCategory,
    byMonth,
    streak,
  };
}

export function useHistory() {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isDemoMode || !user) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: dbError } = await supabase
        .from("suggestions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (dbError) throw dbError;
      const mapped: HistoryEntry[] = (data ?? []).map((row: any) => ({
        id: row.id,
        question: row.question,
        direction: row.direction,
        category: row.category ?? "General",
        confidence: row.confidence ?? 0,
        edge: Number(row.edge ?? 0),
        suggestedAmount: Number(row.suggested_amount ?? 0),
        entryOdds: Number(row.current_odds ?? 0),
        pnl: row.pnl != null ? Number(row.pnl) : undefined,
        status: row.status,
        source: (row.source ?? "polymarket") as HistoryEntry["source"],
        createdAt: row.created_at,
        resolvedAt: row.resolved_at ?? undefined,
        marketId: row.market_id,
      }));
      setEntries(mapped);
    } catch (err) {
      console.error("History load failed:", err);
      setError("Could not load history. Try again.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode]);

  const markOutcome = useCallback(
    async (id: string, outcome: "won" | "lost", pnl?: number) => {
      if (!user) return;
      await supabase
        .from("suggestions")
        .update({
          status: outcome,
          pnl: pnl ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      load();
    },
    [user, load],
  );

  useEffect(() => {
    load();
  }, [load]);

  const stats = calculateStats(entries);

  return { entries, stats, loading, error, markOutcome, reload: load };
}