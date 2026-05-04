import { Activity, DollarSign, Download, Target, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import PerformanceChart from "@/components/history/PerformanceChart";
import TradeLogTable from "@/components/history/TradeLogTable";
import { MOCK_HISTORY, MOCK_MARKETS } from "@/data/mockData";
import { CATEGORY_COLORS, fmtSign, fmtUSD } from "@/lib/utils";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import type { HistoryPoint } from "@/types";
import { usePageTitle } from "@/hooks/usePageTitle";

const CATEGORY_PNL: { name: string; value: number }[] = [
  { name: "Economics", value: 400 },
  { name: "Crypto", value: 190 },
  { name: "Science", value: 240 },
];

export default function History() {
  usePageTitle("History");
  const { suggestions } = useSuggestionsDB(["won", "lost", "dismissed"]);

  // Build history series from DB if we have any won/lost outcomes; else MOCK_HISTORY.
  const dbHistory: HistoryPoint[] = (() => {
    const outcomes = suggestions.filter((s) => s.status === "won" || s.status === "lost");
    if (outcomes.length === 0) return MOCK_HISTORY;
    let cum = 0;
    return outcomes
      .slice()
      .reverse()
      .map((s, i) => {
        const pnl = s.status === "won" ? s.suggestedAmount * (s.edge || 0.1) : -s.suggestedAmount;
        cum += pnl;
        return {
          date: `T${i + 1}`,
          pnl: Math.round(pnl),
          cumulative: Math.round(cum),
          win: s.status === "won",
        };
      });
  })();

  const total = dbHistory.reduce((a, h) => a + h.pnl, 0);
  const wins = dbHistory.filter((h) => h.win).length;
  const winRate = dbHistory.length ? (wins / dbHistory.length) * 100 : 0;
  const avg = dbHistory.length ? total / dbHistory.length : 0;

  // streaks
  let winStreak = 0, lossStreak = 0, curW = 0, curL = 0;
  dbHistory.forEach((h) => {
    if (h.win) { curW++; curL = 0; winStreak = Math.max(winStreak, curW); }
    else { curL++; curW = 0; lossStreak = Math.max(lossStreak, curL); }
  });
  const maxDD = dbHistory.length ? Math.min(...dbHistory.map((h) => h.pnl)) : 0;

  const maxCat = Math.max(...CATEGORY_PNL.map((c) => c.value));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Backtesting & History</h1>
          <p className="text-sm text-muted-foreground">Track record of past suggestions</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total P&L" value={fmtSign(total)} icon={TrendingUp} color="#10b981" trend="up" />
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} icon={Target} color="#3b82f6" sub={`${wins} / ${dbHistory.length} trades`} />
        <StatCard label="Total Trades" value={dbHistory.length} icon={Activity} color="#8b5cf6" />
        <StatCard label="Avg Trade Size" value={fmtSign(Math.round(avg))} icon={DollarSign} color="#f59e0b" />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Cumulative P&L</h2>
          <span className="font-mono text-sm font-bold text-success">{fmtUSD(total)}</span>
        </div>
        <PerformanceChart data={dbHistory} />
      </div>

      {/* Trade log */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Trade Log</h2>
        <TradeLogTable history={dbHistory} markets={MOCK_MARKETS} />
      </div>

      {/* Backtest stats */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-4">Risk Metrics</h3>
          <ul className="space-y-3">
            <RiskRow label="Max Drawdown" value={fmtSign(maxDD)} color="text-destructive" />
            <RiskRow label="Sharpe Ratio" value="1.84" color="text-info" />
            <RiskRow label="Win Streak" value={`${winStreak}`} color="text-success" />
            <RiskRow label="Loss Streak" value={`${lossStreak}`} color="text-destructive" />
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-4">Performance Breakdown</h3>
          <div className="space-y-3">
            {CATEGORY_PNL.map((c) => {
              const color = CATEGORY_COLORS[c.name] ?? "#6b7280";
              const pct = (c.value / maxCat) * 100;
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{c.name}</span>
                    <span className="font-mono text-xs font-bold" style={{ color }}>{fmtSign(c.value)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
