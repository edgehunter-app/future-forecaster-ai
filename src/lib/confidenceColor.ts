export type ConfidenceTier = "strong" | "moderate" | "weak";

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 65) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

export function getConfidenceColor(score: number): string {
  if (score >= 65) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function getConfidenceBg(score: number): string {
  if (score >= 65) return "#10b98115";
  if (score >= 50) return "#f59e0b15";
  return "#ef444415";
}

export function getConfidenceBorder(score: number): string {
  if (score >= 65) return "#10b98130";
  if (score >= 50) return "#f59e0b30";
  return "#ef444430";
}

export function getConfidenceLabel(score: number): string {
  if (score >= 65) return "Strong Signal";
  if (score >= 50) return "Moderate Signal";
  return "Weak Signal";
}

export function getConfidenceAction(score: number, direction: "YES" | "NO"): string {
  if (score >= 65) return `Propose ${direction}`;
  if (score >= 50) return `Caution — ${direction}`;
  return "Skip — weak signal";
}

import type { Market } from "@/types";

export function estimateMarketConfidence(market: Market): number {
  const volumeScore = Math.min((market.volume24h / 1_000_000) * 30, 30);
  const changeScore = Math.min(Math.abs(market.change24h) * 200, 25);
  const liquidityScore = Math.min((market.totalVolume / 5_000_000) * 25, 25);
  const end = Date.parse(market.endDate);
  const daysLeft = isNaN(end) ? 30 : Math.max((end - Date.now()) / 86_400_000, 0);
  const timeScore = daysLeft < 7 ? 20 : daysLeft < 30 ? 10 : 5;
  return Math.min(Math.round(volumeScore + changeScore + liquidityScore + timeScore), 100);
}
