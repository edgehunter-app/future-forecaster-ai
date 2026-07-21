import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";
import { useSubscription } from "./useSubscription";
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
    origin: (row.origin as "manual" | "wallet_auto") ?? "manual",
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const MONTH_RE = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*";
const DATE_PATTERNS = [
  new RegExp(`through\\s+(${MONTH_RE}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)`, "i"),
  new RegExp(`by\\s+(${MONTH_RE}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)`, "i"),
  new RegExp(`until\\s+(${MONTH_RE}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)`, "i"),
  new RegExp(`before\\s+(${MONTH_RE}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)`, "i"),
  new RegExp(`on\\s+(${MONTH_RE}\\s+\\d{1,2}(?:,?\\s+\\d{4})?)`, "i"),
];

export function extractExpiryFromQuestion(question: string): Date | null {
  if (!question) return null;
  for (const pattern of DATE_PATTERNS) {
    const match = question.match(pattern);
    if (match) {
      const dateStr = match[1];
      const withYear = /\b20\d{2}\b/.test(dateStr)
        ? dateStr
        : `${dateStr} ${new Date().getFullYear()}`;
      const parsed = new Date(withYear);
      if (!isNaN(parsed.getTime())) {
        // Treat the mentioned date as end-of-day
        parsed.setHours(23, 59, 59, 999);
        return parsed;
      }
    }
  }
  return null;
}

function isRowStale(row: any): boolean {
  if (row.status !== "active") return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return true;
  if (row.created_at && Date.now() - new Date(row.created_at).getTime() > SEVEN_DAYS_MS) return true;
  const qExpiry = extractExpiryFromQuestion(row.question ?? "");
  if (qExpiry && qExpiry.getTime() <= Date.now()) return true;
  return false;
}

export function useSuggestionsDB(statuses: string[] = ["active"]) {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const { isElite } = useSubscription();
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
    const nowIso = new Date().toISOString();
    let query = supabase
      .from("suggestions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(50);
    if (statuses.includes("active")) {
      query = query.or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    }
    // Non-Elite users never see auto-generated wallet signals.
    if (!isElite) {
      query = query.eq("origin", "manual");
    }
    const { data } = await query;
    const rows = data ?? [];

    // Auto-expire stale active rows (created >7d ago or past expires_at)
    const staleIds = rows.filter(isRowStale).map((r: any) => r.id);
    if (staleIds.length > 0) {
      await supabase
        .from("suggestions")
        .update({ status: "expired", expires_at: new Date().toISOString() })
        .in("id", staleIds);
      if (import.meta.env.DEV) {
        console.log("Marked expired:", staleIds.length, "suggestions");
      }
    }
    const visible = rows
      .filter((r: any) => !staleIds.includes(r.id))
      .map(mapSuggestionRow);
    setSuggestions(visible);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, user, isElite, statuses.join(",")]);

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