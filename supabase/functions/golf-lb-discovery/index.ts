// One-off discovery probe for the Golf Leaderboard Data RapidAPI vendor.
// Enumerates candidate endpoints, prints status + response shape + quota
// headers so we can pick the right shape before wiring the real integration.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOLF_LB_KEY = Deno.env.get("GOLF_LEADERBOARD_API_KEY");
const GOLF_LB_BASE = "https://golf-leaderboard-data.p.rapidapi.com";
const golfLbHeaders = {
  "x-rapidapi-host": "golf-leaderboard-data.p.rapidapi.com",
  "x-rapidapi-key": GOLF_LB_KEY ?? "",
  "Content-Type": "application/json",
};

interface ProbeResult {
  endpoint: string;
  status: number | null;
  ok: boolean;
  remaining: string | null;
  monthlyRemaining: string | null;
  keys?: string[];
  preview?: string;
  error?: string;
}

async function probe(endpoint: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${GOLF_LB_BASE}${endpoint}`, {
      headers: golfLbHeaders,
      signal: AbortSignal.timeout(8_000),
    });
    const remaining = res.headers.get("x-ratelimit-requests-remaining");
    const monthlyRemaining = res.headers.get("x-ratelimit-monthly-requests-remaining");
    console.log(`[golf-lb] ${endpoint}: ${res.status}`);
    console.log(`[golf-lb] ${endpoint} remaining:`, remaining);
    console.log(`[golf-lb] ${endpoint} monthly remaining:`, monthlyRemaining);
    if (res.ok) {
      const json = await res.json();
      const sample = Array.isArray(json) ? (json[0] ?? {}) : json;
      const keys = sample && typeof sample === "object" ? Object.keys(sample) : [];
      const preview = JSON.stringify(json).slice(0, 500);
      console.log(`[golf-lb] ${endpoint} keys:`, keys);
      console.log(`[golf-lb] ${endpoint} preview:`, preview);
      return { endpoint, status: res.status, ok: true, remaining, monthlyRemaining, keys, preview };
    }
    const text = await res.text();
    console.log(`[golf-lb] ${endpoint} error:`, text.slice(0, 200));
    return {
      endpoint,
      status: res.status,
      ok: false,
      remaining,
      monthlyRemaining,
      error: text.slice(0, 400),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[golf-lb] ${endpoint} failed:`, msg);
    return {
      endpoint,
      status: null,
      ok: false,
      remaining: null,
      monthlyRemaining: null,
      error: msg,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[golf-lb] key exists:", !!GOLF_LB_KEY);
  if (!GOLF_LB_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "GOLF_LEADERBOARD_API_KEY not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const endpoints = [
    "/world-rankings",
    "/scorecard/220/101017",
    // tours / seasons enumeration
    "/tours",
    "/seasons",
    "/tours/2",
    "/tour/2/2026",
    "/tours/2/2026",
    // fixtures/schedule per tour+season (PGA=2, EUR=1 typical)
    "/fixtures/2/2026",
    "/fixtures/1/2026",
    "/schedule/2/2026",
    // leaderboard for known tournament id
    "/leaderboard/220",
    "/leaderboard/475",
    "/entry-list/220",
    "/players",
    "/players/220",
    "/tournament/220",
    "/statistics/2/2026",
    "/earnings/2/2026",
    "/race-to-dubai/1/2026",
    "/fedex-cup/2/2026",
    // sometimes vendors expose an index at /endpoints
    "/endpoints",
  ];

  const results: ProbeResult[] = [];
  for (const ep of endpoints) {
    results.push(await probe(ep));
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(
    JSON.stringify({ ok: true, keyPresent: true, results }, null, 2),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});