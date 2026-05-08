import { cn } from "@/lib/utils";
import type { UsageSummary } from "@/lib/oddsApiKeyManager";

export default function UsagePanel({ summary }: { summary: UsageSummary }) {
  const { totalRemaining, totalUsed, totalLimit, daysLeft, willLastUntilReset, recommendedInterval } = summary;
  const pct = Math.min(100, Math.round((totalUsed / totalLimit) * 100));
  const colorBar =
    totalRemaining > 400 ? "bg-success"
      : totalRemaining > 100 ? "bg-warning"
        : "bg-destructive";
  const colorText =
    totalRemaining > 400 ? "text-success"
      : totalRemaining > 100 ? "text-warning"
        : "text-destructive";

  return (
    <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">API Budget</span>
          <span className="text-[11px] font-mono text-muted-foreground">{totalUsed} / {totalLimit}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
          <div className={cn("h-full transition-all", colorBar)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-center">
        <div className={cn("text-sm font-bold", colorText)}>
          {totalRemaining} requests left
        </div>
        <div className="text-[11px] text-muted-foreground">
          Resets in {daysLeft} day{daysLeft === 1 ? "" : "s"}
        </div>
      </div>
      <div className="text-right space-y-0.5">
        <div className="text-xs font-semibold text-foreground">Scanning: {recommendedInterval}</div>
        <span className={cn(
          "inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          willLastUntilReset
            ? "border-success/40 bg-success/15 text-success"
            : "border-warning/40 bg-warning/15 text-warning",
        )}>
          {willLastUntilReset ? "On track" : "At risk — consider upgrading"}
        </span>
      </div>
    </div>
  );
}
