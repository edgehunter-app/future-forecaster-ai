import { supabase } from "@/integrations/supabase/client";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";

export function impliedFromAmerican(american: number): number {
  if (!Number.isFinite(american) || american === 0) return 0;
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

export function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 70) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}

/**
 * Records every AI-generated sports pick for internal performance tracking
 * (win rate / ROI / closing line value). Fire-and-forget: never blocks or
 * surfaces errors to the user.
 */
export async function logAiPick(game: FullGame, result: GameAnalysisResult): Promise<void> {
  try {
    if (!result || result.recommendation === "NO_EDGE") return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    const side = String(result.recommendation).toUpperCase();
    const selection =
      side === "HOME"
        ? game.homeTeam
        : side === "AWAY"
          ? game.awayTeam
          : side === "OVER"
            ? "Over"
            : side === "UNDER"
              ? "Under"
              : side;

    const odds = Number(result.odds);
    const line =
      result.betType === "spread"
        ? (result.spreadLine ?? null)
        : result.betType === "total"
          ? ((game as any).vegasConsensus?.totalLine ?? (game as any).totalLine ?? null)
          : null;

    await supabase.from("pick_log").insert({
      user_id: userId,
      origin: "sports_analysis",
      event_key: String(game.id),
      sport_key: String(game.sport ?? ""),
      league: String(game.league ?? ""),
      event_name: `${game.awayTeam} @ ${game.homeTeam}`,
      home_team: game.homeTeam,
      away_team: game.awayTeam,
      commence_time: game.commenceTime ?? null,
      bet_type: result.betType ?? "moneyline",
      selection,
      selection_side: side,
      line: line === null ? null : Number(line),
      odds_at_pick: Number.isFinite(odds) ? Math.round(odds) : null,
      implied_at_pick: Number.isFinite(odds) ? Number(impliedFromAmerican(odds).toFixed(6)) : null,
      book_at_pick: result.bestBook ?? "",
      confidence: result.confidence ?? null,
      confidence_tier: confidenceTier(result.confidence ?? 0),
      edge: result.edge ?? null,
      model: "claude",
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn("logAiPick failed", err);
  }
}
