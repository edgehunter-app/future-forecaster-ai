import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "info" | "success" | "warning" | "danger" | "purple" | "outline";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default: "bg-muted text-muted-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  purple: "bg-purple/15 text-purple border-purple/30",
  outline: "border-border text-foreground",
};

export function PillBadge({ variant = "default", className, ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export default PillBadge;