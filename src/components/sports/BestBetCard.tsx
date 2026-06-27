import { Trophy, X, TrendingUp, Save, AlertTriangle, Clock, RotateCw, BarChart3, Fish } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import type { BestBetResult } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { buildBetHeadline } from "@/lib/betHeadline";

interface Props {
  result: BestBetResult;
  onClear: () => void;
  onRescan?: () => void;
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

export default function BestBetCard({ result, onClear, onRescan }: Props) {
  // Route to alternate layouts based on source.
  if (result.source === "prediction_market" && result.prediction) {
    return <PredictionMarketBestBetCard result={result} onClear={onClear} onRescan={onRescan} />;
  }
  if (result.source === "wallet_signal" && result.wallet) {
    return <WalletSignalBestBetCard result={result} onClear={onClear} onRescan={onRescan} />;
  }

  const { game, analysis, scannedCount, generatedAt } = result;
  if (!game || !analysis) return null;
  const settings = useAppStore((s) => s.settings);
  const { user } = useAuth();
  const { saveSuggestion } = useSuggestionsDB();
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(i);
  }, []);

  const gameStartMs = new Date(game.commenceTime).getTime();
  const msUntil = gameStartMs - now.getTime();
  const minutesUntil = Math.floor(msUntil / 60000);
  const gameStarted = msUntil <= 0;

  const generatedAtDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const ageMinutes = Math.floor((now.getTime() - generatedAtDate.getTime()) / 60000);
  const isStale = ageMinutes > 120;

  let countdownLabel = "";
  let countdownTone = "";
  let pulse = false;
  if (gameStarted) {
    countdownLabel = "Game in progress — do not bet";
    countdownTone = "border-destructive/50 bg-destructive/20 text-destructive";
  } else if (minutesUntil < 30) {
    countdownLabel = `⚡ Starting in ${minutesUntil}m — bet now`;
    countdownTone = "border-destructive/50 bg-destructive/20 text-destructive";
    pulse = true;
  } else if (minutesUntil < 120) {
    countdownLabel = `Starting soon · ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`;
    countdownTone = "border-warning/50 bg-warning/20 text-warning";
  } else {
    const h = Math.floor(minutesUntil / 60);
    const m = minutesUntil % 60;
    countdownLabel = `Starts in ${h}h ${m}m`;
    countdownTone = "border-success/50 bg-success/20 text-success";
  }

  const tone = confidenceTone(analysis.confidence);
  // Resolve side + correct any team-name mismatch so Claude's reasoning,
  // headline, and recommendedTeam all agree.
  const { headline, sideLabel } = buildBetHeadline(analysis, game);
  const resolvedSide: "HOME" | "AWAY" | null =
    analysis.recommendation === "HOME"
      ? "HOME"
      : analysis.recommendation === "AWAY"
        ? "AWAY"
        : null;

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
  // For spread/total bets, Claude's odds + bestBook reflect the actual market.
  const displayOdds = analysis.betType === "spread" || analysis.betType === "total"
    ? (analysis.odds ?? bestOdds)
    : bestOdds;
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

  const vegasBookCount =
    (game.bookmakers ?? []).filter(
      (b: any) =>
        b.key !== "kalshi" &&
        b.key !== "polymarket" &&
        (b.homeMoneyline || b.awayMoneyline),
    ).length;
  const showLineShopping = vegasBookCount >= 2;

  const handleSave = async () => {
    if (gameStarted) {
      toast.error("This game has already started.");
      return;
    }
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
      {isStale && (
        <div className="rounded-md border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-warning">
            <div className="font-bold">
              ⚠️ This pick is {Math.floor(ageMinutes / 60)} hour{Math.floor(ageMinutes / 60) === 1 ? "" : "s"} old
            </div>
            <div className="opacity-90">Lines may have moved — rescan for the latest opportunity</div>
          </div>
          {onRescan && (
            <button
              onClick={onRescan}
              className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/20 px-2 py-1 text-[11px] font-bold text-warning hover:bg-warning/30"
            >
              <RotateCw className="h-3 w-3" /> Rescan Now
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-extrabold text-foreground">Today's Best Bet</div>
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                🏆 Line Shopping Edge
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Best line shopping edge across {scannedCount} opportunit{scannedCount === 1 ? "y" : "ies"} today · {generated}
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

      {/* Countdown badge */}
      <div className={cn("flex items-center gap-2 rounded-md border px-3 py-1.5 text-[15px] font-bold", countdownTone, pulse && "animate-pulse")}>
        <Clock className="h-4 w-4" />
        <span>{countdownLabel}</span>
      </div>

      {gameStarted && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          This game has started. Run a new scan for current opportunities.
        </div>
      )}

      {/* Recommendation box */}
      <div className={cn("rounded-lg border-2 px-3 py-4 text-center", tone)}>
        <div className="text-lg sm:text-2xl font-extrabold leading-tight">{headline}</div>
        <div className="mt-1 text-[11px] tracking-wide text-muted-foreground">
          {sideLabel ? `${sideLabel} · ` : ""}
          {betTypeLabel}
          {displayOdds ? ` · ${formatOdds(displayOdds)}` : ""}
        </div>
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
            displayOdds && bestBook
              ? `${formatOdds(displayOdds)} · ${bestBook}`
              : formatOdds(displayOdds) || "—"
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

      {/* Line shopping — only when 2+ vegas books available */}
      {showLineShopping && analysis.lineShopping &&
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
        disabled={saved || gameStarted}
        className={cn(
          "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white shadow-md transition-opacity disabled:opacity-60",
          "bg-gradient-to-r from-purple to-purple/80 hover:opacity-90",
        )}
      >
        <Save className="h-4 w-4" />
        {gameStarted ? "Game Started" : saved ? "Logged" : "Log This Bet"}
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

// ============================================================================
// Prediction-market (cross-market gap) layout
// ============================================================================
function PredictionMarketBestBetCard({ result, onClear, onRescan }: Props) {
  const p = result.prediction!;
  const { scannedCount, generatedAt } = result;
  const generatedAtDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generated = generatedAtDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tone = confidenceTone(p.confidence);
  const ageMinutes = Math.floor((Date.now() - generatedAtDate.getTime()) / 60000);
  const isStale = ageMinutes > 120;

  return (
    <div
      id="best-bet-card"
      className="rounded-xl border-2 border-info/40 bg-gradient-to-br from-info/10 via-card to-purple/5 p-4 sm:p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {isStale && onRescan && (
        <StaleBanner ageMinutes={ageMinutes} onRescan={onRescan} />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-info" />
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-extrabold text-foreground">Today's Best Bet</div>
              <span className="rounded-full border border-info/40 bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-info">
                📊 Cross-Market Gap
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Cross-market gap between Kalshi and Polymarket on this question · {generated}
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

      <div className="text-sm font-semibold text-foreground line-clamp-3">
        {p.market.question}
      </div>

      <div className={cn("rounded-lg border-2 px-3 py-4 text-center", tone)}>
        <div className="text-lg sm:text-2xl font-extrabold leading-tight">
          BET {p.favoredSide} on {p.bestPlatform}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide opacity-80">
          Best price: {p.bestPlatform} at {p.bestPriceCents}¢
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Polymarket" value={`${p.polyPriceCents}¢`} tone="text-foreground" />
        <Metric label="Kalshi" value={`${p.kalshiPriceCents}¢`} tone="text-foreground" />
        <Metric label="Gap" value={`${p.gapCents}¢`} tone="text-success" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Suggested" value={`$${p.suggestedAmount}`} tone="text-info" />
        <Metric label="Edge" value={`${p.edge >= 0 ? "+" : ""}${(p.edge * 100).toFixed(1)}%`} tone="text-success" />
        <Metric label="Risk" value={p.riskLevel.toUpperCase()} tone="text-foreground" />
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase font-semibold text-muted-foreground">Confidence</div>
        <ConfidenceBar value={p.confidence} />
      </div>

      {p.reasoning && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <p className="text-xs italic text-foreground/90 leading-relaxed">{p.reasoning}</p>
        </div>
      )}

      {p.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.keyFactors.map((f, i) => (
            <span key={i} className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
              {f}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center leading-snug">
        Scanned {scannedCount} opportunities. AI suggestions are not financial advice.
      </p>
    </div>
  );
}

// ============================================================================
// Wallet-signal layout
// ============================================================================
function WalletSignalBestBetCard({ result, onClear, onRescan }: Props) {
  const w = result.wallet!;
  const { scannedCount, generatedAt } = result;
  const generatedAtDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generated = generatedAtDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tone = confidenceTone(w.confidence);
  const ageMinutes = Math.floor((Date.now() - generatedAtDate.getTime()) / 60000);
  const isStale = ageMinutes > 120;

  return (
    <div
      id="best-bet-card"
      className="rounded-xl border-2 border-purple/40 bg-gradient-to-br from-purple/10 via-card to-info/5 p-4 sm:p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {isStale && onRescan && (
        <StaleBanner ageMinutes={ageMinutes} onRescan={onRescan} />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fish className="h-5 w-5 text-purple" />
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-extrabold text-foreground">Today's Best Bet</div>
              <span className="rounded-full border border-purple/40 bg-purple/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple">
                🐋 Smart Wallet Signal
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {w.walletCount} elite wallets agree on this question — combined ${Math.round(w.totalValue).toLocaleString()} position · {generated}
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

      <div className="text-sm font-semibold text-foreground line-clamp-3">
        {w.market.question}
      </div>

      <div className={cn("rounded-lg border-2 px-3 py-4 text-center", tone)}>
        <div className="text-lg sm:text-2xl font-extrabold leading-tight">
          BET {w.favoredSide}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide opacity-80">
          {w.walletCount} top wallets positioned {w.favoredSide}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-1">Wallet tiers:</span>
        {w.topWallets.map((tw, i) => (
          <span
            key={i}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-bold font-mono",
              tw.tier === "S"
                ? "border-warning/50 bg-warning/15 text-warning"
                : "border-info/50 bg-info/15 text-info",
            )}
            title={`${tw.label} · $${Math.round(tw.positionValue).toLocaleString()}`}
          >
            {tw.tier}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Suggested" value={`$${w.suggestedAmount}`} tone="text-info" />
        <Metric label="Combined" value={`$${Math.round(w.totalValue).toLocaleString()}`} tone="text-success" />
        <Metric label="Confidence" value={`${w.confidence}%`} tone="text-foreground" />
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase font-semibold text-muted-foreground">Confidence</div>
        <ConfidenceBar value={w.confidence} />
      </div>

      {w.reasoning && (
        <div className="rounded-md bg-background/60 border border-border/60 p-3">
          <p className="text-xs italic text-foreground/90 leading-relaxed">{w.reasoning}</p>
        </div>
      )}

      {w.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {w.keyFactors.map((f, i) => (
            <span key={i} className="rounded-full border border-purple/30 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold text-purple">
              {f}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center leading-snug">
        Scanned {scannedCount} opportunities. AI suggestions are not financial advice.
      </p>
    </div>
  );
}

function StaleBanner({ ageMinutes, onRescan }: { ageMinutes: number; onRescan: () => void }) {
  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
      <div className="flex-1 text-xs text-warning">
        <div className="font-bold">
          ⚠️ This pick is {Math.floor(ageMinutes / 60)} hour{Math.floor(ageMinutes / 60) === 1 ? "" : "s"} old
        </div>
        <div className="opacity-90">Prices may have moved — rescan for the latest opportunity</div>
      </div>
      <button
        onClick={onRescan}
        className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/20 px-2 py-1 text-[11px] font-bold text-warning hover:bg-warning/30"
      >
        <RotateCw className="h-3 w-3" /> Rescan Now
      </button>
    </div>
  );
}