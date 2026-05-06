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
      `https://lb-api.polymarket.com/leaderboard?window=Month&type=volume&limit=${limit}`,
      `https://lb-api.polymarket.com/leaderboard?window=Month&type=profit&limit=${limit}`,
      `https://data-api.polymarket.com/v1/leaderboard?limit=${limit}`,
      `https://data-api.polymarket.com/v1/leaderboard?sortBy=volume&limit=${limit}`,
      `https://data-api.polymarket.com/v1/leaderboard`,
      `https://data-api.polymarket.com/leaderboard?limit=${limit}`,
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
            console.log("First profile sample:", JSON.stringify(profiles[0]).slice(0, 500));
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