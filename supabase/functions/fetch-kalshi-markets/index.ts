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

  const { limit = 20 } = await req.json().catch(() => ({}));

  const endpoints = [
    `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}&status=open`,
    `https://trading-api.kalshi.com/trade-api/v2/markets?limit=${limit}&status=open`,
    `https://trading-api.kalshi.com/trade-api/v2/markets?limit=${limit}`,
    `https://api.elections.kalshi.com/trade-api/v2/events?limit=${limit}&status=open`,
  ];

  for (const url of endpoints) {
    try {
      console.log("Trying Kalshi:", url);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "EdgeHunter/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      console.log("Kalshi status:", res.status, "for", url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("Kalshi non-ok body preview:", text.slice(0, 200));
        continue;
      }
      const data = await res.json();
      console.log("Kalshi keys:", Object.keys(data));
      const markets = data.markets ?? data.events ?? data.data ?? [];
      console.log("Kalshi markets found:", markets.length);
      if (markets.length > 0) {
        console.log("Sample:", JSON.stringify(markets[0]).slice(0, 250));
        return new Response(
          JSON.stringify({ markets, source: "live", endpoint: url }),
          { status: 200, headers: CORS_HEADERS },
        );
      }
    } catch (err) {
      console.warn("Kalshi endpoint failed:", url, String(err));
      continue;
    }
  }

  return new Response(
    JSON.stringify({ markets: [], source: "empty" }),
    { status: 200, headers: CORS_HEADERS },
  );
});