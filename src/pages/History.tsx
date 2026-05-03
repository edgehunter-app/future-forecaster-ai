import { Activity, DollarSign, Download, Target, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import PerformanceChart from "@/components/history/PerformanceChart";
import TradeLogTable from "@/components/history/TradeLogTable";
import { MOCK_HISTORY, MOCK_MARKETS } from "@/data/mockData";
import { CATEGORY_COLORS, fmtSign, fmtUSD } from "@/lib/utils";

const CATEGORY_PNL: { name: string; value: number }[] = [
  { name: "Economics", value: 400 },
  { name: "Crypto", value: 190 },
  { name: "Science", value: 240 },
];

export default function History() {
  const total = MOCK_HISTORY.reduce((a, h) => a + h.pnl, 0);
  const wins = MOCK_HISTORY.filter((h) => h.win).length;
  const winRate = (wins / MOCK_HISTORY.length) * 100;
  const avg = total / MOCK_HISTORY.length;

  // streaks
  let winStreak = 0, lossStreak = 0, curW = 0, curL = 0;
  MOCK_HISTORY.forEach((h) => {
    if (h.win) { curW++; curL = 0; winStreak = Math.max(winStreak, curW); }
    else { curL++; curW = 0; lossStreak = Math.max(lossStreak, curL); }
  });
  const maxDD = Math.min(...MOCK_HISTORY.map((h) => h.pnl));

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
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} icon={Target} color="#3b82f6" sub={`${wins} / ${MOCK_HISTORY.length} trades`} />
        <StatCard label="Total Trades" value={MOCK_HISTORY.length} icon={Activity} color="#8b5cf6" />
        <StatCard label="Avg Trade Size" value={fmtSign(Math.round(avg))} icon={DollarSign} color="#f59e0b" />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Cumulative P&L</h2>
          <span className="font-mono text-sm font-bold text-success">{fmtUSD(total)}</span>
        </div>
        <PerformanceChart data={MOCK_HISTORY} />
      </div>

      {/* Trade log */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Trade Log</h2>
        <TradeLogTable history={MOCK_HISTORY} markets={MOCK_MARKETS} />
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
