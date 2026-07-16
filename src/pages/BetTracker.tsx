import { useMemo, useState } from "react";
import { Trophy, Plus, Flame, Check, XCircle, MoreVertical, Zap, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useBetTracker } from "@/hooks/useBetTracker";
import LogBetModal from "@/components/tracker/LogBetModal";
import LineAlertCard from "@/components/tracker/LineAlertCard";
import { useLineMonitor } from "@/hooks/useLineMonitor";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { cn, fmtUSD } from "@/lib/utils";
import { americanPayout } from "@/lib/betMath";
import type { Bet, BetStatus } from "@/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type HistoryFilter = "all" | "won" | "lost" | "push";
type HistorySort = "recent" | "biggest_win" | "biggest_loss";

export default function BetTracker() {
  usePageTitle("Bet Tracker");
  const { bets, loading, stats, logBet, resolveBet } = useBetTracker();
  const { alerts, checkLines, dismissAlert, checking, lastCheck: lastChecked } = useLineMonitor();
  const [modalOpen, setModalOpen] = useState(false);

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("recent");

  const pending = bets.filter((b) => b.status === "pending");
  const resolved = bets.filter((b) => b.status !== "pending" && b.status !== "void");

  const filteredResolved = useMemo(() => {
    let list = resolved;
    if (historyFilter !== "all") list = list.filter((b) => b.status === historyFilter);
    return [...list].sort((a, b) => {
      if (historySort === "biggest_win") return Number(b.profit_loss) - Number(a.profit_loss);
      if (historySort === "biggest_loss") return Number(a.profit_loss) - Number(b.profit_loss);
      const at = new Date(a.resolved_at ?? a.created_at).getTime();
      const bt = new Date(b.resolved_at ?? b.created_at).getTime();
      return bt - at;
    });
  }, [resolved, historyFilter, historySort]);

  if (loading) {
    return <div className="h-72 rounded-lg border border-border bg-card animate-pulse" />;
  }

  if (bets.length === 0) {
    return (
      <>
        <div className="space-y-6">
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">My Bet Tracker</h1>
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center space-y-4 max-w-xl mx-auto">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Start tracking your bets</h2>
            <p className="text-sm text-muted-foreground">
              Log your first bet to see your performance stats, win rate, and ROI over time.
            </p>
            <Button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Log Your First Bet
            </Button>
          </div>
        </div>
        <LogBetModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={logBet} />
      </>
    );
  }

  const winRateColor =
    stats.winRate > 55 ? "text-success" : stats.winRate >= 45 ? "text-warning" : "text-destructive";
  const plColor = stats.totalPL > 0 ? "text-success" : stats.totalPL < 0 ? "text-destructive" : "text-foreground";
  const roiColor = stats.roi > 0 ? "text-success" : stats.roi < 0 ? "text-destructive" : "text-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">My Bet Tracker</h1>
          <p className="text-sm text-muted-foreground">Track every bet. Know your edge.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Log Bet
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Record"
          value={`${stats.won}-${stats.lost}-${stats.push}`}
          hint={`${stats.winRate.toFixed(1)}% win rate`}
          valueClass={winRateColor}
        />
        <StatCard
          label="P&L"
          value={`${stats.totalPL >= 0 ? "+" : ""}${fmtUSD(stats.totalPL)}`}
          hint={`Total wagered: ${fmtUSD(stats.totalWagered)}`}
          valueClass={plColor}
        />
        <StatCard
          label="ROI"
          value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`}
          hint="vs market avg: -5%"
          valueClass={roiColor}
        />
        <StatCard
          label="Current Streak"
          value={stats.streak > 0 ? `${stats.streakType === "won" ? "W" : "L"}${stats.streak}` : "—"}
          hint={`Longest win streak: ${stats.longestWinStreak}`}
          valueClass={stats.streakType === "won" ? "text-success" : stats.streakType === "lost" ? "text-destructive" : "text-foreground"}
          icon={stats.streak >= 5 && stats.streakType === "won" ? <Flame className="h-5 w-5 text-warning" /> : null}
        />
      </div>

      {/* Bankroll chart */}
      {stats.bankrollHistory.length > 1 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground mb-3">Bankroll over time</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.bankrollHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${Math.round(v)}`}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  labelFormatter={(d) => new Date(d as string).toLocaleString()}
                  formatter={(v: number, _name, item: any) => [fmtUSD(v), item?.payload?.bet ?? ""]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={stats.totalPL >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <button
          onClick={() => void checkLines()}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition mb-4"
        >
          <RefreshCw size={16} className={cn(checking && "animate-spin")} />
          Check Lines on Active Bets
          {lastChecked && (
            <span className="text-xs opacity-60">
              · checked {formatDistanceToNow(lastChecked)} ago
            </span>
          )}
        </button>
      )}

      {/* Pending */}
      <section className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Pending ({pending.length})</h2>
        </div>


        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-warning">
              <Zap className="h-3.5 w-3.5" /> Line Movement Alerts ({alerts.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((a) => (
                <LineAlertCard
                  key={a.betId}
                  alert={a}
                  bet={bets.find((b) => b.id === a.betId)}
                  onDismiss={() => dismissAlert(a.betId)}
                />
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active bets. Log a new one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((b) => (
              <PendingBetCard key={b.id} bet={b} onResolve={resolveBet} />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Resolved ({resolved.length})</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <FilterPills
              options={[
                { v: "all", label: "All" },
                { v: "won", label: "Won" },
                { v: "lost", label: "Lost" },
                { v: "push", label: "Push" },
              ]}
              value={historyFilter}
              onChange={(v) => setHistoryFilter(v as HistoryFilter)}
            />
            <FilterPills
              options={[
                { v: "recent", label: "Recent" },
                { v: "biggest_win", label: "Biggest Win" },
                { v: "biggest_loss", label: "Biggest Loss" },
              ]}
              value={historySort}
              onChange={(v) => setHistorySort(v as HistorySort)}
            />
          </div>
        </div>
        {filteredResolved.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bets in this view yet.</p>
        ) : (
          <div className="space-y-2">
            {filteredResolved.map((b) => <ResolvedRow key={b.id} bet={b} />)}
          </div>
        )}
      </section>

      {/* Performance breakdown */}
      {stats.bySport.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownTable
            title="Stats by Sport"
            headers={["Sport", "Bets", "W", "L", "Win%", "P&L", "ROI"]}
            rows={stats.bySport.map((r) => [
              r.key, r.bets, r.won, r.lost,
              `${r.winRate.toFixed(0)}%`,
              <span key="pl" className={r.pl >= 0 ? "text-success" : "text-destructive"}>
                {r.pl >= 0 ? "+" : ""}{fmtUSD(r.pl)}
              </span>,
              `${r.roi >= 0 ? "+" : ""}${r.roi.toFixed(1)}%`,
            ])}
          />
          <BreakdownTable
            title="Stats by Sportsbook"
            headers={["Book", "Bets", "Win%", "P&L"]}
            rows={stats.bySportsbook.map((r) => [
              r.key, r.bets,
              `${r.winRate.toFixed(0)}%`,
              <span key="pl" className={r.pl >= 0 ? "text-success" : "text-destructive"}>
                {r.pl >= 0 ? "+" : ""}{fmtUSD(r.pl)}
              </span>,
            ])}
          />
        </section>
      )}

      <LogBetModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={logBet} />
    </div>
  );
}

function StatCard({ label, value, hint, valueClass, icon }: {
  label: string; value: string; hint?: string; valueClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={cn("mt-1 font-mono text-2xl font-extrabold", valueClass ?? "text-foreground")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function FilterPills({ options, value, onChange }: {
  options: { v: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
            value === o.v
              ? "border-info bg-info text-white"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PendingBetCard({ bet, onResolve }: { bet: Bet; onResolve: (id: string, s: BetStatus) => void | Promise<void> }) {
  const payout = americanPayout(bet.odds, Number(bet.amount));
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {bet.sport}
            </span>
            <span className="text-[10px] text-muted-foreground">{bet.sportsbook}</span>
          </div>
          <h3 className="text-sm font-bold text-foreground">{bet.title}</h3>
          <p className="text-xs text-muted-foreground">
            {bet.pick} · <span className="font-mono">{bet.odds > 0 ? "+" : ""}{bet.odds}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-foreground">{fmtUSD(Number(bet.amount))}</div>
          <div className="text-[10px] text-muted-foreground">to win {fmtUSD(payout - Number(bet.amount))}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void onResolve(bet.id, "won")}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1.5 text-xs font-semibold text-success hover:bg-success/20"
        >
          <Check className="h-3.5 w-3.5" /> Mark Won
        </button>
        <button
          onClick={() => void onResolve(bet.id, "lost")}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
        >
          <XCircle className="h-3.5 w-3.5" /> Mark Lost
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md border border-border bg-background/40 p-1.5 text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void onResolve(bet.id, "push")}>Push</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onResolve(bet.id, "void")}>Void</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ResolvedRow({ bet }: { bet: Bet }) {
  const isWin = bet.status === "won";
  const isLoss = bet.status === "lost";
  const isPush = bet.status === "push";
  const pl = Number(bet.profit_loss);
  const badgeClass = isWin
    ? "bg-success/15 text-success border-success/40"
    : isLoss
      ? "bg-destructive/15 text-destructive border-destructive/40"
      : "bg-muted text-muted-foreground border-border";
  const accent = isWin
    ? "border-l-2 border-l-green-500"
    : isLoss
      ? "border-l-2 border-l-red-500"
      : "border-l-2 border-l-white/20";
  const closingLine = (bet as any).closing_line as number | null | undefined;
  const clvDelta =
    typeof closingLine === "number" && Number.isFinite(closingLine)
      ? impliedFromAmerican(bet.odds) - impliedFromAmerican(closingLine)
      : null;
  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-3", accent)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide", badgeClass)}>
              {bet.status}
            </span>
            <span className="rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
              {bet.sport}
            </span>
            <span className="text-[10px] text-muted-foreground">{bet.sportsbook}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground truncate">{bet.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {bet.pick} · <span className="font-mono">{bet.odds > 0 ? "+" : ""}{bet.odds}</span> · {fmtUSD(Number(bet.amount))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={cn(
              "font-mono text-xl font-extrabold",
              isWin ? "text-success" : isLoss ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {isPush ? "Push" : `${pl >= 0 ? "+" : ""}${fmtUSD(pl)}`}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {new Date(bet.resolved_at ?? bet.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      {typeof closingLine === "number" && Number.isFinite(closingLine) && clvDelta !== null && (
        <div className="mt-2 text-[11px] text-muted-foreground border-t border-white/5 pt-2">
          Closed at <span className="font-mono text-foreground/80">{closingLine > 0 ? "+" : ""}{closingLine}</span>
          {" · "}You had <span className="font-mono text-foreground/80">{bet.odds > 0 ? "+" : ""}{bet.odds}</span>
          {" · "}
          <span className={cn("font-semibold", clvDelta > 0 ? "text-success" : clvDelta < 0 ? "text-destructive" : "text-muted-foreground")}>
            {clvDelta > 0 ? "Beat" : clvDelta < 0 ? "Lost to" : "Matched"} closing line by {Math.abs(clvDelta * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

function impliedFromAmerican(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

function BreakdownTable({ title, headers, rows }: {
  title: string; headers: string[]; rows: (string | number | React.ReactNode)[][];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-left text-muted-foreground">
              {headers.map((h) => <th key={h} className="px-2 py-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/40">
                {r.map((c, j) => <td key={j} className="px-2 py-1.5 text-foreground">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}