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
    const { address, limit = 50 } = await req.json().catch(() => ({}));
    if (!address) {
      return new Response(JSON.stringify({ positions: [] }), { headers: CORS_HEADERS });
    }
    const endpoints = [
      `https://data-api.polymarket.com/positions?user=${address}&sizeThreshold=1&limit=${limit}`,
      `https://data-api.polymarket.com/positions?user=${address}&limit=${limit}`,
      `https://gamma-api.polymarket.com/positions?user=${address}&limit=${limit}`,
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "EdgeHunter/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const raw: any[] = Array.isArray(data) ? data : data.positions ?? data.data ?? [];
        const positions = raw.map((p: any) => ({
          marketId: p.market?.id ?? p.conditionId ?? p.asset ?? "",
          question:
            p.market?.question ?? p.market?.title ?? p.title ?? p.name ?? p.eventTitle ?? "Unknown market",
          direction:
            p.outcome === "Yes" || p.outcome === "YES" || p.side === "YES" || p.outcomeIndex === 0
              ? "YES"
              : "NO",
          amount: parseFloat(p.size ?? p.amount ?? p.collateral ?? p.value ?? "0") || 0,
          currentValue: parseFloat(p.currentValue ?? p.value ?? p.worth ?? "0") || 0,
          entryPrice: parseFloat(p.avgPrice ?? p.price ?? p.avgCost ?? "0") || 0,
          pnl: parseFloat(p.cashPnl ?? p.pnl ?? p.profit ?? p.realizedPnl ?? "0") || 0,
          size: parseFloat(p.size ?? p.shares ?? p.quantity ?? "0") || 0,
        }));
        return new Response(JSON.stringify({ positions }), { headers: CORS_HEADERS });
      } catch (err) {
        console.warn("Positions endpoint failed:", url, String(err));
        continue;
      }
    }
    return new Response(JSON.stringify({ positions: [] }), { headers: CORS_HEADERS });
  } catch (err) {
    console.error("fetch-wallet-positions error:", err);
    return new Response(JSON.stringify({ positions: [], error: String(err) }), { headers: CORS_HEADERS });
  }
});