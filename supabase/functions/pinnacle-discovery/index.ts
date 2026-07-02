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

    // Leagues
    const golfLeaguesR = await getJson(`${BASE}/list_of_league?sport_id=${golfId}`);
    const hrLeaguesR = await getJson(`${BASE}/list_of_league?sport_id=${hrId}`);
    const golfLeagues = (golfLeaguesR.body as any)?.results ?? [];
    const hrLeagues = (hrLeaguesR.body as any)?.results ?? [];
    console.log("[pinnacle] golf leagues count:", golfLeagues.length);
    console.log("[pinnacle] HR leagues count:", hrLeagues.length);
    out.golfLeagues = golfLeagues;
    out.hrLeagues = hrLeagues;

    // Sport-level events
    const golfEventsAll = await getJson(`${BASE}/list_of_events?sport_id=${golfId}`);
    const hrEventsAll = await getJson(`${BASE}/list_of_events?sport_id=${hrId}`);
    out.golfEventsSportLevel = {
      status: golfEventsAll.status,
      count: (golfEventsAll.body as any)?.results?.length ?? 0,
      preview: JSON.stringify(golfEventsAll.body).slice(0, 1500),
    };
    out.hrEventsSportLevel = {
      status: hrEventsAll.status,
      count: (hrEventsAll.body as any)?.results?.length ?? 0,
      preview: JSON.stringify(hrEventsAll.body).slice(0, 1500),
    };

    // Try events by league_id for first 3 golf leagues and first 3 HR leagues
    const leagueProbes: any[] = [];
    for (const lg of [...golfLeagues.slice(0, 5), ...hrLeagues.slice(0, 5)]) {
      const r = await getJson(`${BASE}/list_of_events?sport_id=${golfLeagues.includes(lg) ? golfId : hrId}&league_ids=${lg.id}`);
      const count = (r.body as any)?.results?.length ?? 0;
      leagueProbes.push({
        leagueId: lg.id,
        leagueName: lg.name,
        status: r.status,
        count,
        preview: JSON.stringify(r.body).slice(0, 800),
      });
    }
    out.leagueEventProbes = leagueProbes;
  } catch (err) {
    console.error("[pinnacle] error:", err);
    out.error = String(err);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});