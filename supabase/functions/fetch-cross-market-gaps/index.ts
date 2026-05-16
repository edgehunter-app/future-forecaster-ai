// Sportsbook API (RapidAPI) — cross-market arbitrage gaps from /v0/advantages.
// Returns { crossMarketGaps: [...] }. Also snapshots every outcome it sees
// into outcomes_log for research analysis. Shares the rapidapi-sportsbook
// daily counter with fetch-sports-odds.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPID_HOST = "sportsbook-api2.p.rapidapi.com";
const RAPID_BASE = `https://${RAPID_HOST}`;
const DAILY_LIMIT = 150;
const PROVIDER = "rapidapi-sportsbook";
const UPSTREAM_TTL_MS = 90_000;

const SOURCE_MAP: Record<string, { bookmaker: string; category: "vegas" | "prediction_market" | "synthetic" }> = {
  DRAFT_KINGS: { bookmaker: "draftkings", category: "vegas" },
  FAN_DUEL:    { bookmaker: "fanduel",    category: "vegas" },
  BET_MGM:     { bookmaker: "betmgm",     category: "vegas" },
  BET_PARX:    { bookmaker: "betparx",    category: "vegas" },
  BET_RIVERS:  { bookmaker: "betrivers",  category: "vegas" },
  BOVADA:      { bookmaker: "bovada",     category: "vegas" },
  ESPN_BET:    { bookmaker: "espnbet",    category: "vegas" },
  FANATICS:    { bookmaker: "fanatics",   category: "vegas" },
  KALSHI:      { bookmaker: "kalshi",     category: "prediction_market" },
  POLYMARKET:  { bookmaker: "polymarket", category: "prediction_market" },
  PROPHET_X:   { bookmaker: "prophetx",   category: "prediction_market" },
  KUTT:        { bookmaker: "kutt",       category: "synthetic" },
};

function normalizeSource(source: string) {
  if (SOURCE_MAP[source]) return SOURCE_MAP[source];
  return { bookmaker: source.toLowerCase(), category: "vegas" as const };
}

const toAmerican = (p: number): number =>
  p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
const toImplied = (p: number): number => (p > 0 ? 1 / p : 0);

interface UpstreamCache { expires: number; payload: any; }
let cache: UpstreamCache | null = null;

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function readCounter(client: any): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await client
    .from("api_usage")
    .select("request_count")
    .eq("provider", PROVIDER)
    .eq("used_at", today)
    .maybeSingle();
  return data?.request_count ?? 0;
}

async function bumpCounter(client: any) {
  const today = new Date().toISOString().slice(0, 10);
  const current = await readCounter(client);
  await client
    .from("api_usage")
    .upsert(
      { provider: PROVIDER, used_at: today, request_count: current + 1 },
      { onConflict: "provider,used_at" },
    );
}

async function fetchAdvantages(): Promise<any[] | null> {
  const key = Deno.env.get("RAPID_API_KEY");
  if (!key) { console.error("RAPID_API_KEY not set"); return null; }
  const url = `${RAPID_BASE}/v0/advantages/?type=ARBITRAGE`;
  console.log("RapidAPI fetch:", url);
  const res = await fetch(url, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": RAPID_HOST },
  });
  console.log("RapidAPI status:", res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("RapidAPI error body:", text.slice(0, 500));
    return null;
  }
  const json = await res.json();
  const advantages = Array.isArray(json) ? json : (json.advantages ?? json.data ?? []);
  console.log(`RapidAPI returned ${advantages.length} advantages`);
  return advantages;
}

interface OutcomeBlock {
  source: string;
  bookmaker: string;
  category: "vegas" | "prediction_market" | "synthetic";
  payout: number;
  type: string;
  participantKey: string | null;
  participantName: string | null;
  modifier: number | null;
}
interface MarketBlock {
  eventKey: string;
  eventName: string;
  league: string;
  startTime: string;
  marketKey: string;
  marketType: string;
  outcomes: OutcomeBlock[];
}

function collectMarkets(advantages: any[]): Map<string, MarketBlock> {
  const map = new Map<string, MarketBlock>();
  for (const adv of advantages) {
    for (const o of adv?.outcomes ?? []) {
      const market = o.market ?? adv.market;
      const event = market?.event;
      if (!market || !event) continue;
      const mkey = market.key;
      if (!map.has(mkey)) {
        map.set(mkey, {
          eventKey: event.key,
          eventName: event.name ?? "",
          league: event.competitionInstance?.competition?.shortName ?? "",
          startTime: event.startTime ?? "",
          marketKey: mkey,
          marketType: market.type,
          outcomes: [],
        });
      }
      const norm = normalizeSource(o.source);
      map.get(mkey)!.outcomes.push({
        source: o.source,
        bookmaker: norm.bookmaker,
        category: norm.category,
        payout: Number(o.payout) || 0,
        type: o.type,
        participantKey: o.participantKey ?? o.participant?.key ?? null,
        participantName: o.participant?.name ?? null,
        modifier: o.modifier ?? null,
      });
    }
  }
  for (const m of map.values()) {
    const seen = new Set<string>();
    m.outcomes = m.outcomes.filter((o) => {
      const k = `${o.source}|${o.type}|${o.participantKey ?? ""}|${o.modifier ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return map;
}

function buildGaps(allMarkets: MarketBlock[]): any[] {
  type Group = {
    eventKey: string; eventName: string; league: string; startTime: string;
    marketKey: string; marketType: string; outcomeType: string;
    participant: string | null; participantKey: string | null;
    modifier: number | null; vegas: OutcomeBlock[]; pred: OutcomeBlock[];
  };
  const groups = new Map<string, Group>();
  for (const m of allMarkets) {
    for (const o of m.outcomes) {
      if (o.bookmaker === "kutt") continue;
      const id = `${m.eventKey}:${m.marketKey}:${o.type}:${o.participantKey ?? "total"}:${o.modifier ?? ""}`;
      if (!groups.has(id)) {
        groups.set(id, {
          eventKey: m.eventKey, eventName: m.eventName, league: m.league,
          startTime: m.startTime, marketKey: m.marketKey, marketType: m.marketType,
          outcomeType: o.type, participant: o.participantName,
          participantKey: o.participantKey, modifier: o.modifier,
          vegas: [], pred: [],
        });
      }
      const g = groups.get(id)!;
      if (o.category === "vegas") g.vegas.push(o);
      else if (o.category === "prediction_market") g.pred.push(o);
    }
  }
  const gaps: any[] = [];
  for (const [id, g] of groups) {
    if (!g.vegas.length || !g.pred.length) continue;
    const vegasBest = g.vegas.reduce((a, b) => (b.payout > a.payout ? b : a));
    const predSorted = [...g.pred].sort((a, b) => b.payout - a.payout);
    const bestPred = predSorted[0];
    const vegasImpl = toImplied(vegasBest.payout);
    const predImpl = toImplied(bestPred.payout);
    const edgePct = (vegasImpl - predImpl) * 100;
    gaps.push({
      id, eventKey: g.eventKey, eventName: g.eventName, league: g.league,
      marketType: g.marketType, outcomeType: g.outcomeType,
      participant: g.participant, modifier: g.modifier,
      predictionMarkets: predSorted.map((p) => ({
        source: p.bookmaker, payout: p.payout,
        american: toAmerican(p.payout), implied: toImplied(p.payout),
      })),
      vegasBest: {
        source: vegasBest.bookmaker, payout: vegasBest.payout,
        american: toAmerican(vegasBest.payout), implied: vegasImpl,
      },
      edgePct, startTime: g.startTime,
    });
  }
  gaps.sort((a, b) => Math.abs(b.edgePct) - Math.abs(a.edgePct));
  return gaps;
}

async function logOutcomes(client: any, advantages: any[]) {
  try {
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const adv of advantages) {
      for (const o of adv?.outcomes ?? []) {
        const market = o.market ?? adv.market;
        const event = market?.event;
        if (!market || !event) continue;
        const partKey = o.participantKey ?? o.participant?.key ?? null;
        const mod = o.modifier ?? null;
        const dedupe = `${event.key}:${market.key}:${o.source}:${o.type}:${partKey ?? "null"}:${mod ?? "null"}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const norm = normalizeSource(o.source);
        const payout = Number(o.payout) || 0;
        rows.push({
          fetched_at: fetchedAt,
          event_key: event.key,
          event_name: event.name ?? null,
          league: event.competitionInstance?.competition?.shortName ?? null,
          market_key: market.key,
          market_type: market.type,
          outcome_type: o.type,
          participant_key: partKey,
          participant_name: o.participant?.name ?? null,
          modifier: mod,
          source: o.source,
          category: norm.category,
          bookmaker: norm.bookmaker,
          payout,
          american: toAmerican(payout),
          implied: toImplied(payout),
          start_time: event.startTime ?? null,
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await client.from("outcomes_log").insert(rows);
      if (error) console.error("outcomes_log insert failed:", error);
      else console.log(`Logged ${rows.length} outcomes to outcomes_log (gaps)`);
    }
  } catch (e) {
    console.error("outcomes_log insert threw:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({} as any));
    console.log("fetch-cross-market-gaps called", JSON.stringify({
      ts: new Date().toISOString(), trigger: body.trigger ?? null,
    }));

    const apiKey = Deno.env.get("RAPID_API_KEY");
    if (body.ping) {
      return new Response(JSON.stringify({ ok: !!apiKey, configured: !!apiKey }), {
        status: apiKey ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = getServiceClient();
    const used = await readCounter(client);
    if (used >= DAILY_LIMIT) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return new Response(JSON.stringify({
        crossMarketGaps: [], error: "Daily RapidAPI limit reached",
        resetsAt: tomorrow.toISOString(), code: "QUOTA_EXHAUSTED",
        remainingRequests: 0, usedRequests: used,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let advantages: any[] | null = null;
    const now = Date.now();
    let freshFetch = false;
    if (cache && cache.expires > now) {
      advantages = cache.payload;
      console.log("upstream cache hit");
    } else {
      advantages = await fetchAdvantages();
      if (advantages) {
        cache = { expires: now + UPSTREAM_TTL_MS, payload: advantages };
        await bumpCounter(client);
        freshFetch = true;
      }
    }
    if (!advantages) {
      return new Response(JSON.stringify({
        crossMarketGaps: [], source: "error", code: "UPSTREAM_ERROR",
        remainingRequests: Math.max(0, DAILY_LIMIT - used),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const marketMap = collectMarkets(advantages);
    const allMarkets = Array.from(marketMap.values());
    const uniqueEvents = new Set(allMarkets.map((m) => m.eventKey)).size;
    console.log(`uniqueEventsReturned: ${uniqueEvents} (from ${advantages.length} advantages)`);

    if (freshFetch) await logOutcomes(client, advantages);

    const gaps = buildGaps(allMarkets);
    const usedNow = await readCounter(client);
    return new Response(JSON.stringify({
      crossMarketGaps: gaps,
      source: "live",
      remainingRequests: Math.max(0, DAILY_LIMIT - usedNow),
      usedRequests: usedNow,
      meta: {
        source: "sportsbook-api",
        endpoint: "/v0/advantages",
        fetchedAt: new Date().toISOString(),
        requestsUsedToday: usedNow,
        dailyLimit: DAILY_LIMIT,
        uniqueEventsReturned: uniqueEvents,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fetch-cross-market-gaps fatal:", e);
    return new Response(JSON.stringify({
      crossMarketGaps: [], source: "error", code: "EXCEPTION",
      error: (e as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});