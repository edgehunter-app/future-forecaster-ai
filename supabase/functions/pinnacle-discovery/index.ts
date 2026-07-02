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

    // 2 + 3. Leagues
    if (golfId) {
      const r = await getJson(`${BASE}/list_of_leagues?sport_id=${golfId}`);
      console.log("[pinnacle] golf leagues:", JSON.stringify(r.body).slice(0, 1500));
      out.golfLeagues = r;
    }
    if (hrId) {
      const r = await getJson(`${BASE}/list_of_leagues?sport_id=${hrId}`);
      console.log("[pinnacle] HR leagues:", JSON.stringify(r.body).slice(0, 1500));
      out.hrLeagues = r;
    }

    // 4 + 5. Events (endpoint is /events per Pinnacle Odds RapidAPI docs)
    if (golfId) {
      const r = await getJson(`${BASE}/events?sport_id=${golfId}`);
      const count = (r.body as any)?.events?.length ?? (r.body as any)?.length ?? "unknown";
      console.log("[pinnacle] golf events count:", count);
      console.log("[pinnacle] golf events preview:", JSON.stringify(r.body).slice(0, 1500));
      out.golfEvents = { status: r.status, count, preview: JSON.stringify(r.body).slice(0, 2000) };
    }
    if (hrId) {
      const r = await getJson(`${BASE}/events?sport_id=${hrId}`);
      const count = (r.body as any)?.events?.length ?? (r.body as any)?.length ?? "unknown";
      console.log("[pinnacle] HR events count:", count);
      console.log("[pinnacle] HR events preview:", JSON.stringify(r.body).slice(0, 1500));
      out.hrEvents = { status: r.status, count, preview: JSON.stringify(r.body).slice(0, 2000) };
    }
  } catch (err) {
    console.error("[pinnacle] error:", err);
    out.error = String(err);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});