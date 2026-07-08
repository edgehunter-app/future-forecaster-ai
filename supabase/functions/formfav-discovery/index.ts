// Temporary FormFav API discovery probe. Enumerates US horse racing
// endpoints so we can wire the real integration afterwards.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORMFAV_KEY = Deno.env.get("FORMFAV_API_KEY");
const FORMFAV_BASE = "https://api.formfav.com/v1";

async function hit(url: string, label: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": FORMFAV_KEY ?? "",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    console.log(`[formfav] ${label}:`, res.status);
    if (res.ok) {
      const json = await res.json();
      const keys = Array.isArray(json) ? `array(len=${json.length})` : Object.keys(json).join(",");
      console.log(`[formfav] ${label} SUCCESS keys:`, keys);
      console.log(`[formfav] ${label} preview:`, JSON.stringify(json).slice(0, 800));
      return { status: res.status, ok: true, keys, preview: JSON.stringify(json).slice(0, 800) };
    }
    const text = await res.text();
    console.log(`[formfav] ${label} error:`, text.slice(0, 200));
    return { status: res.status, ok: false, error: text.slice(0, 200) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[formfav] ${label} failed:`, msg);
    return { status: 0, ok: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[formfav] key exists:", !!FORMFAV_KEY);
  const today = new Date().toISOString().split("T")[0];
  console.log("[formfav] testing date:", today);

  const results: Record<string, unknown> = { key_present: !!FORMFAV_KEY, date: today, tracks: {} };

  const usTracks = [
    "churchill-downs",
    "saratoga",
    "belmont-park",
    "santa-anita",
    "del-mar",
    "gulfstream-park",
    "oaklawn-park",
    "keeneland",
    "monmouth-park",
    "ellis-park",
  ];

  // Step 1: per-track /form with race_code=gallops
  for (const track of usTracks) {
    const url = `${FORMFAV_BASE}/form?date=${today}&track=${track}&race=1&country=us&race_code=gallops`;
    const r = await hit(url, `form ${track} (gallops)`);
    (results.tracks as Record<string, unknown>)[track] = r;
    if (r.ok) break;
    await new Promise((res) => setTimeout(res, 300));
  }

  // Step 2: /form without race_code
  results.no_race_code = await hit(
    `${FORMFAV_BASE}/form?date=${today}&track=churchill-downs&race=1&country=us`,
    "form churchill-downs (no race_code)",
  );

  // Step 3: /tracks
  results.tracks_endpoint = await hit(`${FORMFAV_BASE}/tracks?country=us`, "tracks?country=us");

  // Step 4: /meetings
  results.meetings_endpoint = await hit(
    `${FORMFAV_BASE}/meetings?country=us&date=${today}`,
    `meetings?country=us&date=${today}`,
  );

  // Bonus: probe a few likely sibling paths so we can see what exists
  const extras = [
    "/races",
    "/racecards",
    "/schedule",
    "/countries",
    "/sports",
    "/openapi.json",
    "/docs",
    "/health",
    "/form",
    "/results",
    "/entries",
  ];
  const extra: Record<string, unknown> = {};
  for (const p of extras) {
    // /openapi.json is served at the root, not under /v1
    const base = p === "/openapi.json" || p === "/docs" || p === "/health"
      ? "https://api.formfav.com"
      : FORMFAV_BASE;
    extra[p] = await hit(`${base}${p}`, `probe ${p}`);
    await new Promise((res) => setTimeout(res, 200));
  }
  results.extra_probes = extra;

  // Try recent Saratoga dates (meet runs mid-Jul to early-Sep). Also try a
  // 2025 date as a historical sanity check.
  const dateTries = ["2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19", "2025-08-02"];
  const dateResults: Record<string, unknown> = {};
  for (const d of dateTries) {
    dateResults[`saratoga_${d}`] = await hit(
      `${FORMFAV_BASE}/form?date=${d}&track=saratoga&race=1&country=us`,
      `saratoga ${d}`,
    );
    await new Promise((res) => setTimeout(res, 200));
  }
  results.date_tries = dateResults;

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});