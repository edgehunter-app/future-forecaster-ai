import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  color: string;
  small?: boolean;
  className?: string;
}

export function Badge({ children, color, small, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono uppercase tracking-tight font-medium",
        small ? "px-1.5 py-[1px] text-[10px]" : "px-2 py-0.5 text-[11px]",
        className,
      )}
      style={{
        backgroundColor: `${color}21`,
        borderColor: `${color}40`,
        color,
      }}
    >
      {children}
    </span>
  );
}

export default Badge;
