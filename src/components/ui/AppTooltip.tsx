import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-card transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="block max-w-xs whitespace-normal text-center">{content}</span>
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover" />
      </span>
    </span>
  );
}

export default Tooltip;
