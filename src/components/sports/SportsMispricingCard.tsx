import { useState } from "react";
import { ArrowRight, Brain, ChevronDown, ChevronUp, Loader2, X, ShieldAlert } from "lucide-react";
import {
  getConfidenceColor,
  getConfidenceBg,
  getConfidenceBorder,
  getConfidenceLabel,
  getConfidenceTier,
  getConfidenceAction,
} from "@/lib/confidenceColor";
import { cn } from "@/lib/utils";
import { impliedToAmerican, toImplied, type SportsMispricing } from "@/lib/oddsApi";
import { analyzeMarketWithClaude } from "@/lib/claude";
import { useAppStore } from "@/store/useAppStore";
import GamblingDisclaimer from "./GamblingDisclaimer";
import ConfidenceBar from "@/components/ui/ConfidenceBar";
import type { ClaudeAnalysis } from "@/types";

interface Props { mispricing: SportsMispricing }

export default function SportsMispricingCard({ mispricing: m }: Props) {
  const wallets = useAppStore((s) => s.trackedWallets);
  const settings = useAppStore((s) => s.settings);
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ClaudeAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const color = getConfidenceColor(m.confidence);
  const bg = getConfidenceBg(m.confidence);
  const border = getConfidenceBorder(m.confidence);
  const tier = getConfidenceTier(m.confidence);

  const gapPct = m.spread * 100;
  const gapBg =
    gapPct >= 15 ? "bg-success/20 text-success border-success/40" :
    gapPct >= 10 ? "bg-warning/20 text-warning border-warning/40" :
                   "bg-info/20 text-info border-info/40";

  const time = m.game.commenceTime
    ? new Date(m.game.commenceTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "TBD";

  const bestBookKey = m.bestBook;
  const sortedBooks = [...m.game.bookmakers].sort(
    (a, b) => toImplied(b.homeOdds) - toImplied(a.homeOdds),
  );

  const analyze = async () => {
    setAnalyzing(true);
    setAiError(null);
    try {
      const r = await analyzeMarketWithClaude({
        market: m.polymarket,
        wallets,
        bankroll: settings.bankroll,
        kellyMultiplier: settings.kellyMultiplier,
        maxPositionPct: settings.maxPosition * 100,
        crossMarketData: {
          kalshiYes: m.vegasImplied,
          spread: m.spread,
          favoredPlatform: "polymarket",
        },
      });
      if (r) setAnalysis(r);
      else setAiError("No strong signal detected.");
    } catch {
      setAiError("Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      className={cn("rounded-lg border bg-card p-4 space-y-3 transition-all", tier === "weak" && "opacity-70")}
      style={{ borderColor: border, boxShadow: `0 2px 12px ${color}0d` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-info/40 bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase text-info">
            {m.league}
          </span>
          <span className="text-[11px] text-muted-foreground">{time}</span>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{ color, borderColor: border, backgroundColor: bg }}
        >
          {getConfidenceLabel(m.confidence)}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{m.question}</h3>
      <div className="text-xs text-muted-foreground">{m.game.homeTeam} vs {m.game.awayTeam}</div>

      <div className="grid grid-cols-3 items-center gap-2">
        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <div className="text-[9px] uppercase font-semibold text-muted-foreground">Polymarket</div>
          <div className="font-mono text-xl font-extrabold" style={{ color }}>
            {(m.polyImplied * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground">YES implied</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", gapBg)}>
            {gapPct.toFixed(1)}% Gap
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <div className="text-[9px] uppercase font-semibold text-muted-foreground">Vegas Consensus</div>
          <div className="font-mono text-xl font-extrabold text-foreground">
            {(m.vegasImplied * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{m.bestBook}</div>
          <div className="text-[10px] font-mono text-muted-foreground">{impliedToAmerican(m.vegasImplied)}</div>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
        style={{ borderColor: border, backgroundColor: bg }}
      >
        <span className="font-semibold" style={{ color }}>
          {tier === "strong"
            ? `Buy ${m.direction} on Polymarket`
            : tier === "moderate"
              ? `Watch — ${m.direction} on Polymarket`
              : "Skip — insufficient gap"}
        </span>
        <span className="font-mono font-semibold" style={{ color }}>
          +{(m.edge * 100).toFixed(1)}% edge
        </span>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide books" : `Show ${sortedBooks.length} books`}
      </button>

      {expanded && sortedBooks.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-card/60">
              <tr>
                {["Book", "Home", "Away", "Implied"].map((h) => (
                  <th key={h} className="px-2 py-1 text-left font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBooks.map((b) => {
                const isBest = b.title === bestBookKey;
                return (
                  <tr key={b.key} className={cn("border-t border-border/60", isBest && "bg-success/10")}>
                    <td className="px-2 py-1 text-foreground">{b.title}</td>
                    <td className="px-2 py-1 font-mono text-foreground">{b.homeOdds > 0 ? `+${b.homeOdds}` : b.homeOdds}</td>
                    <td className="px-2 py-1 font-mono text-foreground">{b.awayOdds > 0 ? `+${b.awayOdds}` : b.awayOdds}</td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{(toImplied(b.homeOdds) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={analyze}
        disabled={analyzing}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-purple/40 bg-purple/10 px-3 py-2 text-xs font-semibold text-purple hover:bg-purple/20 transition-colors disabled:opacity-50"
      >
        {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        {analyzing ? "Analyzing..." : "Analyze with Claude"}
      </button>

      {aiError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{aiError}</div>
      )}

      {analysis && (
        <div className="relative rounded-md border border-purple/30 bg-purple/5 p-3 space-y-2">
          <button onClick={() => setAnalysis(null)} aria-label="Close analysis"
            className="absolute right-1 top-1 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-purple uppercase">
            <Brain className="h-3 w-3" /> Claude Analysis
          </div>
          <p className="text-xs text-foreground leading-relaxed">{analysis.reasoning}</p>
          <ConfidenceBar value={analysis.confidence} size="sm" />
          <div className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning">
            <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
            <span>AI suggestion only. Verify before trading.</span>
          </div>
        </div>
      )}

      <GamblingDisclaimer variant="inline" />
    </div>
  );
}
