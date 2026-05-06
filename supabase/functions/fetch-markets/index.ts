const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { limit = 20, active = true } = await req.json().catch(() => ({}));
    const endpoints = [
      `https://gamma-api.polymarket.com/markets?limit=${limit}&active=${active}&order=volume24hr&ascending=false`,
      `https://gamma-api.polymarket.com/markets?limit=${limit}&closed=false`,
      `https://gamma-api.polymarket.com/markets?limit=${limit}`,
      `https://clob.polymarket.com/markets?limit=${limit}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "EdgeHunter/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        console.log("Markets endpoint:", url, "status:", res.status);
        if (res.ok) {
          const data = await res.json();
          const markets = Array.isArray(data)
            ? data
            : data.markets ?? data.data ?? [];
          if (markets.length > 0) {
            return new Response(
              JSON.stringify({ markets, source: "live", endpoint: url }),
              { headers: CORS_HEADERS },
            );
          }
        }
      } catch (err) {
        console.warn("Markets endpoint failed:", url, String(err));
        continue;
      }
    }

    return new Response(
      JSON.stringify({ markets: [], source: "empty" }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("fetch-markets error:", err);
    return new Response(
      JSON.stringify({ error: String(err), markets: [] }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
});