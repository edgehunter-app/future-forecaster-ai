import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { bumpAnalysis } from "@/lib/analysisCounter";
import { useIsDemo } from "@/hooks/useIsDemo";
import {
  DEMO_CLAUDE_LIMIT,
  getDemoClaudeCalls,
  incDemoClaudeCalls,
  openDemoGate,
} from "@/lib/demoGate";

export type AnalysisType =
  | "market"
  | "kalshi"
  | "sports"
  | "prop"
  | "cross-market"
  | "daily-briefing"
  | "sentiment"
  | "wallet-strategy";

/**
 * Universal Claude analysis hook keyed by string ID.
 * Edge function returns parsed JSON directly (not Anthropic content blocks).
 */
export function useAIAnalysis() {
  const settings = useAppStore((s) => s.settings);
  const trackedWallets = useAppStore((s) => s.trackedWallets ?? []);
  const isDemo = useIsDemo();

  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const analyze = useCallback(
    async (key: string, type: AnalysisType, params: Record<string, any>) => {
      if (analyzing[key]) return null;
      if (isDemo && getDemoClaudeCalls() >= DEMO_CLAUDE_LIMIT) {
        openDemoGate(
          `You've used ${DEMO_CLAUDE_LIMIT} free analyses in demo. Sign up for unlimited access.`,
        );
        setErrors((p) => ({ ...p, [key]: `Demo limit reached (${DEMO_CLAUDE_LIMIT} analyses)` }));
        return null;
      }
      setAnalyzing((p) => ({ ...p, [key]: true }));
      setErrors((p) => ({ ...p, [key]: "" }));
      try {
        const maxPosition = settings.bankroll * (settings.maxPosition ?? 0.05);
        const body: Record<string, any> = {
          type,
          ...params,
          bankroll: params.bankroll ?? settings.bankroll,
          kellyMultiplier: params.kellyMultiplier ?? settings.kellyMultiplier,
          maxPositionPct: params.maxPositionPct ?? (settings.maxPosition * 100),
          maxPosition: params.maxPosition ?? maxPosition,
          minConfidence: params.minConfidence ?? settings.minConfidence,
        };
        if (!body.wallets) {
          body.wallets = trackedWallets
            .filter((w) => w.tier === "S" || w.tier === "A")
            .slice(0, 5)
            .map((w) => ({ label: w.label, tier: w.tier, winRate: w.winRate, sharpe: w.sharpe }));
        }
        const { data, error } = await supabase.functions.invoke("analyze-market", { body });
        if (error) throw error;
        if (data?.code) {
          throw new Error(
            data.code === "UPSTREAM_ERROR" && data.upstreamStatus === 529
              ? "Claude is busy — try again in 30 seconds"
              : data.error ?? "Analysis failed",
          );
        }
        if (!data || typeof data !== "object") throw new Error("Invalid analysis response");

        // Apply safety caps to numeric fields when present
        const cap = Math.round(maxPosition);
        if (typeof data.suggestedAmount === "number") {
          data.suggestedAmount = Math.min(Math.round(data.suggestedAmount), cap);
        }
        if (typeof data.confidence === "number") {
          data.confidence = Math.max(0, Math.min(100, Math.round(data.confidence)));
        }
        if (Array.isArray(data.tips)) {
          for (const t of data.tips) {
            if (typeof t.suggestedAmount === "number") {
              t.suggestedAmount = Math.min(Math.round(t.suggestedAmount), cap);
            }
            if (typeof t.confidence === "number") {
              t.confidence = Math.max(0, Math.min(100, Math.round(t.confidence)));
            }
          }
        }

        setResults((p) => ({ ...p, [key]: data }));
        bumpAnalysis(type);
        if (isDemo) incDemoClaudeCalls();
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analysis failed";
        setErrors((p) => ({ ...p, [key]: msg }));
        return null;
      } finally {
        setAnalyzing((p) => ({ ...p, [key]: false }));
      }
    },
    [analyzing, settings, trackedWallets, isDemo],
  );

  const clear = useCallback((key: string) => {
    setResults((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }, []);

  return {
    analyze,
    clear,
    isAnalyzing: (k: string) => !!analyzing[k],
    getResult: (k: string) => results[k] ?? null,
    getError: (k: string) => errors[k] ?? "",
  };
}