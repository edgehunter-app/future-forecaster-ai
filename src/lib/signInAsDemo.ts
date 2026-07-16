import { supabase } from "@/integrations/supabase/client";

export const DEMO_EMAIL = "demo@edgehunter.net";
export const DEMO_PASSWORD = "EdgeHunter2026!";

/**
 * Logs the user in as the shared demo account. Provisions the demo user via
 * the `ensure-demo-user` edge function on first attempt if it doesn't exist yet.
 */
export async function signInAsDemo(): Promise<void> {
  const first = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (!first.error) return;

  // Provision + retry
  const { error: fnError } = await supabase.functions.invoke("ensure-demo-user", { body: {} });
  if (fnError) throw fnError;

  const retry = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (retry.error) throw retry.error;
}