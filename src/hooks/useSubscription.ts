import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Tier = "free" | "pro" | "elite";

export function useSubscription() {
  const { user } = useAuth();
  const [tier, setTier] = useState<Tier>("free");
  const [status, setStatus] = useState<string>("inactive");
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [isBeta, setIsBeta] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialJustExpired, setTrialJustExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTier("free");
      setStatus("inactive");
      setIsBeta(false);
      setStripeSubscriptionId(null);
      setIsTrialActive(false);
      setTrialDaysRemaining(0);
      setTrialEndsAt(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "subscription_tier, subscription_status, stripe_subscription_id, is_beta_tester, is_trial, trial_started_at, trial_ends_at, is_demo",
      )
      .eq("id", user.id)
      .maybeSingle();
    const t = (data?.subscription_tier as Tier) ?? "free";
    const s = data?.subscription_status ?? "inactive";

    const trialEnd = data?.trial_ends_at ? new Date(data.trial_ends_at) : null;
    const rawTrial =
      !!data?.is_trial &&
      s === "trial" &&
      !data?.is_beta_tester &&
      !data?.is_demo;
    const trialActive = !!(rawTrial && trialEnd && trialEnd.getTime() > Date.now());
    const trialExpired = !!(rawTrial && trialEnd && trialEnd.getTime() <= Date.now());

    let effectiveTier: Tier = t;
    let effectiveStatus = s;

    if (trialExpired) {
      await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_status: "inactive",
          is_trial: false,
        })
        .eq("id", user.id);
      effectiveTier = "free";
      effectiveStatus = "inactive";
      try {
        const seenKey = `eh_trial_expired_seen_${user.id}`;
        if (!localStorage.getItem(seenKey)) {
          setTrialJustExpired(true);
          localStorage.setItem(seenKey, "1");
        }
      } catch {
        // ignore
      }
    }

    setStatus(effectiveStatus);
    setStripeSubscriptionId(data?.stripe_subscription_id ?? null);
    setIsBeta(!!data?.is_beta_tester || (effectiveTier === "elite" && !data?.stripe_subscription_id));
    const granted =
      effectiveStatus === "active" ||
      data?.is_beta_tester ||
      trialActive;
    setTier(granted ? effectiveTier : "free");
    setIsTrialActive(trialActive);
    setTrialEndsAt(data?.trial_ends_at ?? null);
    setTrialDaysRemaining(
      trialActive && trialEnd
        ? Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
        : 0,
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isPro = tier === "pro" || tier === "elite" || isTrialActive;
  const isElite = tier === "elite";

  const upgrade = async (priceId: string, tierName: Tier) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId, tier: tierName },
    });
    if (error) throw error;
    if (data?.url) window.location.href = data.url;
  };

  const openBillingPortal = async () => {
    const { data, error } = await supabase.functions.invoke("billing-portal");
    if (error) throw error;
    if (data?.url) window.location.href = data.url;
  };

  return {
    tier,
    status,
    isPro,
    isElite,
    isBeta,
    isTrialActive,
    trialDaysRemaining,
    trialEndsAt,
    trialJustExpired,
    dismissTrialExpired: () => setTrialJustExpired(false),
    stripeSubscriptionId,
    loading,
    upgrade,
    openBillingPortal,
    refresh,
  };
}