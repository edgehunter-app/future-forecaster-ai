import { useState } from "react";
import { Brain, X, Shield, ChevronDown, ChevronUp, Save, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { buildBetHeadline } from "@/lib/betHeadline";

interface Props {
  result: GameAnalysisResult;
  game: FullGame;
  onClear: () => void;
}

function tierTone(confidence: number, noEdge: boolean) {
  if (noEdge) return "border-border bg-muted/30 text-foreground";
  if (confidence >= 65) return "border-success/40 bg-success/10 text-success";
  if (confidence >= 50) return "border-warning/40 bg-warning/10 text-warning";
  return "border-border bg-muted/30 text-foreground";
}

function formatOdds(v: number | string | undefined): string {
  if (v === undefined || v === null || v === "") return "";
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (!Number.isFinite(n)) return String(v);
  return n > 0 ? `+${n}` : `${n}`;
}

export default function GameAnalysisPanel({ result, game, onClear }: Props) {
  const settings = useAppStore((s) => s.settings);
  const { user } = useAuth();
  const { saveSuggestion } = useSuggestionsDB();
  const [showSizing, setShowSizing] = useState(false);
  const [saved, setSaved] = useState(false);

  const noEdge = result.recommendation === "NO_EDGE";
  const tone = tierTone(result.confidence, noEdge);
  const { headline: builtHeadline, sideLabel } = noEdge
    ? { headline: "NO EDGE DETECTED", sideLabel: "" }
    : buildBetHeadline(result, game);
  const headline = builtHeadline;
  const resolvedSide: "HOME" | "AWAY" | null =
    result.recommendation === "HOME"
      ? "HOME"
      : result.recommendation === "AWAY"
        ? "AWAY"
        : null;

  const betTypeLabel =
    result.betType === "moneyline"
      ? "Moneyline"
      : result.betType === "spread"
        ? "Spread"
        : result.betType === "total"
          ? "Over / Under"
          : result.betType;

  const bankroll = settings.bankroll;
  const maxPos = Math.round(bankroll * (settings.maxPosition ?? 0.05));
  const oddsDecimal = result.odds > 0 ? result.odds / 100 + 1 : 100 / Math.abs(result.odds || 1) + 1;
  const rawKelly = (result.edge * bankroll) / oddsDecimal;
  const quarterKelly = Math.max(0, Math.round(rawKelly * (settings.kellyMultiplier ?? 0.25) * 0.25));

  const canSave = !noEdge && result.confidence >= settings.minConfidence;

  const handleSave = async () => {
    if (!user) {
      toast.error("Sign in to save suggestions");
      return;
    }
    try {
      await saveSuggestion({
        id: crypto.randomUUID(),
        marketId: `sports:${game.id}`,
        question: `${game.awayTeam} @ ${game.homeTeam}`,
        direction: resolvedSide === "HOME" || result.recommendation === "OVER" ? "YES" : "NO",
        currentOdds: result.impliedProbability,
        suggestedAmount: result.suggestedAmount,
        confidence: result.confidence,
        edge: result.edge,
        category: "Sports",
        reasoning: result.reasoning,
        walletSignals: [],
        keySignals: result.keyFactors,
        status: "active",
        createdAt: new Date().toLocaleString(),
        expiresAt: "48h",
      } as any);
      setSaved(true);
      toast.success("Saved to Suggestions");
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
    <div
      className="rounded-lg border border-purple/30 bg-purple/5 p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-purple">
          <Brain className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Claude AI Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">Just now</span>
          <button
            onClick={onClear}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear analysis"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Recommendation */}
      <div className={cn("rounded-md border px-3 py-3 text-center", tone)}>
        <div className="text-base sm:text-xl font-extrabold leading-tight">{headline}</div>
        <div className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">
          {sideLabel ? `${sideLabel} · ` : ""}
          {betTypeLabel}
          {result.odds ? ` · ${formatOdds(result.odds)}` : ""}
        </div>
      </div>

      {/* Line Shopping callout — always shown when present */}
      {result.lineShopping && (result.lineShopping.bestBook || result.lineShopping.recommendation) && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3">
          <div className="flex items-center gap-1.5 text-success mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Best Line Available</span>
          </div>
          {result.lineShopping.bestBook && (
            <div className="text-sm font-bold text-foreground">
              {result.lineShopping.bestBook} offers{" "}
              <span className="font-mono">{formatOdds(result.lineShopping.bestOdds)}</span>
              {typeof result.lineShopping.edgeCents === "number" && result.lineShopping.worstBook && (
                <>
                  {" "}— {result.lineShopping.edgeCents} cents better than{" "}
                  {result.lineShopping.worstBook} at{" "}
                  <span className="font-mono">{formatOdds(result.lineShopping.worstOdds)}</span>
                </>
              )}
            </div>
          )}
          {result.lineShopping.recommendation && (
            <div className="mt-1 text-[11px] text-success/90">{result.lineShopping.recommendation}</div>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Metric label="Suggested" value={`$${result.suggestedAmount}`} tone="text-info" />
        <Metric label="Edge" value={`${result.edge >= 0 ? "+" : ""}${(result.edge * 100).toFixed(1)}%`} tone="text-success" />
        <Metric label="Odds" value={result.odds > 0 ? `+${result.odds}` : `${result.odds}`} tone="text-foreground" />
      </div>

      {/* Confidence */}
      <div>
        <div className="mb-1 text-[10px] uppercase font-semibold text-muted-foreground">Confidence</div>
        <ConfidenceBar value={result.confidence} />
      </div>

      {/* Reasoning */}
      <div className="rounded-md bg-background/60 border border-border/60 p-3">
        <div className="flex items-start gap-2">
          <Brain className="h-3.5 w-3.5 mt-0.5 text-purple shrink-0" />
          <p className="text-xs italic text-foreground/90 leading-relaxed">{result.reasoning}</p>
        </div>
      </div>

      {/* Key factors */}
      {result.keyFactors.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">Key Factors</div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
            {result.keyFactors.map((f, i) => (
              <span
                key={i}
                className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warningFlags.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
          <div className="flex items-center gap-1.5 text-warning">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase">Warnings</span>
          </div>
          <ul className="mt-1 ml-1 list-disc list-inside space-y-0.5 text-[11px] text-warning/90">
            {result.warningFlags.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sizing */}
      <div className="rounded-md border border-border/60">
        <button
          onClick={() => setShowSizing((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <span>Show sizing details</span>
          {showSizing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showSizing && (
          <div className="border-t border-border/60 px-3 py-2 space-y-1 text-[11px] font-mono text-muted-foreground">
            <Row k="Bankroll" v={`$${bankroll}`} />
            <Row k="Edge detected" v={`${(result.edge * 100).toFixed(1)}%`} />
            <Row k="Quarter Kelly" v={`$${quarterKelly}`} />
            <Row k="Max position cap" v={`$${maxPos}`} />
            <Row k="Suggested" v={`$${result.suggestedAmount}`} />
          </div>
        )}
      </div>

      {/* Save to suggestions */}
      {canSave && !saved && (
        <div className="flex items-center justify-between rounded-md border border-info/30 bg-info/5 px-3 py-2">
          <span className="text-[11px] font-semibold text-foreground">Save to Suggestions?</span>
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-md bg-info px-3 py-1 text-[11px] font-semibold text-white hover:bg-info/90"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={() => setSaved(true)}
              className="rounded-md border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Safety */}
      <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5 flex items-start gap-2">
        <Shield className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
        <p className="text-[10px] leading-relaxed text-warning">
          AI suggestion only. Not financial advice. Must be 18+ to use sportsbooks. Verify
          independently before betting.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2 text-center sm:text-left">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-bold mt-0.5", tone ?? "text-foreground")}>{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}