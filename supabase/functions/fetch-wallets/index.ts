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
      `https://data-api.polymarket.com/profiles?limit=${limit}&sortBy=volume&sortDirection=DESC`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=allTime`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=1m`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}&window=1w`,
      `https://gamma-api.polymarket.com/profiles?limit=${limit}&order=profit`,
      `https://gamma-api.polymarket.com/users?limit=${limit}&order=volume`,
    ];

    const attempts: { url: string; status: number; preview: string }[] = [];
    for (const url of endpoints) {
      try {
        console.log("Trying:", url);
        const res = await fetch(url, {
          headers: { "User-Agent": "EdgeHunter/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        console.log("Status:", res.status);
        const text = await res.text();
        const preview = text.slice(0, 300);
        console.log("Response preview:", preview);
        attempts.push({ url, status: res.status, preview });
        if (res.ok) {
          let data: any;
          try { data = JSON.parse(text); } catch { continue; }
          const profiles = Array.isArray(data)
            ? data
            : data.profiles ?? data.data ?? data.leaderboard ?? data.users ?? [];
          console.log("Profiles found:", profiles.length);
          if (profiles.length > 0) {
            return new Response(
              JSON.stringify({ profiles, source: "live", endpoint: url, attempts }),
              { headers: CORS_HEADERS },
            );
          }
        }
      } catch (err) {
        console.warn("Wallet endpoint failed:", url, String(err));
        attempts.push({ url, status: 0, preview: String(err).slice(0, 300) });
        continue;
      }
    }

    return new Response(
      JSON.stringify({ profiles: [], source: "empty", attempts }),
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