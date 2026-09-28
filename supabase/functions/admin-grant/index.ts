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

  const { action, email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") return json({ error: "email required" }, 400);
  const fn = action === "admin" ? "grant_admin_by_email" : action === "beta" ? "grant_beta_tester_by_email" : null;
  if (!fn) return json({ error: "invalid action" }, 400);

  const { data, error } = await admin.rpc(fn, { _email: email, _caller_id: user.id });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});
