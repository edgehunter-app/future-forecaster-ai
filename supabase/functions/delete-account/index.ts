import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // Validate the caller's JWT
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const email = (user.email ?? "").toLowerCase();
  if (email === "demo@edgehunter.net") {
    return json({ error: "The shared demo account cannot be deleted." }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Remove app data owned by this user first
  const tables = [
    "alerts_log",
    "bets",
    "suggestions",
    "tracked_wallets",
    "wallet_signal_cursors",
    "wallet_scan_run_users",
    "user_roles",
  ];
  const failures: string[] = [];
  for (const t of tables) {
    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error) failures.push(`${t}: ${error.message}`);
  }
  {
    const { error } = await admin.from("profiles").delete().eq("id", user.id);
    if (error) failures.push(`profiles: ${error.message}`);
  }
  // Never leave a deleted email on the complimentary-access allowlist
  if (email) {
    await admin.from("beta_tester_allowlist").delete().ilike("email", email);
  }

  // Finally delete the auth identity itself (hard delete)
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("[delete-account] auth delete failed", delErr.message, failures);
    return json({ error: `Could not delete account: ${delErr.message}` }, 500);
  }

  console.log("[delete-account] deleted user", user.id, failures.length ? { failures } : "");
  return json({ ok: true });
});
