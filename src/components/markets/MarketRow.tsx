import type { Market } from "@/types";
import Badge from "@/components/ui/Badge";
import { cn, fmtUSD, categoryColor } from "@/lib/utils";

interface Props { market: Market; }

export function MarketRow({ market: m }: Props) {
  const isUp = m.change24h >= 0;
  const changeColor = isUp ? "text-success" : "text-destructive";

  return (
    <div className="group grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 cursor-pointer transition-all hover:bg-card/70 hover:border-foreground/15 md:grid-cols-[1fr_280px_110px] md:items-center">
      {/* LEFT */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge color={categoryColor(m.category)} small>{m.category}</Badge>
          <span className="text-[11px] font-mono text-muted-foreground">Ends {m.endDate}</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{m.question}</h3>
      </div>

      {/* MIDDLE */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-success/80 font-semibold">YES</div>
          <div className="font-sans text-[22px] font-extrabold text-success leading-tight">{(m.yesPrice * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-destructive/80 font-semibold">NO</div>
          <div className="font-sans text-[22px] font-extrabold text-destructive leading-tight">{(m.noPrice * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="md:text-right">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">24h Volume</div>
        <div className="font-mono text-sm font-bold text-foreground">{fmtUSD(m.volume24h)}</div>
        <div className={cn("text-xs font-mono font-semibold mt-0.5", changeColor)}>
          {isUp ? "▲" : "▼"} {Math.abs(m.change24h * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

import { memo as __memo } from "react";
export default __memo(MarketRow);
