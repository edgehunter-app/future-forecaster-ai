import { useState } from "react";
import { Brain, X, Shield, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { useAppStore } from "@/store/useAppStore";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { AnalysisType } from "@/hooks/useAIAnalysis";

interface Props {
  result: any;
  type: AnalysisType;
  title?: string;
  onClear: () => void;
  onSave?: () => Promise<void> | void;
  /** Pre-built suggestion payload — if present, default save handler will use it */
  saveAs?: {
    marketId: string;
    question: string;
    direction: "YES" | "NO";
    currentOdds?: number;
    category: string;
  };
  compact?: boolean;
}

function disclaimerText(type: AnalysisType): string {
  switch (type) {
    case "sports":
    case "prop":
      return "AI suggestion only. Not financial advice. Must be 18+ to use sportsbooks. Verify independently before betting. Problem gambling: 1-800-522-4700.";
    case "cross-market":
      return "AI suggestion only. Not financial advice. Verify independently before trading. If sports-related, must be 18+ — problem gambling: 1-800-522-4700.";
    case "wallet-strategy":
      return "Past performance does not guarantee future results. Do your own research before following any wallet.";
    default:
      return "EdgeHunter suggestion only. No auto-execution. Always verify independently before trading.";
  }
}

export default function AnalysisResultPanel({ result, type, title, onClear, onSave, saveAs, compact }: Props) {
  const settings = useAppStore((s) => s.settings);
  const { user } = useAuth();
  const { saveSuggestion } = useSuggestionsDB();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const conf = typeof result?.confidence === "number" ? result.confidence : 0;
  const hasConfidence = typeof result?.confidence === "number";
  const passes = conf >= settings.minConfidence;

  const doSave = async () => {
    if (onSave) {
      setSaving(true);
      try { await onSave(); setSaved(true); toast.success("Saved to Suggestions ✓"); }
      catch { toast.error("Failed to save"); }
      finally { setSaving(false); }
      return;
    }
    if (!user) { toast.error("Sign in to save suggestions"); return; }
    if (!saveAs) return;
    setSaving(true);
    try {
      await saveSuggestion({
        id: crypto.randomUUID(),
        marketId: saveAs.marketId,
        question: saveAs.question,
        direction: saveAs.direction,
        currentOdds: saveAs.currentOdds ?? 0,
        suggestedAmount: result.suggestedAmount ?? 0,
        confidence: conf,
        edge: result.edge ?? 0,
        category: saveAs.category,
        reasoning: result.reasoning ?? "",
        walletSignals: [],
        keySignals: result.keySignals ?? result.keyFactors ?? [],
        status: "active",
        createdAt: new Date().toLocaleString(),
        expiresAt: "48h",
      } as any);
      setSaved(true);
      toast.success("Saved to Suggestions ✓");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  if (compact) {
    const rec = result.recommendation ?? result.direction ?? result.favoredSide;
    const recColor = rec === "OVER" || rec === "YES" || rec === "HOME"
      ? "bg-success/20 text-success border-success/40"
      : rec === "UNDER" || rec === "NO" || rec === "AWAY"
        ? "bg-destructive/20 text-destructive border-destructive/40"
        : "bg-muted text-muted-foreground border-border";
    return (
      <div className="rounded-md border border-purple/30 bg-purple/5 p-2 mt-1.5 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold border", recColor)}>{rec ?? "—"}</span>
          <button onClick={onClear} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
        </div>
        {hasConfidence && <ConfidenceBar value={conf} size="sm" />}
        {result.bestBook && (
          <div className="text-foreground"><span className="text-muted-foreground">Best:</span> {result.bestBook} {result.bestOdds ? `at ${result.bestOdds > 0 ? "+" : ""}${result.bestOdds}` : ""}</div>
        )}
        {result.reasoning && <p className="text-muted-foreground italic line-clamp-2">{result.reasoning}</p>}
        {typeof result.suggestedAmount === "number" && result.suggestedAmount > 0 && (
          <div className="font-mono text-info">Suggested: ${result.suggestedAmount}</div>
        )}
        <div className="text-[9px] text-warning/80">⚠ AI tip only. 18+. Verify before betting.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple/30 bg-purple/5 p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-purple">
          <Brain className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">{title ?? "Claude AI Analysis"}</span>
        </div>
        <button onClick={onClear} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Clear">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Headline by type */}
      {type === "wallet-strategy" && result.followRecommendation && (
        <div className={cn(
          "rounded-md border px-3 py-3 text-center",
          result.followRecommendation === "YES" ? "border-success/40 bg-success/10 text-success" :
          result.followRecommendation === "PARTIAL" ? "border-warning/40 bg-warning/10 text-warning" :
          "border-destructive/40 bg-destructive/10 text-destructive",
        )}>
          <div className="text-base sm:text-xl font-extrabold">
            {result.followRecommendation === "YES" ? "Follow This Wallet" :
             result.followRecommendation === "PARTIAL" ? "Selectively Follow" : "Do Not Follow"}
          </div>
          {result.traderType && (
            <div className="mt-0.5 text-[11px] uppercase tracking-wide opacity-80">{result.traderType} trader</div>
          )}
        </div>
      )}

      {type === "cross-market" && result.favoredPlatform && (
        <div className="rounded-md border border-info/40 bg-info/10 px-3 py-3 text-center text-info">
          <div className="text-base sm:text-xl font-extrabold">
            Buy {result.favoredSide} on {result.favoredPlatform}
          </div>
        </div>
      )}

      {(type === "market" || type === "kalshi") && result.direction && (
        <div className={cn(
          "rounded-md border px-3 py-3 text-center",
          result.direction === "YES" ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
        )}>
          <div className="text-base sm:text-xl font-extrabold">BET {result.direction}</div>
          {type === "kalshi" && <div className="text-[10px] uppercase tracking-wide mt-0.5 opacity-80">Kalshi · CFTC regulated</div>}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {typeof result.suggestedAmount === "number" && (
          <Metric label="Suggested" value={`$${result.suggestedAmount}`} tone="text-info" />
        )}
        {typeof result.edge === "number" && (
          <Metric label="Edge" value={`${result.edge >= 0 ? "+" : ""}${(result.edge * 100).toFixed(1)}%`} tone="text-success" />
        )}
        {result.riskLevel && (
          <Metric label="Risk" value={result.riskLevel} tone="text-warning" />
        )}
        {result.bestBook && (
          <Metric label="Best book" value={result.bestBook} />
        )}
        {typeof result.strengthScore === "number" && (
          <Metric label="Strength" value={`${result.strengthScore}`} tone="text-info" />
        )}
      </div>

      {hasConfidence && (
        <div>
          <div className="mb-1 text-[10px] uppercase font-semibold text-muted-foreground">Confidence</div>
          <ConfidenceBar value={conf} />
        </div>
      )}

      {result.reasoning && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <p className="text-xs italic text-foreground/90 leading-relaxed">{result.reasoning}</p>
        </div>
      )}

      {result.strategyDescription && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <p className="text-xs text-foreground/90 leading-relaxed">{result.strategyDescription}</p>
        </div>
      )}

      {result.whyGapExists && (
        <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-info">
          <div className="font-semibold">Why the gap exists</div>
          <div>{result.whyGapExists}</div>
          {result.expectedResolution && <div className="mt-1 opacity-80">Resolution: {result.expectedResolution}</div>}
        </div>
      )}

      {result.currentPositionsTake && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3 text-[11px] text-foreground">
          <div className="font-semibold mb-1">Current positions</div>
          {result.currentPositionsTake}
        </div>
      )}

      {(result.keyFactors || result.keySignals || result.keyInsights) && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">Key signals</div>
          <div className="flex flex-wrap gap-1.5">
            {(result.keyFactors ?? result.keySignals ?? result.keyInsights ?? []).map((f: string, i: number) => (
              <span key={i} className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">{f}</span>
            ))}
          </div>
        </div>
      )}

      {result.lineShopping && (
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-[11px] text-success">
          <span className="font-semibold">Line shopping:</span> {result.lineShopping}
        </div>
      )}

      {result.regulatoryNote && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-semibold">Regulatory:</span> {result.regulatoryNote}
        </div>
      )}

      {result.actionableAdvice && (
        <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-info">
          <span className="font-semibold">Action:</span> {result.actionableAdvice}
        </div>
      )}

      {(result.warningFlags && result.warningFlags.length > 0) && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
          <div className="text-[10px] font-bold uppercase text-warning">Warnings</div>
          <ul className="mt-1 ml-1 list-disc list-inside space-y-0.5 text-[11px] text-warning/90">
            {result.warningFlags.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {result.watchSignals && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Watch for</div>
          <ul className="ml-1 list-disc list-inside space-y-0.5 text-[11px] text-foreground/80">
            {result.watchSignals.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Save */}
      {(saveAs || onSave) && !saved && (
        <button
          onClick={doSave}
          disabled={saving}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
            passes ? "bg-success text-white hover:bg-success/90" : "border border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {passes ? "Save to My Suggestions" : `Save anyway (below ${settings.minConfidence}% threshold)`}
        </button>
      )}
      {saved && (
        <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
          <Check className="h-3.5 w-3.5" /> Saved ✓
        </div>
      )}

      {/* Safety */}
      <div className="rounded-md border border-warning/40 bg-warning/5 p-2.5 flex items-start gap-2">
        <Shield className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
        <p className="text-[10px] leading-relaxed text-warning">{disclaimerText(type)}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2 text-center sm:text-left">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-bold mt-0.5 capitalize truncate", tone ?? "text-foreground")}>{value}</div>
    </div>
  );
}