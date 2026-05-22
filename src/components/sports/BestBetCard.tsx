import { Trophy, X, TrendingUp, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import type { BestBetResult } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  result: BestBetResult;
  onClear: () => void;
}

function formatOdds(v: number | string | undefined): string {
  if (v === undefined || v === null || v === "") return "";
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (!Number.isFinite(n)) return String(v);
  return n > 0 ? `+${n}` : `${n}`;
}

function confidenceTone(c: number) {
  if (c >= 70) return "border-warning/50 bg-warning/10 text-warning";
  if (c >= 60) return "border-success/50 bg-success/10 text-success";
  if (c >= 50) return "border-info/50 bg-info/10 text-info";
  return "border-border bg-muted/40 text-foreground";
}

export default function BestBetCard({ result, onClear }: Props) {
  const { game, analysis, scannedCount, generatedAt } = result;
  const settings = useAppStore((s) => s.settings);
  const { user } = useAuth();
  const { saveSuggestion } = useSuggestionsDB();
  const [saved, setSaved] = useState(false);

  const tone = confidenceTone(analysis.confidence);
  // Resolve the actual side being recommended. If Claude's `recommendedTeam`
  // names the home or away team, that wins — it represents the side Claude's
  // reasoning is actually about. Otherwise fall back to the side label.
  const recTeamRaw = (analysis.recommendedTeam ?? "").trim();
  const matchesHome =
    !!recTeamRaw && game.homeTeam.toLowerCase().includes(recTeamRaw.toLowerCase());
  const matchesAway =
    !!recTeamRaw && game.awayTeam.toLowerCase().includes(recTeamRaw.toLowerCase());
  const resolvedSide: "HOME" | "AWAY" | null = matchesHome
    ? "HOME"
    : matchesAway
      ? "AWAY"
      : analysis.recommendation === "HOME" || analysis.recommendation === "AWAY"
        ? analysis.recommendation
        : null;

  const team =
    resolvedSide === "HOME"
      ? game.homeTeam
      : resolvedSide === "AWAY"
        ? game.awayTeam
        : recTeamRaw;

  const headline =
    resolvedSide === "HOME"
      ? `BET HOME — ${game.homeTeam}`
      : resolvedSide === "AWAY"
        ? `BET AWAY — ${game.awayTeam}`
        : analysis.recommendation === "OVER"
          ? `BET OVER — ${team || game.total?.line || ""}`
          : analysis.recommendation === "UNDER"
            ? `BET UNDER — ${team || game.total?.line || ""}`
            : `BET ${analysis.recommendation} — ${team}`;

  const betTypeLabel =
    analysis.betType === "moneyline"
      ? "Moneyline"
      : analysis.betType === "spread"
        ? "Spread"
        : analysis.betType === "total"
          ? "Over / Under"
          : analysis.betType;

  const bestOdds =
    resolvedSide === "HOME"
      ? game.moneyline?.bestHomeOdds
      : resolvedSide === "AWAY"
        ? game.moneyline?.bestAwayOdds
        : analysis.odds;
  const bestBook =
    analysis.bestBook ??
    (resolvedSide === "HOME"
      ? game.moneyline?.bestHomeBook
      : resolvedSide === "AWAY"
        ? game.moneyline?.bestAwayBook
        : "");

  const gameTime = new Date(game.commenceTime).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const generated = generatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
        direction:
          resolvedSide === "HOME" || analysis.recommendation === "OVER" ? "YES" : "NO",
        currentOdds: analysis.impliedProbability,
        suggestedAmount: analysis.suggestedAmount,
        confidence: analysis.confidence,
        edge: analysis.edge,
        category: "Sports",
        reasoning: analysis.reasoning,
        walletSignals: [],
        keySignals: analysis.keyFactors,
        status: "active",
        createdAt: new Date().toLocaleString(),
        expiresAt: "48h",
      } as any);
      setSaved(true);
      toast.success("Logged to Suggestions");
    } catch {
      toast.error("Failed to log bet");
    }
  };

  return (
    <div
      id="best-bet-card"
      className="rounded-xl border-2 border-purple/40 bg-gradient-to-br from-purple/10 via-card to-warning/5 p-4 sm:p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <div>
            <div className="text-base font-extrabold text-foreground">Today's Best Bet</div>
            <div className="text-[11px] text-muted-foreground">
              Scanned {scannedCount} game{scannedCount === 1 ? "" : "s"} · {generated}
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Game info */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {game.league && (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 font-semibold uppercase text-muted-foreground">
            {game.league}
          </span>
        )}
        <span className="font-semibold text-foreground">
          {game.awayTeam} <span className="text-muted-foreground">@</span> {game.homeTeam}
        </span>
        <span className="text-muted-foreground">· {gameTime}</span>
      </div>

      {/* Recommendation box */}
      <div className={cn("rounded-lg border-2 px-3 py-4 text-center", tone)}>
        <div className="text-lg sm:text-2xl font-extrabold leading-tight">{headline}</div>
        <div className="mt-1 text-[11px] uppercase tracking-wide opacity-80">{betTypeLabel}</div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Suggested" value={`$${analysis.suggestedAmount}`} tone="text-info" />
        <Metric
          label="Edge"
          value={`${analysis.edge >= 0 ? "+" : ""}${(analysis.edge * 100).toFixed(1)}%`}
          tone="text-success"
        />
        <Metric
          label="Best Odds"
          value={
            bestOdds && bestBook
              ? `${formatOdds(bestOdds)} · ${bestBook}`
              : formatOdds(bestOdds) || "—"
          }
          tone="text-foreground"
        />
      </div>

      {/* Confidence bar */}
      <div>
        <div className="mb-1 text-[10px] uppercase font-semibold text-muted-foreground">
          Confidence
        </div>
        <ConfidenceBar value={analysis.confidence} />
      </div>

      {/* Line shopping */}
      {analysis.lineShopping &&
        (analysis.lineShopping.bestBook || analysis.lineShopping.recommendation) && (
          <div className="rounded-md border border-success/40 bg-success/10 p-3">
            <div className="flex items-center gap-1.5 text-success mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Best Line Available
              </span>
            </div>
            {analysis.lineShopping.bestBook && (
              <div className="text-sm font-bold text-foreground">
                {analysis.lineShopping.bestBook}{" "}
                <span className="font-mono">{formatOdds(analysis.lineShopping.bestOdds)}</span>
                {typeof analysis.lineShopping.edgeCents === "number" &&
                  analysis.lineShopping.worstBook && (
                    <>
                      {" "}— save {analysis.lineShopping.edgeCents}¢ per $100 vs{" "}
                      {analysis.lineShopping.worstBook} at{" "}
                      <span className="font-mono">
                        {formatOdds(analysis.lineShopping.worstOdds)}
                      </span>
                    </>
                  )}
              </div>
            )}
            {analysis.lineShopping.recommendation && (
              <div className="mt-1 text-[11px] text-success/90">
                {analysis.lineShopping.recommendation}
              </div>
            )}
          </div>
        )}

      {/* Reasoning */}
      {analysis.reasoning && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <p className="text-xs italic text-foreground/90 leading-relaxed">{analysis.reasoning}</p>
        </div>
      )}

      {/* Key factors */}
      {analysis.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {analysis.keyFactors.map((f, i) => (
            <span
              key={i}
              className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Log bet button */}
      <button
        onClick={handleSave}
        disabled={saved}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white shadow-md transition-opacity disabled:opacity-60",
          "bg-gradient-to-r from-purple to-purple/80 hover:opacity-90",
        )}
      >
        <Save className="h-4 w-4" />
        {saved ? "Logged" : "Log This Bet"}
      </button>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center leading-snug">
        AI suggestions are not financial advice. Bet responsibly within your bankroll
        (max ${Math.round(settings.bankroll * (settings.maxPosition ?? 0.05))} per position).
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-2.5 py-2 text-center">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-extrabold font-mono", tone)}>{value}</div>
    </div>
  );
}