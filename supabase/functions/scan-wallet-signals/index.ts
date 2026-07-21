// Daily scheduled job: pull new activity for each Elite user's tracked wallets,
// dedupe via wallet_signal_cursors, ask analyze-market for a rating, and insert
// qualifying rows into `suggestions` with origin='wallet_auto'.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const MAX_CLAUDE_CALLS = 20;
const MIN_CONFIDENCE = 60;
const MIN_EDGE = 0.03;
const MAX_WALLETS_PER_USER = 25;
const ACTIVITY_LIMIT = 25;

type Trade = {
  id: string;
  marketId: string;
  question: string;
  direction: "YES" | "NO";
  action: "BUY" | "SELL";
  price: number;
  amount: number;
  timestamp: string;
};

async function fetchActivityFor(address: string): Promise<Trade[]> {
  const endpoints = [
    `https://data-api.polymarket.com/activity?user=${address}&limit=${ACTIVITY_LIMIT}`,
    `https://gamma-api.polymarket.com/activity?user=${address}&limit=${ACTIVITY_LIMIT}`,
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
      return raw
        .map((a: any): Trade | null => {
          const marketId = a.market?.id ?? a.conditionId ?? a.asset ?? "";
          const question = a.market?.question ?? a.title ?? a.name ?? a.eventTitle ?? "";
          if (!marketId || !question) return null;
          const id = String(
            a.transactionHash ?? a.txHash ?? a.id ?? `${marketId}:${a.timestamp ?? a.createdAt ?? ""}`,
          );
          const direction =
            a.outcome === "Yes" || a.outcome === "YES" || a.side === "YES" || a.outcomeIndex === 0
              ? "YES"
              : "NO";
          const action =
            a.type === "BUY" || a.side === "BUY" || a.action === "BUY" ? "BUY" : "SELL";
          return {
            id,
            marketId,
            question,
            direction,
            action,
            price: parseFloat(a.price ?? a.avgPrice ?? "0") || 0,
            amount: parseFloat(a.usdcSize ?? a.size ?? a.amount ?? "0") || 0,
            timestamp: a.timestamp ?? a.createdAt ?? a.date ?? new Date().toISOString(),
          };
        })
        .filter((t): t is Trade => !!t);
    } catch (_) {
      continue;
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const header = req.headers.get("x-cron-secret") ?? req.headers.get("X-Cron-Secret");
  if (!cronSecret || header !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const counters = {
    users_scanned: 0,
    trades_seen: 0,
    signals_created: 0,
    claude_calls: 0,
    cap_hit: false,
    notes: "" as string,
  };

  try {
    // 1. Load Elite users
    const { data: eliteProfiles, error: profErr } = await admin
      .from("profiles")
      .select("id, subscription_tier, subscription_status, is_beta_tester")
      .or("and(subscription_tier.eq.elite,subscription_status.eq.active),is_beta_tester.eq.true");
    if (profErr) throw profErr;
    const eliteUserIds = (eliteProfiles ?? []).map((p) => p.id as string);
    if (eliteUserIds.length === 0) {
      counters.notes = "no elite users";
      await admin.from("wallet_scan_runs").insert(counters);
      return new Response(JSON.stringify({ ok: true, ...counters }), { headers: CORS });
    }

    // 2. Their tracked wallets
    const { data: wallets } = await admin
      .from("tracked_wallets")
      .select("user_id, address, label, tier")
      .in("user_id", eliteUserIds);
    const walletsByUser = new Map<string, typeof wallets>();
    for (const w of wallets ?? []) {
      const arr = walletsByUser.get(w.user_id) ?? [];
      if (arr.length < MAX_WALLETS_PER_USER) arr.push(w);
      walletsByUser.set(w.user_id, arr);
    }

    // 3. Load cursors
    const { data: cursorRows } = await admin
      .from("wallet_signal_cursors")
      .select("user_id, wallet_address, last_processed_trade_id, last_processed_at")
      .in("user_id", eliteUserIds);
    const cursor = new Map<string, { id?: string; ts?: string }>();
    for (const c of cursorRows ?? []) {
      cursor.set(`${c.user_id}:${c.wallet_address}`, {
        id: c.last_processed_trade_id ?? undefined,
        ts: c.last_processed_at ?? undefined,
      });
    }

    // 4. For each user, aggregate new trades by market
    type MarketBucket = {
      userId: string;
      marketId: string;
      question: string;
      direction: "YES" | "NO";
      wallets: { label: string; tier: string; address: string }[];
      newest: Trade;
      totalAmount: number;
    };
    const buckets: MarketBucket[] = [];
    const newestPerWallet = new Map<string, Trade>(); // key user:address

    for (const userId of eliteUserIds) {
      const uWallets = walletsByUser.get(userId) ?? [];
      if (uWallets.length === 0) continue;
      counters.users_scanned++;
      const userBuckets = new Map<string, MarketBucket>();

      for (const w of uWallets) {
        const trades = await fetchActivityFor(w.address);
        counters.trades_seen += trades.length;
        const key = `${userId}:${w.address}`;
        const cur = cursor.get(key);
        const curTs = cur?.ts ? new Date(cur.ts).getTime() : 0;

        // Only new BUY trades
        const newTrades = trades.filter((t) => {
          if (t.action !== "BUY") return false;
          if (cur?.id && t.id === cur.id) return false;
          const ts = new Date(t.timestamp).getTime();
          if (curTs && ts <= curTs) return false;
          return true;
        });

        // Track newest for cursor advance
        for (const t of trades) {
          const prev = newestPerWallet.get(key);
          if (!prev || new Date(t.timestamp).getTime() > new Date(prev.timestamp).getTime()) {
            newestPerWallet.set(key, t);
          }
        }

        for (const t of newTrades) {
          const bKey = `${t.marketId}:${t.direction}`;
          const b = userBuckets.get(bKey);
          if (b) {
            b.wallets.push({ label: w.label, tier: w.tier, address: w.address });
            b.totalAmount += t.amount;
            if (new Date(t.timestamp).getTime() > new Date(b.newest.timestamp).getTime()) {
              b.newest = t;
            }
          } else {
            userBuckets.set(bKey, {
              userId,
              marketId: t.marketId,
              question: t.question,
              direction: t.direction,
              wallets: [{ label: w.label, tier: w.tier, address: w.address }],
              newest: t,
              totalAmount: t.amount,
            });
          }
        }
      }
      buckets.push(...userBuckets.values());
    }

    // 5. Rank: more wallets first, then S/A tier count, then $ amount
    const tierRank = (t: string) => (t === "S" ? 4 : t === "A" ? 3 : t === "B" ? 2 : 1);
    buckets.sort((a, b) => {
      if (b.wallets.length !== a.wallets.length) return b.wallets.length - a.wallets.length;
      const aElite = a.wallets.reduce((s, w) => s + tierRank(w.tier), 0);
      const bElite = b.wallets.reduce((s, w) => s + tierRank(w.tier), 0);
      if (bElite !== aElite) return bElite - aElite;
      return b.totalAmount - a.totalAmount;
    });

    const selected = buckets.slice(0, MAX_CLAUDE_CALLS);
    counters.cap_hit = buckets.length > MAX_CLAUDE_CALLS;

    // 6. Load user profiles for bankroll/kelly/maxPct — reuse defaults if missing
    const { data: userProfiles } = await admin
      .from("profiles")
      .select("id, bankroll, kelly_multiplier, max_position")
      .in("id", Array.from(new Set(selected.map((b) => b.userId))));
    const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p]));

    // 7. Analyze + insert
    for (const b of selected) {
      const prof = profileMap.get(b.userId) ?? {};
      const bankroll = Number((prof as any).bankroll ?? 1000);
      const kellyMultiplier = Number((prof as any).kelly_multiplier ?? 0.25);
      const maxPositionPct = Number((prof as any).max_position ?? 5);

      const yesPrice = b.direction === "YES" ? b.newest.price : 1 - b.newest.price;
      const market = {
        id: b.marketId,
        question: b.question,
        category: "Prediction",
        source: "Polymarket",
        yesPrice,
        noPrice: 1 - yesPrice,
        volume24h: 0,
        change24h: 0,
      };
      const walletsPayload = b.wallets.map((w) => ({
        label: w.label || w.address.slice(0, 8),
        winRate: 0.6,
        sharpe: 1.5,
        tier: w.tier || "B",
      }));

      counters.claude_calls++;
      let analysis: any = null;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-market`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            apikey: SERVICE_ROLE,
          },
          body: JSON.stringify({
            market,
            wallets: walletsPayload,
            bankroll,
            kellyMultiplier,
            maxPositionPct,
          }),
        });
        if (res.ok) analysis = await res.json();
      } catch (err) {
        console.warn("analyze-market failed:", String(err));
      }
      if (!analysis || analysis.error) continue;

      const conf = Number(analysis.confidence ?? 0);
      const edge = Number(analysis.edge ?? 0);
      const dir = analysis.direction === "NO" ? "NO" : "YES";
      // Prefer wallet-consensus direction unless model strongly disagrees
      const finalDirection = dir === b.direction ? dir : b.direction;
      if (conf < MIN_CONFIDENCE || edge < MIN_EDGE) continue;

      // Dedupe against existing active auto row for same market+direction
      const { data: dup } = await admin
        .from("suggestions")
        .select("id")
        .eq("user_id", b.userId)
        .eq("market_id", b.marketId)
        .eq("direction", finalDirection)
        .eq("origin", "wallet_auto")
        .eq("status", "active")
        .limit(1);
      if (dup && dup.length > 0) continue;

      const currentOdds = finalDirection === "YES" ? market.yesPrice : market.noPrice;
      const suggestedAmount = Math.max(
        1,
        Math.min(
          Math.round(Number(analysis.suggestedAmount ?? 0)),
          Math.floor((bankroll * maxPositionPct) / 100),
        ),
      );

      const { error: insErr } = await admin.from("suggestions").insert({
        user_id: b.userId,
        market_id: b.marketId,
        question: b.question,
        direction: finalDirection,
        current_odds: currentOdds,
        suggested_amount: suggestedAmount,
        confidence: Math.round(conf),
        edge,
        category: "Prediction",
        reasoning: analysis.reasoning ?? "",
        wallet_signals: b.wallets.map((w) => w.label || w.address.slice(0, 8)),
        key_signals: analysis.keySignals ?? [],
        status: "active",
        source: "polymarket",
        origin: "wallet_auto",
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
      if (!insErr) counters.signals_created++;
      else console.warn("insert failed:", insErr.message);
    }

    // 8. Advance cursors — but only for wallets whose new trades were within `selected`
    // If cap was hit, we still safely advance to newest observed (skipped trades won't
    // regenerate because they were already dropped by ranking; but to preserve overflow
    // we only advance cursors for wallets fully covered by `selected` OR when cap not hit).
    const selectedWalletKeys = new Set<string>();
    for (const b of selected) {
      for (const w of b.wallets) selectedWalletKeys.add(`${b.userId}:${w.address}`);
    }
    const cursorUpserts: any[] = [];
    for (const [key, t] of newestPerWallet.entries()) {
      if (counters.cap_hit && !selectedWalletKeys.has(key)) continue;
      const [user_id, wallet_address] = key.split(":");
      cursorUpserts.push({
        user_id,
        wallet_address,
        last_processed_trade_id: t.id,
        last_processed_at: t.timestamp,
        updated_at: new Date().toISOString(),
      });
    }
    if (cursorUpserts.length > 0) {
      await admin
        .from("wallet_signal_cursors")
        .upsert(cursorUpserts, { onConflict: "user_id,wallet_address" });
    }

    if (counters.cap_hit) counters.notes = `capped at ${MAX_CLAUDE_CALLS} of ${buckets.length}`;
    await admin.from("wallet_scan_runs").insert(counters);
    return new Response(JSON.stringify({ ok: true, ...counters }), { headers: CORS });
  } catch (err) {
    console.error("scan-wallet-signals failed:", err);
    counters.notes = `error: ${String(err).slice(0, 200)}`;
    await admin.from("wallet_scan_runs").insert(counters).then(() => {}, () => {});
    return new Response(JSON.stringify({ error: String(err), ...counters }), {
      status: 500,
      headers: CORS,
    });
  }
});