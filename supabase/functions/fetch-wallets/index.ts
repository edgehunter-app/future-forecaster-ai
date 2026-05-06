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
    const { limit = 20 } = await req.json().catch(() => ({}));
    const endpoints = [
      `https://data-api.polymarket.com/profiles?limit=${limit}&sortBy=profitLoss&sortDirection=DESC`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=allTime`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=1m`,
      `https://gamma-api.polymarket.com/profiles?limit=${limit}&order=profit`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "EdgeHunter/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        console.log("Wallet endpoint:", url, "status:", res.status);
        if (res.ok) {
          const data = await res.json();
          const profiles = Array.isArray(data)
            ? data
            : data.profiles ?? data.data ?? data.leaderboard ?? [];
          console.log("Profiles found:", profiles.length);
          if (profiles.length > 0) {
            return new Response(
              JSON.stringify({ profiles, source: "live", endpoint: url }),
              { headers: CORS_HEADERS },
            );
          }
        }
      } catch (err) {
        console.warn("Wallet endpoint failed:", url, String(err));
        continue;
      }
    }

    return new Response(
      JSON.stringify({ profiles: [], source: "empty" }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("fetch-wallets error:", err);
    return new Response(
      JSON.stringify({ error: String(err), profiles: [] }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
});