import { cn } from "@/lib/utils";

interface Props {
  value: number;
  showLabel?: boolean;
  className?: string;
}

function colorFor(v: number) {
  if (v >= 0.75) return "bg-success";
  if (v >= 0.55) return "bg-info";
  if (v >= 0.4) return "bg-warning";
  return "bg-destructive";
}

export function ConfidenceBar({ value, showLabel = true, className }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-1">
        {showLabel && <span className="text-xs text-muted-foreground">Confidence</span>}
        {showLabel && <span className="text-xs font-mono font-medium text-foreground">{pct.toFixed(0)}%</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", colorFor(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ConfidenceBar;
