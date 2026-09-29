import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Admin only" }, 403);

  const body = await req.json();
  const { email, password } = body;
  // TEMP test hook: recovery link for throwaway test accounts only
  if (body.action === "recovery_link" && String(email).endsWith("@edgehunter-test.dev")) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: body.redirectTo } });
    if (error) return json({ error: error.message }, 400);
    return json({ link: data.properties.action_link });
  }
  if (!email || !password || String(password).length < 8) return json({ error: "email and password (8+) required" }, 400);

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return json({ error: error.message }, 400);
  const id = data.user.id;
  await admin.from("profiles").upsert({
    id, subscription_tier: "elite", subscription_status: "active", is_beta_tester: true,
    is_trial: false, trial_started_at: null, trial_ends_at: null, subscription_ends_at: null,
  });
  return json({ ok: true, user_id: id });
});
