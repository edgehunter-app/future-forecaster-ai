import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_SUGGESTIONS } from "@/data/mockData";
import type { Suggestion, Direction, SuggestionStatus } from "@/types";

function mapSuggestionRow(row: any): Suggestion {
  const expiresHrs = row.expires_at
    ? Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 3600000))
    : 48;
  return {
    id: row.id,
    marketId: row.market_id,
    question: row.question,
    direction: row.direction as Direction,
    currentOdds: Number(row.current_odds ?? 0),
    suggestedAmount: Number(row.suggested_amount ?? 0),
    confidence: row.confidence ?? 0,
    edge: Number(row.edge ?? 0),
    category: row.category,
    reasoning: row.reasoning,
    walletSignals: row.wallet_signals ?? [],
    keySignals: row.key_signals ?? [],
    status: row.status as SuggestionStatus,
    createdAt: new Date(row.created_at).toLocaleString(),
    expiresAt: `${expiresHrs}h`,
  };
}

export function useSuggestionsDB(statuses: string[] = ["active"]) {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(
    isDemoMode ? MOCK_SUGGESTIONS : [],
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setSuggestions(MOCK_SUGGESTIONS);
      setLoading(false);
      return;
    }
    if (!user) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(50);
    setSuggestions(data ? data.map(mapSuggestionRow) : []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, user, statuses.join(",")]);

  const saveSuggestion = async (s: Suggestion) => {
    if (isDemoMode || !user) return;
    await supabase.from("suggestions").insert({
      user_id: user.id,
      market_id: s.marketId,
      question: s.question,
      direction: s.direction,
      current_odds: s.currentOdds,
      suggested_amount: s.suggestedAmount,
      confidence: s.confidence,
      edge: s.edge,
      category: s.category,
      reasoning: s.reasoning,
      wallet_signals: s.walletSignals,
      key_signals: s.keySignals ?? [],
      status: "active",
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    load();
  };

  const dismissSuggestion = async (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    if (isDemoMode || !user) return;
    await supabase.from("suggestions").update({ status: "dismissed" }).eq("id", id);
  };

  const markOutcome = async (id: string, outcome: "won" | "lost") => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: outcome } : s)),
    );
    if (isDemoMode || !user) return;
    await supabase.from("suggestions").update({ status: outcome }).eq("id", id);
  };

  useEffect(() => { load(); }, [load]);

  return { suggestions, loading, saveSuggestion, dismissSuggestion, markOutcome, reload: load };
}