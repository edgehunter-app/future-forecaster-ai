import { Activity } from "lucide-react";
import type { Wallet } from "@/types";
import { cn, fmtUSD, fmtPct, TIER_COLORS } from "@/lib/utils";
import { scoreWallet } from "@/lib/walletScorer";

interface Props {
  wallet: Wallet;
  action?: React.ReactNode;
  className?: string;
}

export function WalletCard({ wallet, action, className }: Props) {
  const color = TIER_COLORS[wallet.tier];
  const score = scoreWallet(wallet);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20",
        className,
      )}
      style={{ backgroundImage: `radial-gradient(circle at top right, ${color}1f, transparent 60%)` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-mono text-xl font-bold"
          style={{ backgroundColor: `${color}26`, color, border: `1px solid ${color}40` }}
        >
          {wallet.tier}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground truncate">{wallet.label}</div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">{wallet.address}</div>
          <div className="text-[10px] mt-0.5 text-muted-foreground/80">Score: <span className="font-mono font-semibold text-muted-foreground">{score}</span></div>
        </div>
        {action}
      </div>

      {/* Metrics 2x3 */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Metric label="Win Rate" value={fmtPct(wallet.winRate)} color="hsl(var(--success))" />
        <Metric label="Sharpe" value={wallet.sharpe.toFixed(2)} color="hsl(var(--info))" />
        <Metric label="30d ROI" value={fmtPct(wallet.roi30d)} color="hsl(var(--purple))" />
        <Metric label="Volume" value={fmtUSD(wallet.totalVolume)} />
        <Metric label="Trades" value={String(wallet.recentTrades)} />
        <Metric label="Consistency" value={fmtPct(wallet.consistency)} />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" /> Last active: 2h ago
        </span>
        <button className="text-xs font-medium text-info hover:text-info/80 transition-colors">
          View Positions →
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card/70 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold" style={{ color: color ?? "hsl(var(--foreground))" }}>{value}</div>
    </div>
  );
}

import { memo as __memo } from "react";
export default __memo(WalletCard);
