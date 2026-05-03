import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0-100
  size?: "sm" | "md";
  className?: string;
}

function colorFor(v: number) {
  if (v >= 75) return "hsl(var(--success))";
  if (v >= 55) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

export function ConfidenceBar({ value, size = "md", className }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const color = colorFor(v);
  const h = size === "sm" ? "h-1" : "h-2";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex-1 overflow-hidden rounded-full bg-muted", h)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out")}
          style={{ width: `${v}%`, backgroundColor: color }}
        />
      </div>
      <span
        className={cn("font-mono font-semibold tabular-nums", size === "sm" ? "text-xs" : "text-sm")}
        style={{ color }}
      >
        {v.toFixed(0)}%
      </span>
    </div>
  );
}

export default ConfidenceBar;
