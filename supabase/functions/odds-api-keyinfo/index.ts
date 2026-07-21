// Admin-only diagnostic: returns masked tails of ODDS_API_KEY(s) plus a live
// probe against The Odds API so we can tell whether the runtime keys match
// the ones shown in the provider dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mask(key: string | undefined): { present: boolean; length: number; tail: string; head: string } {
  if (!key) return { present: false, length: 0, tail: "", head: "" };
  const trimmed = key.trim();
  return {
    present: true,
    length: trimmed.length,
    head: trimmed.slice(0, 4),
    tail: trimmed.slice(-6),
  };
}

async function probe(key: string | undefined) {
  if (!key) return { ok: false, status: null, remaining: null, used: null, code: null, message: "missing" };
  // /v4/sports is documented as not counting against usage quota.
  const url = `https://api.the-odds-api.com/v4/sports?apiKey=${encodeURIComponent(key.trim())}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    let code: string | null = null;
    let message: string | null = null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      try {
        const parsed = JSON.parse(body);
        code = parsed?.error_code ?? null;
        message = parsed?.message ?? body.slice(0, 200);
      } catch {
        message = body.slice(0, 200);
      }
    }
    return { ok: res.ok, status: res.status, remaining, used, code, message };
  } catch (e) {
    return { ok: false, status: null, remaining: null, used: null, code: "NETWORK_ERROR", message: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const k1 = Deno.env.get("ODDS_API_KEY");
    const p1 = await probe(k1);

    return new Response(
      JSON.stringify({
        primary: { ...mask(k1), probe: p1 },
        checkedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});