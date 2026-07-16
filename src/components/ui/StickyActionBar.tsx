import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom action bar. Sits 80px above the mobile tab bar,
 * full width minus 32px margin. Green gradient by default.
 */
export default function StickyActionBar({
  children,
  className,
  tone = "green",
}: {
  children: ReactNode;
  className?: string;
  tone?: "green" | "blue";
}) {
  return (
    <div
      className={cn(
        "fixed left-4 right-4 z-40 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[560px]",
        "rounded-2xl border border-white/10 shadow-2xl",
        "flex items-center justify-between gap-3 px-4 py-3",
        tone === "green"
          ? "bg-gradient-action-bar text-white"
          : "bg-gradient-cta text-white",
        className,
      )}
      style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
      role="region"
      aria-label="Quick action"
    >
      {children}
    </div>
  );
}