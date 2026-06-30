import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, X, Loader2 } from "lucide-react";
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
  const borderClass = improved
    ? "border-success/50 bg-success/5"
    : alert.severity === "high"
      ? "border-destructive/60 bg-destructive/5"
      : "border-warning/50 bg-warning/5";

  const Icon = improved ? TrendingUp : TrendingDown;
  const iconColor = improved ? "text-success" : alert.severity === "high" ? "text-destructive" : "text-warning";

  const [cashout, setCashout] = useState<CashoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const potentialPayout = bet
          ? americanPayout(alert.openingOdds, Number(bet.amount))
          : null;
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
            homeTeam: alert.game.homeTeam,
            awayTeam: alert.game.awayTeam,
            gameTime: alert.game.commenceTime,
            bookmakers: (alert.game.bookmakers ?? []).slice(0, 5).map((b) => ({
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
  }, [alert, bet]);

  const openImplied = toImplied(alert.openingOdds);
  const curImplied = toImplied(alert.currentOdds);
  // user's edge changes inversely with implied prob of the price they took
  const openEdgePct = (1 - openImplied) * 100;
  const curEdgePct = (1 - curImplied) * 100;

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
            <h3 className="text-sm font-bold text-foreground">Line Movement Alert</h3>
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

      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{alert.betTitle}</div>
        <div className="text-[11px] text-muted-foreground">
          You bet: <span className="font-mono">{fmtOdds(alert.openingOdds)}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Current best:{" "}
          <span className="font-mono">{fmtOdds(alert.currentOdds)}</span>
          {alert.bestBook ? ` at ${alert.bestBook}` : ""}
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

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Your edge</span>
          <span className="font-mono">
            {openEdgePct.toFixed(1)}% → {curEdgePct.toFixed(1)}%
          </span>
        </div>
        <Progress
          value={Math.max(0, Math.min(100, curEdgePct))}
          className="h-1.5"
        />
      </div>

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