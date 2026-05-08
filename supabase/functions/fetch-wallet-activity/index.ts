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
    const { address, limit = 20 } = await req.json().catch(() => ({}));
    if (!address) {
      return new Response(JSON.stringify({ activity: [] }), { headers: CORS_HEADERS });
    }
    const endpoints = [
      `https://data-api.polymarket.com/activity?user=${address}&limit=${limit}`,
      `https://gamma-api.polymarket.com/activity?user=${address}&limit=${limit}`,
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "EdgeHunter/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const raw: any[] = Array.isArray(data) ? data : data.history ?? data.activity ?? [];
        const activity = raw.map((a: any) => ({
          action:
            a.type === "BUY" || a.side === "BUY" || a.action === "BUY" ? "BUY" : "SELL",
          direction:
            a.outcome === "Yes" || a.outcome === "YES" || a.side === "YES" || a.outcomeIndex === 0
              ? "YES"
              : "NO",
          question: a.market?.question ?? a.title ?? a.name ?? a.eventTitle ?? "Unknown market",
          amount: parseFloat(a.usdcSize ?? a.size ?? a.amount ?? "0") || 0,
          price: parseFloat(a.price ?? a.avgPrice ?? "0") || 0,
          timestamp: a.timestamp ?? a.createdAt ?? a.date ?? new Date().toISOString(),
          marketId: a.market?.id ?? a.conditionId ?? "",
        }));
        return new Response(JSON.stringify({ activity }), { headers: CORS_HEADERS });
      } catch (err) {
        console.warn("Activity endpoint failed:", url, String(err));
        continue;
      }
    }
    return new Response(JSON.stringify({ activity: [] }), { headers: CORS_HEADERS });
  } catch (err) {
    console.error("fetch-wallet-activity error:", err);
    return new Response(JSON.stringify({ activity: [], error: String(err) }), { headers: CORS_HEADERS });
  }
});