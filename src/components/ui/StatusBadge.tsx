import { cn } from "@/lib/utils";

export type BadgeTone =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "purple"
  | "neutral";

export type BadgeSize = "xs" | "sm" | "md";

const TONES: Record<BadgeTone, string> = {
  success: "border-success/30 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/15 text-warning",
  destructive: "border-destructive/30 bg-destructive/15 text-destructive",
  info: "border-info/30 bg-info/15 text-info",
  purple: "border-purple/30 bg-purple/15 text-purple",
  neutral: "border-border bg-muted/50 text-muted-foreground",
};

const SIZES: Record<BadgeSize, string> = {
  xs: "px-1.5 py-px text-[8px] gap-1",
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-3 py-1 text-xs gap-1.5",
};

const DOTS: Record<BadgeSize, string> = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2.5 w-2.5",
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
  title?: string;
}

/**
 * The one badge system for status/meta chips (LIVE, league tags, gaps,
 * risk levels). Same corner radius, padding scale and font size everywhere;
 * color always carries meaning — never decoration.
 */
export default function StatusBadge({
  tone = "neutral",
  size = "sm",
  dot = false,
  className,
  children,
  title,
}: StatusBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide whitespace-nowrap",
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn("rounded-full", DOTS[size], TONES[tone].split(" ")[2])} />}
      {children}
    </span>
  );
}
