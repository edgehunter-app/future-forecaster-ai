import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the currently signed-in user is the shared demo account.
 * Reads `profiles.is_demo` once per user session.
 */
export function useIsDemo(): boolean {
  const { user } = useAuth();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsDemo(false);
      return;
    }
    // Fast path: email match
    if (user.email?.toLowerCase() === "demo@edgehunter.net") {
      setIsDemo(true);
      return;
    }
    let cancel = false;
    supabase
      .from("profiles")
      .select("is_demo")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setIsDemo(Boolean((data as { is_demo?: boolean } | null)?.is_demo));
      });
    return () => { cancel = true; };
  }, [user?.id, user?.email]);

  return isDemo;
}