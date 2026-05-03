import { Link } from "react-router-dom";
import { Lightbulb, Wallet as WalletIcon, BarChart2, TrendingUp, Zap, LineChart, Star, GitCompare, ArrowRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import SuggestionCard from "@/components/suggestions/SuggestionCard";
import SafetyBanner from "@/components/ui/SafetyBanner";
import { MOCK_SUGGESTIONS, MOCK_WALLETS, MOCK_MARKETS, MOCK_HISTORY } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";
import { fmtUSD, cn } from "@/lib/utils";
import { useCrossMarket } from "@/hooks/useCrossMarket";

const TIER_COLORS: Record<string, string> = {
  S: "#f59e0b",
  A: "#10b981",
  B: "#3b82f6",
  C: "#6b7280",
};

export default function Dashboard() {
  const bankroll = useAppStore((s) => s.settings.bankroll);

  const totalPnl = MOCK_HISTORY.reduce((acc, h) => acc + h.pnl, 0);
  const wins = MOCK_HISTORY.filter((h) => h.win).length;
  const losses = MOCK_HISTORY.length - wins;
  const winRate = (wins / MOCK_HISTORY.length) * 100;
  const maxAbs = Math.max(...MOCK_HISTORY.map((h) => Math.abs(h.pnl)));

  return (
    <div className="space-y-6">
      <SafetyBanner />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Suggestions" value={MOCK_SUGGESTIONS.length} icon={Lightbulb} color="#8b5cf6" sub="Ready to review" />
        <StatCard label="Tracked Wallets" value={MOCK_WALLETS.length} icon={WalletIcon} color="#3b82f6" sub="Smart money" />
        <StatCard label="Monitored Markets" value={MOCK_MARKETS.length} icon={BarChart2} color="#06b6d4" sub="Live polling" />
        <StatCard label="7-Day P&L" value={fmtUSD(totalPnl, { compact: true })} icon={TrendingUp} color="#10b981" trend="up" sub={`+${(totalPnl / bankroll * 100).toFixed(1)}% of bankroll`} />
      </div>

      {/* Two-column row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column 60% */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Suggestions</h2>
          </div>
          <div className="space-y-4">
            {MOCK_SUGGESTIONS.slice(0, 2).map((s) => (
              <SuggestionCard key={s.id} suggestion={s} bankroll={bankroll} />
            ))}
          </div>
        </div>

        {/* Right column 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance card */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="h-4 w-4 text-success" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">7-Day Performance</h2>
            </div>
            <div className="font-mono text-3xl font-bold text-success">{fmtUSD(totalPnl)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              <span className="text-success font-medium">{wins} wins</span> · <span className="text-destructive font-medium">{losses} losses</span>
            </div>

            {/* Mini bar chart */}
            <div className="mt-5">
              <svg viewBox="0 0 240 80" className="w-full h-20" preserveAspectRatio="none">
                {MOCK_HISTORY.map((h, i) => {
                  const colW = 240 / MOCK_HISTORY.length;
                  const barW = colW * 0.55;
                  const x = i * colW + (colW - barW) / 2;
                  const maxBarH = 36;
                  const barH = (Math.abs(h.pnl) / maxAbs) * maxBarH;
                  const midY = 40;
                  const y = h.pnl >= 0 ? midY - barH : midY;
                  return (
                    <g key={h.date}>
                      <rect x={x} y={y} width={barW} height={barH} rx={2}
                        fill={h.win ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                      <text x={x + barW / 2} y={76} textAnchor="middle" fontSize="8"
                        fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{h.date}</text>
                    </g>
                  );
                })}
                <line x1="0" y1="40" x2="240" y2="40" stroke="hsl(var(--border))" strokeDasharray="2 2" />
              </svg>
            </div>

            {/* Bottom stats */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <MiniStat label="Win Rate" value={`${winRate.toFixed(1)}%`} color="hsl(var(--success))" />
              <MiniStat label="Avg Edge" value="+10.3%" color="hsl(var(--success))" />
              <MiniStat label="Sharpe" value="1.84" color="hsl(var(--info))" />
            </div>
          </div>

          {/* Top wallets */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Wallets</h2>
            </div>
            <ul className="space-y-2">
              {MOCK_WALLETS.slice(0, 3).map((w) => {
                const c = TIER_COLORS[w.tier];
                return (
                  <li key={w.address} className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 p-2.5">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold"
                      style={{ backgroundColor: `${c}26`, color: c, border: `1px solid ${c}40` }}
                    >
                      {w.tier}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{w.label}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">{w.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Win</div>
                      <div className="font-mono text-sm font-semibold text-success">{(w.winRate * 100).toFixed(0)}%</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Cross-market opportunities */}
      <CrossMarketStrip />
    </div>
  );
}

function CrossMarketStrip() {
  const { opportunities, loading } = useCrossMarket();
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Cross-Market Opportunities</h2>
        <Link to="/cross-market" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {loading && opportunities.length === 0 ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 min-w-[280px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No opportunities detected
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {opportunities.map((o) => {
            const spreadPct = o.spread * 100;
            const hi = spreadPct >= 10;
            return (
              <Link to="/cross-market" key={o.question}
                className="min-w-[280px] max-w-[320px] flex-1 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
                <div className="text-xs font-semibold text-foreground line-clamp-2 min-h-[32px]">{o.question}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                    hi ? "border-success/40 bg-success/15 text-success" : "border-warning/40 bg-warning/15 text-warning",
                  )}>{spreadPct.toFixed(1)}%</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Poly {(o.polyYes * 100).toFixed(0)}% · Kalshi {(o.kalshiYes * 100).toFixed(0)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
