import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";

export function useProfile() {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || isDemoMode) return;
    let cancel = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel || !data) return;
        updateSettings({
          bankroll: Number(data.bankroll),
          kellyMultiplier: Number(data.kelly_multiplier),
          maxPosition: Number(data.max_position),
          minConfidence: data.min_confidence,
          alertThreshold: data.alert_threshold,
          favoriteCategories: data.favorite_categories ?? [],
          alerts: {
            telegram: { enabled: data.telegram_enabled, chatId: data.telegram_chat_id },
            discord: { enabled: data.discord_enabled, webhookUrl: data.discord_webhook },
            email: {
              enabled: data.email_enabled,
              address: data.alert_email,
              frequency: data.email_frequency,
            },
          },
        });
      });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isDemoMode]);

  const saveProfile = async () => {
    if (!user || isDemoMode) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        bankroll: settings.bankroll,
        kelly_multiplier: settings.kellyMultiplier,
        max_position: settings.maxPosition,
        min_confidence: settings.minConfidence,
        alert_threshold: settings.alertThreshold,
        favorite_categories: settings.favoriteCategories,
        telegram_enabled: settings.alerts.telegram.enabled,
        telegram_chat_id: settings.alerts.telegram.chatId,
        discord_enabled: settings.alerts.discord.enabled,
        discord_webhook: settings.alerts.discord.webhookUrl,
        email_enabled: settings.alerts.email.enabled,
        alert_email: settings.alerts.email.address,
        email_frequency: settings.alerts.email.frequency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return { saveProfile, saving, saved };
}