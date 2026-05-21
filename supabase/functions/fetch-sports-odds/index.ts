// Sportsbook API (RapidAPI) backed fetch-sports-odds — advantages variant.
// Calls /v0/advantages?type=ARBITRAGE which returns whatever has live cross-
// book interest across ALL sports in ONE request (cheap on quota). Groups
// outcomes by event and emits Odds-API-compatible `data: []` so the existing
// frontend parser in src/lib/oddsApi.ts builds FullGame objects unchanged.
//
// Player props are not supported by this provider — we keep a stub response
// when the client passes eventId so the UI shows "not supported" instead of
// crashing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPID_HOST = "sportsbook-api2.p.rapidapi.com";
const RAPID_BASE = `https://${RAPID_HOST}`;
const DAILY_LIMIT = 150;
const PROVIDER = "rapidapi-sportsbook";
const ADVANTAGES_TTL_MS = 90_000; // 90s

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

// sportKey (frontend) -> competition shortName matcher
const SPORT_TO_SHORT: Record<string, (s: string) => boolean> = {
  americanfootball_nfl: (s) => s === "NFL",
  basketball_nba:       (s) => s === "NBA",
  baseball_mlb:         (s) => s === "MLB",
  icehockey_nhl:        (s) => s === "NHL",
  soccer_epl:           (s) => s === "EPL" || /premier league/i.test(s),
  soccer_usa_mls:       (s) => s === "MLS",
};

const toAmerican = (p: number): number =>
  p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
const toImplied = (p: number): number => (p > 0 ? 1 / p : 0);

// ---------------- module caches ----------------
let advantagesCache: { expires: number; payload: any[] } | null = null;

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

async function bumpCounter(client: any, by = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const current = await readCounter(client);
  await client
    .from("api_usage")
    .upsert(
      { provider: PROVIDER, used_at: today, request_count: current + by },
      { onConflict: "provider,used_at" },
    );
}

async function rapidFetch(path: string): Promise<any | null> {
  const key = Deno.env.get("RAPID_API_KEY");
  if (!key) { console.error("RAPID_API_KEY not set"); return null; }
  const url = `${RAPID_BASE}${path}`;
  console.log("RapidAPI fetch:", url);
  const res = await fetch(url, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": RAPID_HOST },
  });
  console.log("RapidAPI status:", res.status, path);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("RapidAPI error:", text.slice(0, 400));
    return null;
  }
  return await res.json();
}

async function getAdvantages(client: any): Promise<any[]> {
  const now = Date.now();
  if (advantagesCache && advantagesCache.expires > now) return advantagesCache.payload;
  const json = await rapidFetch("/v0/advantages/?type=ARBITRAGE");
  if (!json) return advantagesCache?.payload ?? [];
  await bumpCounter(client);
  const advantages: any[] = Array.isArray(json) ? json : (json.advantages ?? []);
  advantagesCache = { expires: now + ADVANTAGES_TTL_MS, payload: advantages };
  return advantages;
}

// Build synthetic events from a flat list of advantages, grouped by event.key.
// Each synthetic event mirrors the /v0/events shape so the downstream
// transformer below works unchanged.
function advantagesToEvents(advantages: any[]): any[] {
  const byEvent = new Map<string, any>();
  for (const adv of advantages) {
    const market = adv?.market;
    const event = market?.event;
    if (!event?.key) continue;
    let ev = byEvent.get(event.key);
    if (!ev) {
      ev = {
        key: event.key,
        name: event.name ?? null,
        startTime: event.startTime ?? null,
        homeParticipantKey: event.homeParticipantKey ?? null,
        participants: Array.isArray(event.participants) ? [...event.participants] : [],
        competitionInstance: event.competitionInstance ?? null,
        markets: [] as any[],
      };
      byEvent.set(event.key, ev);
    }
    // Re-shape outcomes from a flat array into the grouped `{ source: [...] }`
    // shape that flattenMarketOutcomes() expects below.
    const grouped: Record<string, any[]> = {};
    for (const o of (adv?.outcomes ?? [])) {
      const src = o?.source;
      if (!src) continue;
      (grouped[src] ||= []).push({
        type: o.type,
        payout: o.payout,
        modifier: o.modifier,
        participant: o.participant,
      });
    }
    ev.markets.push({
      key: market.type ? market.type.toLowerCase() : "market",
      type: market.type,
      segment: market.segment ?? null,
      outcomes: grouped,
    });
  }
  return [...byEvent.values()];
}

// ---------------- transformation ----------------

interface FlatOutcome {
  source: string;
  type: string;            // WIN | OVER | UNDER | DRAW | YES | NO
  payout: number;
  participantKey: string | null;
  participantName: string | null;
  modifier: number | null;
}

function flattenMarketOutcomes(market: any): FlatOutcome[] {
  const out: FlatOutcome[] = [];
  const grouped = market?.outcomes;
  if (!grouped || typeof grouped !== "object") return out;
  for (const [source, arr] of Object.entries(grouped)) {
    if (!Array.isArray(arr)) continue;
    for (const o of arr as any[]) {
      out.push({
        source,
        type: o.type,
        payout: Number(o.payout) || 0,
        participantKey: o.participant?.key ?? null,
        participantName: o.participant?.name ?? null,
        modifier: typeof o.modifier === "number" ? o.modifier : null,
      });
    }
  }
  return out;
}

// Convert one /v0/events event into Odds-API game shape.
function eventToOddsApiGame(ev: any, sportKey: string, leagueShort: string) {
  const homeKey = ev?.homeParticipantKey;
  const markets: any[] = Array.isArray(ev?.markets) ? ev.markets : [];

  // Collect distinct participants from market outcomes (top-level
  // ev.participants is sometimes absent on this provider).
  const partMap = new Map<string, string>();
  for (const m of markets) {
    const grouped = m?.outcomes;
    if (!grouped || typeof grouped !== "object") continue;
    for (const arr of Object.values(grouped)) {
      if (!Array.isArray(arr)) continue;
      for (const o of arr as any[]) {
        const p = o?.participant;
        if (p?.key && p?.name && !partMap.has(p.key)) partMap.set(p.key, p.name);
      }
    }
  }
  const topParts: any[] = Array.isArray(ev?.participants) ? ev.participants : [];
  for (const p of topParts) if (p?.key && p?.name && !partMap.has(p.key)) partMap.set(p.key, p.name);

  const partKeys = [...partMap.keys()];
  const homeName = (homeKey && partMap.get(homeKey)) || partMap.get(partKeys[0] ?? "") || "Home";
  const awayKeyCand = partKeys.find((k) => k !== homeKey) ?? partKeys[1];
  const awayName = (awayKeyCand && partMap.get(awayKeyCand)) || "Away";
  const home = homeName;
  const away = awayName;

  // bookmaker -> { h2h:[], spreads:[], totals:[] }
  const byBook = new Map<string, { h2h: any[]; spreads: any[]; totals: any[] }>();

  for (const m of markets) {
    // Accept FULL_MATCH/REGULATION_TIME (full-game lines). Reject quarter/half
    // sub-segments. Missing segment = treat as full game.
    const seg = m?.segment;
    if (seg && seg !== "FULL_MATCH" && seg !== "REGULATION_TIME") continue;
    const outs = flattenMarketOutcomes(m);
    if (outs.length === 0) continue;
    for (const o of outs) {
      const norm = normalizeSource(o.source);
      if (norm.bookmaker === "kutt") continue;
      if (!byBook.has(o.source)) byBook.set(o.source, { h2h: [], spreads: [], totals: [] });
      const bucket = byBook.get(o.source)!;
      const american = toAmerican(o.payout);
      if (m.type === "MONEYLINE" && o.type === "WIN") {
        bucket.h2h.push({ name: o.participantName ?? "", price: american });
      } else if (m.type === "POINT_SPREAD" && o.type === "WIN") {
        bucket.spreads.push({ name: o.participantName ?? "", price: american, point: o.modifier ?? 0 });
      } else if (m.type === "POINT_TOTAL") {
        bucket.totals.push({
          name: o.type === "OVER" ? "Over" : "Under",
          price: american, point: o.modifier ?? 0,
        });
      }
    }
  }

  const bookmakers: any[] = [];
  for (const [source, b] of byBook) {
    const norm = normalizeSource(source);
    const ms: any[] = [];
    if (b.h2h.length) ms.push({ key: "h2h", outcomes: b.h2h });
    if (b.spreads.length) ms.push({ key: "spreads", outcomes: b.spreads });
    if (b.totals.length) ms.push({ key: "totals", outcomes: b.totals });
    if (!ms.length) continue;
    bookmakers.push({
      key: norm.bookmaker,
      title: norm.bookmaker.charAt(0).toUpperCase() + norm.bookmaker.slice(1),
      markets: ms,
    });
  }

  return {
    id: ev.key,
    sport_key: sportKey,
    sport_title: leagueShort,
    commence_time: ev.startTime ?? "",
    home_team: home,
    away_team: away,
    bookmakers,
  };
}

async function logEventOutcomes(client: any, events: any[], leagueShort: string) {
  try {
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const ev of events) {
      const markets: any[] = Array.isArray(ev?.markets) ? ev.markets : [];
      for (const m of markets) {
        const outs = flattenMarketOutcomes(m);
        for (const o of outs) {
          const partKey = o.participantKey;
          const mod = o.modifier;
          const dedupe = `${ev.key}:${m.key}:${o.source}:${o.type}:${partKey ?? "null"}:${mod ?? "null"}`;
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          const norm = normalizeSource(o.source);
          rows.push({
            fetched_at: fetchedAt,
            event_key: ev.key,
            event_name: ev.name ?? null,
            league: leagueShort ?? null,
            market_key: m.key,
            market_type: m.type,
            outcome_type: o.type,
            participant_key: partKey,
            participant_name: o.participantName,
            modifier: mod,
            source: o.source,
            category: norm.category,
            bookmaker: norm.bookmaker,
            payout: o.payout,
            american: toAmerican(o.payout),
            implied: toImplied(o.payout),
            start_time: ev.startTime ?? null,
          });
        }
      }
    }
    if (rows.length > 0) {
      const { error } = await client.from("outcomes_log").insert(rows);
      if (error) console.error("outcomes_log insert failed:", error);
      else console.log(`Logged ${rows.length} outcomes to outcomes_log (board)`);
    }
  } catch (e) {
    console.error("outcomes_log insert threw:", e);
  }
}

// ---------------- handler ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    console.log("fetch-sports-odds called", JSON.stringify({
      ts: new Date().toISOString(),
      sportKey: body.sportKey ?? null,
      trigger: body.trigger ?? null,
      eventId: body.eventId ?? null,
      ping: !!body.ping,
    }));

    const apiKey = Deno.env.get("RAPID_API_KEY");
    if (body.ping) {
      return new Response(JSON.stringify({ ok: !!apiKey, configured: !!apiKey }), {
        status: apiKey ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Player props: not supported by this provider — keep stub so the UI
    // gets a clean "not supported" instead of crashing.
    if (body.eventId) {
      return new Response(JSON.stringify({
        data: [], source: "unsupported", code: "PROPS_NOT_SUPPORTED",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const client = getServiceClient();
    const used = await readCounter(client);
    if (used >= DAILY_LIMIT) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return new Response(JSON.stringify({
        data: [], error: "Daily RapidAPI limit reached",
        resetsAt: tomorrow.toISOString(), code: "QUOTA_EXHAUSTED",
        remainingRequests: 0, usedRequests: used,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull ONE big call covering every sport with live arbitrage.
    const advantages = await getAdvantages(client);
    const events = advantagesToEvents(advantages);
    console.log(`Advantages: ${advantages.length} outcomes → ${events.length} events`);

    // Optional client-side filter by sport. If sportKey unmatched/missing,
    // we return everything.
    const sportKey: string | null = body.sportKey ?? null;
    const matcher = sportKey ? SPORT_TO_SHORT[sportKey] : null;

    const allGames = events.map((ev: any) => {
      const leagueShort: string =
        ev?.competitionInstance?.competition?.shortName ?? "UNKNOWN";
      const inferredSportKey =
        Object.entries(SPORT_TO_SHORT).find(([_k, fn]) => fn(leagueShort))?.[0]
          ?? (sportKey ?? "unknown");
      return eventToOddsApiGame(ev, inferredSportKey, leagueShort);
    }).filter((g: any) => g.bookmakers.length > 0);

    const games = matcher
      ? allGames.filter((g: any) => matcher(g.sport_title))
      : allGames;

    // Snapshot to outcomes_log for research (everything we saw, not just
    // the filtered slice).
    if (events.length) await logEventOutcomes(client, events, "MIXED");

    const usedNow = await readCounter(client);
    return new Response(JSON.stringify({
      data: games,
      source: "live",
      keyUsed: "primary",
      remainingRequests: Math.max(0, DAILY_LIMIT - usedNow),
      usedRequests: usedNow,
      remaining: Math.max(0, DAILY_LIMIT - usedNow),
      used: usedNow,
      meta: {
        source: "sportsbook-api",
        endpoint: "/v0/advantages",
        fetchedAt: new Date().toISOString(),
        requestsUsedToday: usedNow,
        dailyLimit: DAILY_LIMIT,
        league: sportKey ?? "ALL",
        eventsListed: events.length,
        eventsReturned: games.length,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fetch-sports-odds fatal:", e);
    return new Response(JSON.stringify({
      data: [], source: "error", code: "EXCEPTION",
      error: (e as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});