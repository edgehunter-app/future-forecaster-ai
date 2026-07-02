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

  const paths = [
    "/get_special_markets",
    "/special_markets",
    "/list_of_special",
    "/get_special",
    "/outrights",
    "/get_odds",
    "/get_event_details",
    "/list_of_special_markets",
    "/specials",
    "/get_specials",
    "/kit/v1/special",
    "/kit/v1/specials",
    "/kit/v1/outrights",
  ];

  const probes: any[] = [];
  try {
    for (const path of paths) {
      try {
        const res = await fetch(`${BASE}${path}`, { headers });
        let bodyPreview = "";
        if (res.ok) {
          const json = await res.json();
          bodyPreview = JSON.stringify(json).slice(0, 400);
          console.log(`[pinnacle-probe] ${path} => ${res.status} SUCCESS:`, bodyPreview);
        } else {
          bodyPreview = (await res.text()).slice(0, 200);
          console.log(`[pinnacle-probe] ${path} => ${res.status}:`, bodyPreview);
        }
        probes.push({ path, status: res.status, preview: bodyPreview });
      } catch (err) {
        console.log(`[pinnacle-probe] ${path} failed:`, err);
        probes.push({ path, error: String(err) });
      }
      await new Promise((r) => setTimeout(r, 200));
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