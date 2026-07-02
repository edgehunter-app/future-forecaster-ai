import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PINNACLE_KEY = Deno.env.get("PINNACLE_API_KEY");
  const HOST = "pinnalce-odds-fast-cheap-api.p.rapidapi.com";
  const headers = {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": PINNACLE_KEY ?? "",
  };

  const variations = [
    `https://${HOST}/list_of_sports`,
    `https://${HOST}/sports`,
    `https://${HOST}/kit/v1/sports`,
  ];

  const out: Record<string, unknown> = { keyExists: !!PINNACLE_KEY, keyLength: PINNACLE_KEY?.length ?? 0 };
  const attempts: any[] = [];
  console.log("[pinnacle] key exists:", !!PINNACLE_KEY, "length:", PINNACLE_KEY?.length ?? 0);

  for (const url of variations) {
    try {
      const res = await fetch(url, { headers });
      console.log(`[pinnacle] ${url} => status ${res.status}`);
      const attempt: any = { url, status: res.status };
      if (res.ok) {
        const json = await res.json();
        const preview = JSON.stringify(json).slice(0, 500);
        console.log("[pinnacle] success preview:", preview);
        attempt.preview = preview;
        attempts.push(attempt);
        out.success = attempt;
        break;
      } else {
        const text = await res.text();
        console.log("[pinnacle] error body:", text.slice(0, 300));
        attempt.error = text.slice(0, 300);
        attempts.push(attempt);
      }
    } catch (err) {
      console.error(`[pinnacle] fetch error ${url}:`, err);
      attempts.push({ url, error: String(err) });
    }
  }
  out.attempts = attempts;

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});