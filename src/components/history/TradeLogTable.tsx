import { Check, X } from "lucide-react";
import type { HistoryPoint, Market } from "@/types";
import Badge from "@/components/ui/Badge";
import { cn, fmtSign } from "@/lib/utils";

interface Props { history: HistoryPoint[]; markets: Market[]; }

export function TradeLogTable({ history, markets }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/60">
            {["Date", "Market", "Direction", "P&L", "Cumulative", "Result"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => {
            const m = markets[i % markets.length];
            const dir = i % 3 === 1 ? "NO" : "YES";
            const dirColor = dir === "YES" ? "#10b981" : "#ef4444";
            const isLast = i === history.length - 1;
            return (
              <tr key={i}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/40",
                  i % 2 === 1 && "bg-card/40",
                  isLast && "border-l-2 border-l-info",
                )}>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{h.date}</td>
                <td className="px-4 py-3 max-w-[280px] truncate text-foreground">{m.question}</td>
                <td className="px-4 py-3"><Badge color={dirColor} small>{dir}</Badge></td>
                <td className={cn("px-4 py-3 font-mono font-semibold", h.pnl >= 0 ? "text-success" : "text-destructive")}>
                  {fmtSign(h.pnl)}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">${h.cumulative}</td>
                <td className="px-4 py-3">
                  {h.win ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                      <Check className="h-3 w-3" /> Win
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                      <X className="h-3 w-3" /> Loss
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TradeLogTable;
