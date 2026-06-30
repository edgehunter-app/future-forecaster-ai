import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, X, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { americanPayout } from "@/lib/betMath";
import type { Bet } from "@/types";
import type { LineAlert } from "@/hooks/useLineMonitor";

interface CashoutResult {
  recommendation: "HOLD" | "MONITOR" | "CONSIDER_EXIT";
  confidence?: number;
  reasoning?: string;
  keyFactors?: string[];
  edgeRemaining?: number;
  riskLevel?: "low" | "medium" | "high";
}

interface Props {
  alert: LineAlert;
  bet?: Bet;
  onDismiss: () => void;
}

export default function LineAlertCard({ alert, bet, onDismiss }: Props) {
  const improved = alert.type === "LINE_IMPROVED";
  const isPredictionInfo = alert.type === "PREDICTION_MARKET";
  const isNoGameMatch = alert.type === "NO_GAME_MATCH";
  const isInfo = isPredictionInfo || isNoGameMatch;
  const sb = (alert.sportsbook ?? "").toLowerCase();
  const isPredictionBook = sb === "polymarket" || sb === "kalshi";
  const isPredictionMatched =
    !isInfo &&
    (isPredictionBook || alert.game === null) &&
    alert.currentImplied !== undefined;
  const skipAiCashout = isInfo || alert.game === null || isPredictionMatched;

  const borderClass = isInfo
    ? "border-info/30 bg-info/5"
    : improved
      ? "border-success/50 bg-success/5"
      : alert.severity === "high"
        ? "border-destructive/60 bg-destructive/5"
        : "border-warning/50 bg-warning/5";

  const Icon = isInfo ? Info : improved ? TrendingUp : TrendingDown;
  const iconColor = isInfo
    ? "text-info"
    : improved
      ? "text-success"
      : alert.severity === "high"
        ? "text-destructive"
        : "text-warning";

  const [cashout, setCashout] = useState<CashoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (skipAiCashout) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const potentialPayout = bet
          ? americanPayout(alert.openingOdds, Number(bet.amount))
          : null;
        const game = alert.game;
        if (!game) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("analyze-market", {
          body: {
            type: "cashout",
            pick: alert.pick,
            betType: bet?.bet_type ?? "moneyline",
            openingOdds: alert.openingOdds,
            currentOdds: alert.currentOdds,
            oddsChange: alert.oddsChange,
            edgeChange: alert.edgeChange,
            amount: bet?.amount ?? 0,
            potentialPayout,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            gameTime: game.commenceTime,
            bookmakers: (game.bookmakers ?? []).slice(0, 5).map((b) => ({
              name: b.name,
              key: b.key,
              moneyline: { home: b.homeMoneyline, away: b.awayMoneyline },
            })),
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setCashout(data as CashoutResult);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert, bet, skipAiCashout]);

  const openImplied = alert.openingImplied ?? toImplied(alert.openingOdds);
  const curImplied = alert.currentImplied ?? toImplied(alert.currentOdds);

  // Prediction-market profit estimate if sold at current price.
  const stake = Number(bet?.amount ?? 0);
  const predictionProfit =
    isPredictionMatched && stake > 0 && openImplied > 0
      ? stake * (curImplied / openImplied) - stake
      : null;

  // Local recommendation for prediction markets (no AI call needed).
  const predictionRec = (() => {
    if (!isPredictionMatched) return null;
    if (curImplied >= 0.95) {
      return {
        icon: "🟡",
        label: "CONSIDER TAKING PROFIT",
        color: "text-warning border-warning/40 bg-warning/10",
        reasoning: `Market at ${Math.round(curImplied * 100)}¢ — only ${Math.max(
          1,
          100 - Math.round(curImplied * 100),
        )}¢ of upside remaining. Consider selling your position to lock in gains.`,
      };
    }
    if (curImplied >= 0.8) {
      return {
        icon: "⚠️",
        label: "MONITOR",
        color: "text-warning border-warning/40 bg-warning/10",
        reasoning:
          "Strong position with some upside remaining. Monitor closely and consider partial exit if price approaches 95¢.",
      };
    }
    return {
      icon: "✅",
      label: "HOLD",
      color: "text-success border-success/40 bg-success/10",
      reasoning:
        "Good movement in your favor and meaningful upside still available. Hold the position.",
    };
  })();

  const recBadge = (() => {
    if (!cashout) return null;
    if (cashout.recommendation === "HOLD") {
      return { icon: "✅", label: "HOLD", color: "text-success border-success/40 bg-success/10" };
    }
    if (cashout.recommendation === "MONITOR") {
      return { icon: "⚠️", label: "MONITOR", color: "text-warning border-warning/40 bg-warning/10" };
    }
    return { icon: "🚨", label: "CONSIDER EXIT", color: "text-destructive border-destructive/40 bg-destructive/10" };
  })();

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", borderClass)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconColor)} />
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isNoGameMatch
                ? "Game Unavailable"
                : isPredictionInfo
                  ? "Prediction Market Bet"
                  : improved
                    ? "📈 Line improved"
                    : "📉 Line moved against you"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {alert.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isInfo ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">{alert.betTitle}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {alert.message}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">{alert.betTitle}</div>

            <div className="rounded-md border border-border/60 bg-background/30 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">What you bet</div>
              {isPredictionMatched && alert.openingImplied !== undefined ? (
                <div className="text-xs font-mono text-foreground">
                  {alert.pick} at {Math.round((alert.openingImplied ?? 0) * 100)}¢
                </div>
              ) : (
                <div className="text-xs font-mono text-foreground">
                  {alert.pick} at {fmtOdds(alert.openingOdds)}
                </div>
              )}
              {(alert.sportsbook || alert.loggedAt) && (
                <div className="text-[10px] text-muted-foreground">
                  {alert.sportsbook}
                  {alert.sportsbook && alert.loggedAt ? " · " : ""}
                  {alert.loggedAt
                    ? new Date(alert.loggedAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </div>
              )}
            </div>

            <div className="rounded-md border border-border/60 bg-background/30 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {isPredictionMatched ? "Current price" : "Best available now"}
              </div>
              {isPredictionMatched && alert.currentImplied !== undefined ? (
                <div className="text-xs font-mono text-foreground">
                  {Math.round((alert.currentImplied ?? 0) * 100)}¢
                  {alert.marketVolume && alert.marketVolume > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}· vol $
                      {alert.marketVolume >= 1_000_000
                        ? (alert.marketVolume / 1_000_000).toFixed(1) + "M"
                        : (alert.marketVolume / 1000).toFixed(0) + "k"}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs font-mono text-foreground">
                  {fmtOdds(alert.currentOdds)}
                  {alert.bestBook ? (
                    <span className="text-muted-foreground"> at {alert.bestBook}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="text-center py-2">
            <div
              className={cn(
                "font-mono text-2xl font-extrabold",
                improved ? "text-success" : "text-destructive",
              )}
            >
              {alert.oddsChange > 0 ? "+" : ""}
              {alert.oddsChange} cents
            </div>
            <div className="text-[11px] text-muted-foreground">
              {improved ? "in your favor" : "against you"}
            </div>
          </div>

          {isPredictionMatched ? (
            <div className="space-y-2">
              <div className="rounded-md border border-border/60 bg-background/30 p-2 text-xs font-mono text-foreground">
                Bought at {Math.round(openImplied * 100)}¢ · Now {Math.round(curImplied * 100)}¢
              </div>
              {predictionProfit !== null && (
                <div
                  className={cn(
                    "text-sm font-semibold",
                    predictionProfit >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  Position {predictionProfit >= 0 ? "up" : "down"} ~$
                  {Math.abs(predictionProfit).toFixed(2)} if sold now
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Your edge</span>
                <span
                  className={cn(
                    "font-mono",
                    (1 - curImplied) >= (1 - openImplied) ? "text-success" : "text-destructive",
                  )}
                >
                  {((1 - openImplied) * 100).toFixed(1)}% → {((1 - curImplied) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={Math.max(0, Math.min(100, (1 - curImplied) * 100))}
                className="h-1.5"
              />
            </div>
          )}

          {predictionRec ? (
            <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                  predictionRec.color,
                )}
              >
                <span>{predictionRec.icon}</span>
                {predictionRec.label}
              </span>
              <p className="text-xs text-foreground leading-relaxed">{predictionRec.reasoning}</p>
            </div>
          ) : !skipAiCashout && (
          <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing whether to hold or exit…
              </div>
            ) : err ? (
              <p className="text-xs text-destructive">{err}</p>
            ) : cashout && recBadge ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                    recBadge.color,
                  )}
                >
                  <span>{recBadge.icon}</span>
                  {recBadge.label}
                </span>
                {cashout.reasoning && (
                  <p className="text-xs text-foreground leading-relaxed">{cashout.reasoning}</p>
                )}
              </>
            ) : null}
          </div>
          )}
        </>
      )}

      <button
        onClick={onDismiss}
        className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
      >
        Got it
      </button>
    </div>
  );
}

function fmtOdds(o: number): string {
  return `${o > 0 ? "+" : ""}${o}`;
}
function toImplied(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}
