import { Loader2 } from "lucide-react";
import type { FullGame } from "@/lib/oddsApi";
import type { GameAnalysisResult } from "@/types";
import AICard from "@/components/ui/AICard";
import { cn } from "@/lib/utils";

interface Props {
  game: FullGame;
  analysis: GameAnalysisResult | null;
  analyzing: boolean;
  error?: string;
  onAnalyze: () => void;
}

function fmtOdds(v: number | undefined | null) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  return v > 0 ? `+${v}` : `${v}`;
}

export default function InlineBetResult({ game, analysis, analyzing, error, onAnalyze }: Props) {
  const start = new Date(game.commenceTime);
  const startLabel = start.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-card p-5 sm:p-6 space-y-4">
      {/* Match header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {game.league} · {startLabel}
        </div>
        <h3 className="mt-1 text-[18px] font-extrabold text-foreground">
          {game.awayTeam} @ {game.homeTeam}
        </h3>
      </div>

      {/* Odds row */}
      <div className="grid grid-cols-2 gap-3">
        <OddsCell team={game.awayTeam} odds={game.moneyline?.bestAwayOdds ?? game.moneyline?.away} book={game.moneyline?.bestAwayBook} />
        <OddsCell team={game.homeTeam} odds={game.moneyline?.bestHomeOdds ?? game.moneyline?.home} book={game.moneyline?.bestHomeBook} />
      </div>

      {/* Analysis */}
      {!analysis && !analyzing && !error && (
        <button
          onClick={onAnalyze}
          className="w-full rounded-xl bg-gradient-cta text-white text-sm font-bold py-3 shadow-glow-blue hover:opacity-95 transition"
        >
          Analyze with Claude
        </button>
      )}

      {analyzing && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/30 py-4 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing this bet…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          <AICard>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wide">Why it has value</h4>
              <span className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                analysis.edge > 0
                  ? "bg-success/15 border-success/30 text-success"
                  : "bg-muted border-white/10 text-muted-foreground",
              )}>
                {analysis.edge > 0 ? "+" : ""}{(analysis.edge * 100).toFixed(1)}% EDGE
              </span>
            </div>
            <p className="text-[13px] text-foreground/90 leading-relaxed">{analysis.reasoning}</p>
          </AICard>

          <AICard tone="danger">
            <h4 className="text-[11px] font-bold uppercase tracking-wide mb-2">What could go wrong</h4>
            {analysis.warningFlags?.length > 0 ? (
              <ul className="space-y-1.5">
                {analysis.warningFlags.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-foreground/85">
                    <span className="text-destructive mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-foreground/80">Risk level: {analysis.riskLevel}.</p>
            )}
          </AICard>

          <AICard>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wide">Verdict</h4>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                analysis.confidence >= 65
                  ? "bg-success/15 border border-success/30 text-success"
                  : analysis.confidence >= 50
                    ? "bg-warning/15 border border-warning/30 text-warning"
                    : "bg-destructive/15 border border-destructive/30 text-destructive",
              )}>
                {analysis.confidence >= 65 ? "STRONG" : analysis.confidence >= 50 ? "CAUTION" : "SKIP"}
              </span>
            </div>
            <p className="text-[13px] font-semibold text-foreground/95">
              {analysis.recommendedTeam} {analysis.betType}
              {typeof analysis.spreadLine === "number" && analysis.betType === "spread"
                ? ` ${analysis.spreadLine > 0 ? "+" : ""}${analysis.spreadLine}`
                : ""}
              {" · "}
              {fmtOdds(analysis.odds)}
            </p>
          </AICard>

          <AICard>
            <h4 className="text-[11px] font-bold uppercase tracking-wide mb-3">Supporting data</h4>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Confidence" value={`${analysis.confidence}%`} />
              <Metric label="Best Book" value={analysis.bestBook ?? "—"} />
              <Metric label="Suggested" value={analysis.suggestedAmount ? `$${analysis.suggestedAmount}` : "—"} />
            </div>
            {analysis.keyFactors?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {analysis.keyFactors.map((k, i) => (
                  <span key={i} className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </AICard>
        </div>
      )}
    </div>
  );
}

function OddsCell({ team, odds, book }: { team: string; odds?: number; book?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground truncate">{team}</div>
      <div className="mt-0.5 font-mono text-[16px] font-extrabold text-foreground">{fmtOdds(odds)}</div>
      {book && <div className="text-[10px] text-info truncate">{book}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 border border-white/5 px-2.5 py-2">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-0.5 text-[13px] font-extrabold font-mono text-foreground truncate">{value}</div>
    </div>
  );
}