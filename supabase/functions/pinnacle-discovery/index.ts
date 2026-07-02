import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PINNACLE_KEY = Deno.env.get("PINNACLE_API_KEY");
  const HOST = "pinnalce-odds-fast-cheap-api.p.rapidapi.com";
  const BASE = `https://${HOST}`;
  const headers = {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": PINNACLE_KEY ?? "",
  };

  const out: Record<string, unknown> = { keyExists: !!PINNACLE_KEY };

  const getJson = async (url: string) => {
    const res = await fetch(url, { headers });
    const body = res.ok ? await res.json() : await res.text();
    console.log(`[pinnacle] ${url} => ${res.status}`);
    return { status: res.status, body };
  };

  try {
    // 1. Sports list
    const sports = await getJson(`${BASE}/list_of_sports`);
    out.sportsStatus = sports.status;
    const results = (sports.body as any)?.results ?? [];
    const golf = results.find((s: any) => /golf/i.test(s.name));
    const horseRacing = results.find((s: any) => /horse/i.test(s.name));
    const golfId = golf?.id;
    const hrId = horseRacing?.id;
    console.log("[pinnacle] golf ID:", golfId, "| horse racing ID:", hrId);
    out.golf = golf;
    out.horseRacing = horseRacing;

    // Probe multiple endpoint path variants against golf (sport_id=16)
    const pathVariants = [
      `/list_of_league?sport_id=${golfId}`,
      `/list_of_leagues?sport_id=${golfId}`,
      `/leagues?sport_id=${golfId}`,
      `/list_of_events?sport_id=${golfId}`,
      `/list_of_event?sport_id=${golfId}`,
      `/get_special_markets?sport_id=${golfId}`,
      `/get_markets?sport_id=${golfId}`,
      `/markets?sport_id=${golfId}`,
      `/kit/v1/leagues?sport_id=${golfId}`,
      `/kit/v1/markets?sport_id=${golfId}`,
      `/kit/v1/special-markets?sport_id=${golfId}`,
    ];
    const probes: any[] = [];
    for (const p of pathVariants) {
      const r = await getJson(`${BASE}${p}`);
      probes.push({
        path: p,
        status: r.status,
        preview: typeof r.body === "string" ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 400),
      });
    }
    out.probes = probes;
  } catch (err) {
    console.error("[pinnacle] error:", err);
    out.error = String(err);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});