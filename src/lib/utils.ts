import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIER_COLORS = {
  S: "#f59e0b",
  A: "#10b981",
  B: "#3b82f6",
  C: "#8b5cf6",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Economics: "#0ea5e9",
  Crypto: "#f97316",
  Science: "#8b5cf6",
  Finance: "#10b981",
  Politics: "#ef4444",
};

export function fmtUSD(n: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (opts.compact === false) {
    return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtPct0(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmtSign(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function tierColor(tier: keyof typeof TIER_COLORS): string {
  return TIER_COLORS[tier];
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#6b7280";
}
