import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: number;
  hint?: string;
  accent?: "info" | "success" | "warning" | "danger" | "purple";
  className?: string;
}

const accents = {
  info: "text-info bg-info/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-destructive bg-destructive/10",
  purple: "text-purple bg-purple/10",
} as const;

export function StatCard({ icon: Icon, label, value, trend, hint, accent = "info", className }: Props) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", accents[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", isUp ? "text-success" : "text-destructive")}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export default StatCard;
