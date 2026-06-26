import { useState } from "react";
import { Brain, X, Shield, TrendingUp, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import LogBetModal from "@/components/tracker/LogBetModal";
import { useBetTracker } from "@/hooks/useBetTracker";
import { toast } from "sonner";

function fmtOdds(v: number | string | undefined | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n > 0 ? `+${n}` : `${n}`;
}

export interface GolfAnalysisResult {
  recommendation?: string;
  betType?: string;
  odds?: number;
  bestBook?: string;
  confidence?: number;
  edge?: number;
  suggestedAmount?: number;
  reasoning?: string;
  valuePlay?: { player?: string; odds?: number; book?: string; reason?: string };
  lineShopping?: {
    player?: string;
    bestOdds?: number;
    worstOdds?: number;
    bestBook?: string;
    worstBook?: string;
    centsDifference?: number;
  };
  topPicks?: Array<{ player?: string; odds?: number; book?: string; reason?: string }>;
  keyFactors?: string[];
  riskLevel?: "low" | "medium" | "high";
  warningFlags?: string[];
}

interface Props {
  result: GolfAnalysisResult;
  tournamentName: string;
  onClear: () => void;
}

export default function GolfAnalysisPanel({ result, tournamentName, onClear }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const { logBet } = useBetTracker();

  const player = result.recommendation ?? "Player";
  const betLabel =
    result.betType === "each-way"
      ? "Each-Way"
      : result.betType === "top5"
        ? "Top 5 Finish"
        : result.betType === "top10"
          ? "Top 10 Finish"
          : "Outright Winner";

  const ls = result.lineShopping;
  const hasLineShop =
    !!ls?.player && Number.isFinite(ls?.bestOdds ?? NaN) && Number.isFinite(ls?.worstOdds ?? NaN);
  const showValuePlay =
    !!result.valuePlay?.player &&
    result.valuePlay.player.toLowerCase() !== (result.recommendation ?? "").toLowerCase();

  return (
    <div className="rounded-lg border border-purple/40 bg-gradient-to-br from-purple/10 to-card p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-purple">
          <Brain className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            🤖 Claude Golf Analysis
          </span>
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
      <div className="text-[11px] text-muted-foreground -mt-1">{tournamentName}</div>

      {/* Top recommendation */}
      <div className="rounded-md border border-purple/40 bg-purple/10 px-3 py-3 text-center">
        <div className="text-base sm:text-xl font-extrabold leading-tight text-foreground">
          BET {player.toUpperCase()}
        </div>
        <div className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">
          {betLabel}
          {result.odds ? ` · ${fmtOdds(result.odds)}` : ""}
          {result.bestBook ? ` at ${result.bestBook}` : ""}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Best Odds" value={fmtOdds(result.odds)} tone="text-success" />
        <Metric label="Confidence" value={`${result.confidence ?? 0}%`} tone="text-info" />
        <Metric
          label="Edge"
          value={`${(result.edge ?? 0) >= 0 ? "+" : ""}${((result.edge ?? 0) * 100).toFixed(1)}%`}
          tone="text-success"
        />
        <Metric label="Suggested" value={`$${result.suggestedAmount ?? 0}`} tone="text-foreground" />
      </div>

      {/* Value play */}
      {showValuePlay && result.valuePlay && (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3">
          <div className="text-[11px] font-bold uppercase text-amber-300 mb-1">
            💎 Value Play
          </div>
          <div className="text-sm font-bold text-foreground">
            {result.valuePlay.player} at {fmtOdds(result.valuePlay.odds)}
            {result.valuePlay.book ? ` (${result.valuePlay.book})` : ""}
          </div>
          {result.valuePlay.reason && (
            <div className="mt-1 text-[11px] text-amber-200/90">{result.valuePlay.reason}</div>
          )}
        </div>
      )}

      {/* Line shopping */}
      {hasLineShop && ls && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3">
          <div className="flex items-center gap-1.5 text-success mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Line Shopping</span>
          </div>
          <div className="text-sm font-bold text-foreground">
            {ls.player}: {ls.bestBook} {fmtOdds(ls.bestOdds)} vs {ls.worstBook}{" "}
            {fmtOdds(ls.worstOdds)}
            {typeof ls.centsDifference === "number" && (
              <span className="text-success">
                {" "}
                — save {ls.centsDifference} cents per $100
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top picks */}
      {Array.isArray(result.topPicks) && result.topPicks.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
            Top Picks
          </div>
          <ol className="space-y-1.5">
            {result.topPicks.slice(0, 3).map((p, i) => (
              <li
                key={i}
                className="rounded-md border border-border/60 bg-background/40 p-2 text-[11px]"
              >
                <div className="font-bold text-foreground">
                  {i + 1}. {p.player ?? "—"}{" "}
                  <span className="text-success font-mono">{fmtOdds(p.odds)}</span>
                  {p.book && (
                    <span className="text-muted-foreground font-normal"> · {p.book}</span>
                  )}
                </div>
                {p.reason && <div className="mt-0.5 text-muted-foreground">{p.reason}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Key factors */}
      {Array.isArray(result.keyFactors) && result.keyFactors.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
            Key Factors
          </div>
          <div className="flex flex-wrap gap-1.5">
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

      {/* Reasoning */}
      {result.reasoning && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <div className="flex items-start gap-2">
            <Brain className="h-3.5 w-3.5 mt-0.5 text-purple shrink-0" />
            <p className="text-xs italic text-foreground/90 leading-relaxed">
              {result.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {Array.isArray(result.warningFlags) && result.warningFlags.length > 0 && (
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

      {/* Log Bet */}
      <button
        onClick={() => setLogOpen(true)}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md",
          "bg-info px-3 py-2 text-[12px] font-semibold text-white hover:bg-info/90",
        )}
      >
        <Save className="h-3.5 w-3.5" />
        Log this bet
      </button>

      <LogBetModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={async (b) => {
          const r = await logBet(b);
          if (r) toast.success("Bet logged");
          else toast.error("Failed to log bet");
        }}
        initial={{
          title: `${player} Outright — ${tournamentName}`,
          sport: "Other",
          bet_type: "Futures",
          pick: player,
          odds: result.odds ?? 0,
          sportsbook: result.bestBook ?? "Other",
        }}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-bold mt-0.5", tone ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}