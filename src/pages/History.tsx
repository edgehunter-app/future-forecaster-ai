import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Check, Clock, DollarSign, History as HistoryIcon, Minus, RotateCw, Target, TrendingUp, X } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { CATEGORY_COLORS, cn, fmtSign, fmtUSD } from "@/lib/utils";
import { useHistory, type HistoryEntry } from "@/hooks/useHistory";
import { useAppStore } from "@/store/useAppStore";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function History() {
  usePageTitle("History");
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const { entries, stats, loading, error, markOutcome, reload } = useHistory();

  const active = entries.filter((e) => e.status === "active");
  const hasResolved = stats.totalTrades > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">History</h1>
          <p className="text-sm text-muted-foreground">Your actual EdgeHunter suggestion track record</p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-2">
        <StatCard label="Total Trades" value={stats.totalTrades} icon={Activity} color="#8b5cf6" />
        <StatCard label="Win Rate" value={hasResolved ? `${(stats.winRate * 100).toFixed(1)}%` : "--"} icon={Target} color="#3b82f6" sub={hasResolved ? `${stats.wins} / ${stats.totalTrades} resolved` : "No resolved trades"} />
        <StatCard label="Total P&L" value={hasResolved ? fmtSign(Math.round(stats.totalPnL)) : "--"} icon={TrendingUp} color={stats.totalPnL >= 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Active Now" value={stats.activeTrades} icon={DollarSign} color="#f59e0b" />
      </div>

      {entries.length === 0 && !loading && (
        isDemoMode ? (
          <EmptyState
            icon={HistoryIcon}
            title="No history in demo mode"
            subtitle="Sign in to track your real suggestions and build a performance record."
            action={{ label: "Sign In", onClick: () => { window.location.href = "/auth"; } }}
          />
        ) : (
          <EmptyState
            icon={HistoryIcon}
            title="No suggestions yet"
            subtitle="Your EdgeHunter suggestions will appear here once you start running analysis. Active suggestions show with a live status. Mark outcomes to build your track record."
            action={{ label: "Go to Dashboard", onClick: () => { window.location.href = "/"; } }}
          />
        )
      )}

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Active Positions ({active.length})</h2>
          <div className="space-y-2">
            {active.map((e) => (
              <ActiveRow key={e.id} entry={e} onMark={markOutcome} />
            ))}
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Performance</h2>
          {stats.byMonth.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <MonthlyBars data={stats.byMonth} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              Performance chart will appear after your first resolved trade
            </div>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Trade Log</h2>
          <TradeLog entries={entries} onMark={markOutcome} />
        </div>
      )}

      {hasResolved && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-4">Risk Metrics</h3>
            <ul className="space-y-3">
              <RiskRow label="Win Rate" value={`${(stats.winRate * 100).toFixed(1)}%`} color="text-info" />
              <RiskRow label="Sharpe Ratio" value={stats.sharpe.toFixed(2)} color="text-info" />
              <RiskRow label="Max Win" value={fmtSign(Math.round(stats.maxWin))} color="text-success" />
              <RiskRow label="Max Loss" value={fmtSign(Math.round(stats.maxLoss))} color="text-destructive" />
              <RiskRow label="Current Streak" value={stats.streak.current > 0 ? `${stats.streak.current} ${stats.streak.type === "win" ? "wins" : "losses"}` : "—"} color={stats.streak.type === "win" ? "text-success" : "text-destructive"} />
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-4">Category Breakdown</h3>
            <CategoryBars byCategory={stats.byCategory} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveRow({ entry, onMark }: { entry: HistoryEntry; onMark: (id: string, o: "won" | "lost", pnl?: number) => void }) {
  const [mode, setMode] = useState<"won" | "lost" | null>(null);
  const [pnl, setPnl] = useState<string>("");
  const dirColor = entry.direction === "YES" ? "#10b981" : "#ef4444";

  return (
    <div className="rounded-lg border border-border border-l-2 border-l-info bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${dirColor}20`, color: dirColor }}>
          {entry.direction}
        </span>
        <div className="flex-1 min-w-[200px] truncate text-sm font-medium text-foreground">{entry.question}</div>
        <div className="font-mono text-xs text-muted-foreground">
          @ {(entry.entryOdds * 100).toFixed(0)}% · {fmtUSD(entry.suggestedAmount)}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {new Date(entry.createdAt).toLocaleDateString()}
        </div>
        {!mode ? (
          <div className="flex gap-2">
            <button onClick={() => setMode("won")} className="rounded-md bg-success/15 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/25">Mark Won</button>
            <button onClick={() => setMode("lost")} className="rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/25">Mark Lost</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              placeholder="Actual P&L (optional)"
              className="w-40 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
            />
            <button
              onClick={() => { onMark(entry.id, mode, pnl ? Number(pnl) : undefined); setMode(null); setPnl(""); }}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold text-white",
                mode === "won" ? "bg-success" : "bg-destructive")}
            >
              Confirm {mode === "won" ? "Win" : "Loss"}
            </button>
            <button onClick={() => { setMode(null); setPnl(""); }} className="px-4 py-3 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCell({ status }: { status: HistoryEntry["status"] }) {
  if (status === "active") return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info"><span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" /> Active</span>;
  if (status === "won") return <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success"><Check className="h-3 w-3" /> Won</span>;
  if (status === "lost") return <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive"><X className="h-3 w-3" /> Lost</span>;
  if (status === "dismissed") return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Minus className="h-3 w-3" /> Dismissed</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Clock className="h-3 w-3" /> Expired</span>;
}

function TradeLog({ entries, onMark }: { entries: HistoryEntry[]; onMark: (id: string, o: "won" | "lost", pnl?: number) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/60">
            {["Date", "Market", "Direction", "Confidence", "Amount", "P&L", "Status"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const dirColor = e.direction === "YES" ? "#10b981" : "#ef4444";
            const pnlText = e.pnl != null ? fmtSign(Math.round(e.pnl))
              : e.status === "won" ? "Won"
              : e.status === "lost" ? "Lost"
              : "--";
            const pnlColor = e.status === "won" ? "text-success" : e.status === "lost" ? "text-destructive" : "text-muted-foreground";
            return (
              <tr key={e.id}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/40",
                  i % 2 === 1 && "bg-card/40",
                  e.status === "active" && "border-l-2 border-l-info",
                )}>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 max-w-[280px] truncate text-foreground">{e.question}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${dirColor}20`, color: dirColor }}>{e.direction}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{e.confidence}%</td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{fmtUSD(e.suggestedAmount)}</td>
                <td className={cn("px-4 py-3 font-mono font-semibold text-xs", pnlColor)}>{pnlText}</td>
                <td className="px-4 py-3"><StatusCell status={e.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyBars({ data }: { data: { month: string; pnl: number; trades: number }[] }) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  return (
    <svg viewBox="0 0 600 160" className="w-full h-40" preserveAspectRatio="none">
      {data.map((d, i) => {
        const colW = 600 / data.length;
        const barW = colW * 0.5;
        const x = i * colW + (colW - barW) / 2;
        const maxBarH = 60;
        const barH = (Math.abs(d.pnl) / maxAbs) * maxBarH;
        const midY = 80;
        const y = d.pnl >= 0 ? midY - barH : midY;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={d.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
            <text x={x + barW / 2} y={150} textAnchor="middle" fontSize="10"
              fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{d.month}</text>
            <text x={x + barW / 2} y={d.pnl >= 0 ? y - 4 : y + barH + 12} textAnchor="middle" fontSize="9"
              fill={d.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} fontFamily="JetBrains Mono">
              {fmtSign(Math.round(d.pnl))}
            </text>
          </g>
        );
      })}
      <line x1="0" y1="80" x2="600" y2="80" stroke="hsl(var(--border))" strokeDasharray="3 3" />
    </svg>
  );
}

function CategoryBars({ byCategory }: { byCategory: Record<string, { trades: number; pnl: number }> }) {
  const cats = Object.entries(byCategory);
  if (cats.length === 0) return <div className="text-sm text-muted-foreground">No category data yet</div>;
  const maxAbs = Math.max(...cats.map(([, v]) => Math.abs(v.pnl)), 1);
  return (
    <div className="space-y-3">
      {cats.map(([name, v]) => {
        const color = CATEGORY_COLORS[name] ?? "#6b7280";
        const pct = (Math.abs(v.pnl) / maxAbs) * 100;
        return (
          <div key={name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">{name} <span className="text-muted-foreground">· {v.trades} trade{v.trades === 1 ? "" : "s"}</span></span>
              <span className="font-mono text-xs font-bold" style={{ color: v.pnl >= 0 ? color : "hsl(var(--destructive))" }}>{fmtSign(Math.round(v.pnl))}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: v.pnl >= 0 ? color : "hsl(var(--destructive))" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <li className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-bold ${color}`}>{value}</span>
    </li>
  );
}
