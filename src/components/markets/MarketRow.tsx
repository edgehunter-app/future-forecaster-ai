import type { Market } from "@/types";
import Badge from "@/components/ui/Badge";
import { cn, fmtUSD, categoryColor } from "@/lib/utils";
import {
  estimateMarketConfidence,
  getConfidenceColor,
  getConfidenceBg,
  getConfidenceBorder,
  getConfidenceLabel,
} from "@/lib/confidenceColor";
import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import AnalysisResultPanel from "@/components/ui/AnalysisResultPanel";
import { useAppStore } from "@/store/useAppStore";
import { cleanMarketTitle } from "@/lib/cleanMarketTitle";

interface Props { market: Market; }

export function MarketRow({ market: m }: Props) {
  const isUp = m.change24h >= 0;
  const changeColor = isUp ? "text-success" : "text-destructive";
  const score = estimateMarketConfidence(m);
  const sColor = getConfidenceColor(score);
  const sBg = getConfidenceBg(score);
  const sBorder = getConfidenceBorder(score);
  const sLabel = getConfidenceLabel(score);
  const [hover, setHover] = useState(false);
  const { analyze, clear, isAnalyzing, getResult, getError } = useAIAnalysis();
  const cachedMarkets = useAppStore((s) => s.cachedMarkets);
  const result = getResult(m.id);
  const analyzing = isAnalyzing(m.id);
  const error = getError(m.id);
  const isKalshi = m.source === "kalshi";
  const type = isKalshi ? "kalshi" : "market";

  const handleAnalyze = () => {
    if (isKalshi) {
      // Find matching Polymarket counterpart for cross-market gap signal
      const poly = cachedMarkets.find(
        (x) => x.source !== "kalshi" && x.question.toLowerCase().slice(0, 30) === m.question.toLowerCase().slice(0, 30),
      );
      analyze(m.id, "kalshi", {
        question: m.question,
        category: m.category,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        volume24h: m.volume24h,
        endDate: m.endDate,
        polymarketYes: poly?.yesPrice,
        gap: poly ? Math.abs(poly.yesPrice - m.yesPrice) : null,
      });
    } else {
      analyze(m.id, "market", { market: m });
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group rounded-lg border border-border p-4 transition-all hover:border-foreground/15"
      style={{ borderLeft: `3px solid ${sColor}`, background: hover ? sBg : "hsl(var(--card))" }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_100px_120px_auto] md:items-center">
      {/* LEFT */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge color={categoryColor(m.category)} small>{m.category}</Badge>
          <Badge color={isKalshi ? "#10b981" : "#3b82f6"} small>
            {isKalshi ? "Kalshi" : "Polymarket"}
          </Badge>
          <span className="text-[11px] font-mono text-muted-foreground">Ends {m.endDate}</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{cleanMarketTitle(m.question)}</h3>
      </div>

      {/* MIDDLE */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-success/80 font-semibold">YES</div>
          <div className="font-sans text-[22px] font-extrabold text-success leading-tight">{(m.yesPrice * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-destructive/80 font-semibold">NO</div>
          <div className="font-sans text-[22px] font-extrabold text-destructive leading-tight">{(m.noPrice * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="md:text-right">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">24h Volume</div>
        <div className="font-mono text-sm font-bold text-foreground">{fmtUSD(m.volume24h)}</div>
        <div className={cn("text-xs font-mono font-semibold mt-0.5", changeColor)}>
          {isUp ? "▲" : "▼"} {Math.abs(m.change24h * 100).toFixed(1)}%
        </div>
      </div>

      {/* SIGNAL */}
      <div className="md:text-right">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Signal</div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: sBg, border: `1px solid ${sBorder}` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sColor }} />
          <span className="text-[11px] font-semibold" style={{ color: sColor }}>{sLabel}</span>
        </span>
      </div>

      {/* ANALYZE BUTTON */}
      <div className="md:text-right">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 rounded-md bg-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple/90 disabled:opacity-60 transition-colors"
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      </div>

      {error && !result && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
      )}
      {result && (
        <div className="mt-3">
          <AnalysisResultPanel
            result={result}
            type={type}
            onClear={() => clear(m.id)}
            saveAs={{
              marketId: m.id,
              question: m.question,
              direction: result.direction === "NO" ? "NO" : "YES",
              currentOdds: result.direction === "NO" ? m.noPrice : m.yesPrice,
              category: `${type}:${m.category}`,
            }}
          />
        </div>
      )}
    </div>
  );
}

import { memo as __memo } from "react";
export default __memo(MarketRow);
