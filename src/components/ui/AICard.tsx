import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper for any AI-generated content block.
 * Always renders with a purple left border to visually mark AI output.
 */
export default function AICard({
  children,
  className,
  tone = "purple",
}: {
  children: ReactNode;
  className?: string;
  tone?: "purple" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-card p-5 sm:p-6 shadow-sm",
        "border-l-2",
        tone === "purple" ? "border-l-purple" : "border-l-destructive",
        className,
      )}
    >
      {children}
    </div>
  );
}