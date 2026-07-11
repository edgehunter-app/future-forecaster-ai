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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTier("free");
      setStatus("inactive");
      setIsBeta(false);
      setStripeSubscriptionId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_status, stripe_subscription_id, is_beta_tester")
      .eq("id", user.id)
      .maybeSingle();
    const t = (data?.subscription_tier as Tier) ?? "free";
    const s = data?.subscription_status ?? "inactive";
    setStatus(s);
    setStripeSubscriptionId(data?.stripe_subscription_id ?? null);
    setIsBeta(!!data?.is_beta_tester || (t === "elite" && !data?.stripe_subscription_id));
    setTier(s === "active" || data?.is_beta_tester ? t : "free");
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isPro = tier === "pro" || tier === "elite";
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
    stripeSubscriptionId,
    loading,
    upgrade,
    openBillingPortal,
    refresh,
  };
}