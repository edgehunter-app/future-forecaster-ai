import { supabase } from "@/integrations/supabase/client";

const KEY = "eh_pw_recovery";

// Capture at module load, before the auth client strips the URL hash.
try {
  const h = window.location.hash + window.location.search;
  if (/type=recovery/.test(h) || window.location.pathname === "/reset-password") {
    sessionStorage.setItem(KEY, "1");
  }
} catch { /* ignore */ }

supabase.auth.onAuthStateChange((evt) => {
  if (evt === "PASSWORD_RECOVERY") {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("eh-recovery"));
  }
});

export const isRecovery = () => {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
};
export const clearRecovery = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};
