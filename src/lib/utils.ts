import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtUSD(value: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
      style: "currency",
      currency: "USD",
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtSign(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function tierColor(tier: "S" | "A" | "B" | "C"): string {
  switch (tier) {
    case "S": return "bg-purple/15 text-purple border-purple/30";
    case "A": return "bg-info/15 text-info border-info/30";
    case "B": return "bg-success/15 text-success border-success/30";
    case "C": return "bg-muted text-muted-foreground border-border";
  }
}

export function categoryColor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("politic")) return "bg-info/15 text-info border-info/30";
  if (c.includes("crypto")) return "bg-warning/15 text-warning border-warning/30";
  if (c.includes("sport")) return "bg-success/15 text-success border-success/30";
  if (c.includes("econ")) return "bg-purple/15 text-purple border-purple/30";
  if (c.includes("culture") || c.includes("entertain")) return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}