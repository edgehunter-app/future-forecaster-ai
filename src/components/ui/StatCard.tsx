import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color: string;
  trend?: "up" | "down";
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, color, trend, className }: Props) {
  const subColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(circle at top right, ${color}1f, transparent 60%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground">{value}</div>
      {sub && <div className={cn("mt-1 text-xs font-medium", subColor)}>{sub}</div>}
    </div>
  );
}

export default StatCard;
