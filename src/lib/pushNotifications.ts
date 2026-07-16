import { PushNotifications } from "@capacitor/push-notifications";
import { isNative } from "./platform";
import { supabase } from "@/integrations/supabase/client";

async function savePushToken(token: string) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    // Best-effort: store on profile if a column exists.
    await supabase.from("profiles").update({ push_token: token } as never).eq("id", userId);
  } catch (err) {
    console.warn("[push] savePushToken failed:", err);
  }
}

export async function subscribeToPush(): Promise<void> {
  if (!isNative) {
    // Web push (PWA) path — no-op for now; the web install flow handles this.
    return;
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token) => {
    console.log("[push] native token:", token.value);
    void savePushToken(token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] registration error:", err);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push] received:", notification);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[push] action:", action);
    const url = (action.notification.data as { url?: string } | undefined)?.url ?? "/";
    window.location.href = url;
  });
}