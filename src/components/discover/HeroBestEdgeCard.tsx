import { ArrowRight, Loader2, Zap } from "lucide-react";
import type { BestBetResult } from "@/types";
import { cn } from "@/lib/utils";

function formatOdds(v: number | string | undefined | null): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (!Number.isFinite(n)) return String(v);
  return n > 0 ? `+${n}` : `${n}`;
}

interface Props {
  result: BestBetResult | null;
  loading: boolean;
  scannedLines?: number;
  bookCount?: number;
  onOpen: () => void;
  onHunt: () => void;
  emptyMessage?: string;
}

export default function HeroBestEdgeCard({
  result,
  loading,
  scannedLines = 0,
  bookCount = 9,
  onOpen,
  onHunt,
  emptyMessage,
}: Props) {
  // Skeleton / loading
  if (loading && !result) {
    return (
      <div className="rounded-2xl border border-white/5 bg-gradient-hero p-6 sm:p-7 shadow-hero-glow animate-pulse min-h-[320px]">
        <div className="h-6 w-40 rounded-full bg-white/10 mb-6" />
        <div className="h-7 w-2/3 rounded bg-white/10 mb-4" />
        <div className="h-16 w-full rounded-xl bg-white/5 mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="h-14 rounded-lg bg-white/5" />
          <div className="h-14 rounded-lg bg-white/5" />
          <div className="h-14 rounded-lg bg-white/5" />
        </div>
        <div className="h-12 w-full rounded-xl bg-white/10" />
      </div>
    );
  }

  // Empty state
  if (!result) {
    return (
      <div className="rounded-2xl border border-white/5 bg-gradient-hero p-6 sm:p-7 shadow-hero-glow min-h-[280px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 border border-warning/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">
            <Zap className="h-3 w-3" /> Today's Best Edge
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
          <div className="text-[17px] font-semibold text-foreground/80">
            No qualifying edge right now
          </div>
          <p className="text-[13px] text-muted-foreground max-w-xs">
            {emptyMessage ?? "Check back later today — we scan the board every few minutes."}
          </p>
          <button
            onClick={onHunt}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-cta px-5 py-3 text-sm font-bold text-white shadow-glow-blue hover:opacity-95 transition"
          >
            Scan Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Sports-source render (most common); fallback to prediction/wallet with generic labels
  const sport =
    result.game?.league ??
    (result.source === "prediction_market" ? "Cross-Market" : result.source === "wallet_signal" ? "Signal" : "Bet");

  const matchup =
    result.source === "sports" && result.game
      ? `${result.game.awayTeam} @ ${result.game.homeTeam}`
      : result.source === "prediction_market" && result.prediction
        ? result.prediction.market.question
        : result.source === "wallet_signal" && result.wallet
          ? result.wallet.market.question
          : "Best Edge";

  const betName =
    result.source === "sports" && result.analysis
      ? `${result.analysis.recommendedTeam ?? ""} ${result.analysis.betType ?? ""}`.trim() || "Recommended"
      : result.source === "prediction_market" && result.prediction
        ? `${result.prediction.favoredSide} on ${result.prediction.bestPlatform}`
        : result.source === "wallet_signal" && result.wallet
          ? `${result.wallet.favoredSide} · Smart Money`
          : "Recommended";

  const book =
    result.source === "sports"
      ? result.analysis?.bestBook ?? "Best Book"
      : result.source === "prediction_market"
        ? result.prediction!.bestPlatform
        : "Polymarket";

  const edge =
    (result.analysis?.edge ??
      result.prediction?.edge ??
      result.wallet?.edge ??
      0) * 100;

  const oddsDisplay =
    result.source === "sports"
      ? formatOdds(result.analysis?.odds)
      : result.source === "prediction_market"
        ? `${result.prediction!.bestPriceCents}¢`
        : "—";

  const confidence =
    result.analysis?.confidence ??
    result.prediction?.confidence ??
    result.wallet?.confidence ??
    0;

  return (
    <div
      className="rounded-2xl border border-white/5 bg-gradient-hero p-6 sm:p-7 shadow-hero-glow cursor-pointer transition hover:border-info/30"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 border border-warning/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">
          <Zap className="h-3 w-3" /> Today's Best Edge
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
          {sport}
        </span>
      </div>

      {/* Matchup */}
      <h2 className="text-[22px] font-extrabold text-foreground leading-tight mb-4 line-clamp-2">
        {matchup}
      </h2>

      {/* Recommendation box */}
      <div className="rounded-xl bg-black/40 border border-white/5 px-4 py-3 mb-5">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mb-1">
          Recommendation
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-foreground text-[15px] truncate">{betName}</div>
          <div className="text-[12px] font-mono text-info shrink-0">· {book}</div>
        </div>
      </div>

      {/* 3-column stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Edge" value={`${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`} tone="text-success" />
        <Stat label="Best Odds" value={oddsDisplay} tone="text-foreground" />
        <Stat label="Confidence" value={`${confidence}%`} tone="text-warning" />
      </div>

      {/* Confidence bar */}
      <div className="mb-5">
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5",
          "bg-gradient-cta text-white text-sm font-bold shadow-glow-blue hover:opacity-95 transition",
        )}
      >
        Hunt This Edge <ArrowRight className="h-4 w-4" />
      </button>
      <div className="mt-2 text-center text-[11px] text-muted-foreground">
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Scanning…
          </span>
        ) : (
          `Scanned ${scannedLines || result.scannedCount} lines across ${bookCount} books`
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 px-2.5 py-2 text-center">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className={cn("mt-0.5 text-[15px] font-extrabold font-mono", tone)}>{value}</div>
    </div>
  );
}