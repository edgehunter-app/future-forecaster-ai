// Sportsbook API (RapidAPI) backed fetch-sports-odds.
// Returns the FULL games board for a sport (every event, every book), not
// just arbitrage candidates. Emits Odds-API-compatible `data: []` shape so
// the existing frontend parser in src/lib/oddsApi.ts works unchanged.
//
// Workflow per docs:
//   1. /v0/competitions                       (cached forever in module mem)
//   2. /v0/competitions/{key}/events          (cached 4h)
//   3. /v0/events?eventKeys=K1&eventKeys=K2.. (fresh, up to 50 events)
//
// Cross-market gaps now live in a separate function: fetch-cross-market-gaps
// Player props are not supported by the documented /v0/events market types
// (MONEYLINE, MONEYLINE_3WAY, POINT_SPREAD, POINT_TOTAL, BOTH_TEAMS_TO_SCORE).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPID_HOST = "sportsbook-api2.p.rapidapi.com";
const RAPID_BASE = `https://${RAPID_HOST}`;
const DAILY_LIMIT = 150;
const PROVIDER = "rapidapi-sportsbook";
const EVENTS_LIST_TTL_MS = 4 * 60 * 60 * 1000; // 4h
const EVENTS_ODDS_TTL_MS = 90_000;             // 90s
const MAX_EVENT_KEYS_PER_CALL = 50;

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
let competitionsCache: any[] | null = null;
const eventsListCache = new Map<string, { expires: number; events: any[] }>();
const eventsOddsCache = new Map<string, { expires: number; event: any }>();

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

async function getCompetitionKey(
  client: any, sportKey: string,
): Promise<{ key: string; shortName: string } | null> {
  const matcher = SPORT_TO_SHORT[sportKey];
  if (!matcher) return null;
  if (!competitionsCache) {
    const json = await rapidFetch("/v0/competitions/");
    if (!json) return null;
    await bumpCounter(client);
    competitionsCache = Array.isArray(json) ? json : (json.competitions ?? []);
  }
  const comp = competitionsCache!.find((c: any) =>
    typeof c?.shortName === "string" && matcher(c.shortName),
  );
  if (!comp) {
    console.warn(`No competition matched for ${sportKey}`);
    return null;
  }
  return { key: comp.key, shortName: comp.shortName };
}

async function getEventsList(
  client: any, competitionKey: string,
): Promise<any[]> {
  const now = Date.now();
  const hit = eventsListCache.get(competitionKey);
  if (hit && hit.expires > now) return hit.events;
  const json = await rapidFetch(`/v0/competitions/${competitionKey}/events`);
  if (!json) return hit?.events ?? [];
  await bumpCounter(client);
  const events = Array.isArray(json) ? json : (json.events ?? []);
  eventsListCache.set(competitionKey, { expires: now + EVENTS_LIST_TTL_MS, events });
  return events;
}

async function getEventsWithOdds(
  client: any, eventKeys: string[],
): Promise<any[]> {
  if (eventKeys.length === 0) return [];
  const now = Date.now();
  const out: any[] = [];
  const toFetch: string[] = [];
  for (const k of eventKeys) {
    const hit = eventsOddsCache.get(k);
    if (hit && hit.expires > now) out.push(hit.event);
    else toFetch.push(k);
  }
  for (let i = 0; i < toFetch.length; i += MAX_EVENT_KEYS_PER_CALL) {
    const batch = toFetch.slice(i, i + MAX_EVENT_KEYS_PER_CALL);
    const qs = batch.map((k) => `eventKeys=${encodeURIComponent(k)}`).join("&");
    const json = await rapidFetch(`/v0/events?${qs}`);
    if (!json) continue;
    await bumpCounter(client);
    const events: any[] = Array.isArray(json) ? json : (json.events ?? []);
    for (const ev of events) {
      if (ev?.key) eventsOddsCache.set(ev.key, { expires: now + EVENTS_ODDS_TTL_MS, event: ev });
      out.push(ev);
    }
  }
  return out;
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
  const participants: any[] = Array.isArray(ev?.participants) ? ev.participants : [];
  const homeKey = ev?.homeParticipantKey;
  const homePart = participants.find((p) => p.key === homeKey) ?? participants[0];
  const awayPart = participants.find((p) => p.key !== homeKey) ?? participants[1];
  const home = homePart?.name ?? "Home";
  const away = awayPart?.name ?? "Away";

  const markets: any[] = Array.isArray(ev?.markets) ? ev.markets : [];
  // bookmaker -> { h2h:[], spreads:[], totals:[] }
  const byBook = new Map<string, { h2h: any[]; spreads: any[]; totals: any[] }>();

  for (const m of markets) {
    if (m?.segment && m.segment !== "FULL_MATCH" && m.segment !== "REGULATION_TIME") continue;
    const outs = flattenMarketOutcomes(m);
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

    const sportKey: string | null = body.sportKey ?? null;
    if (!sportKey || !SPORT_TO_SHORT[sportKey]) {
      return new Response(JSON.stringify({
        data: [], source: "error", code: "UNSUPPORTED_SPORT",
        error: `sportKey '${sportKey}' is not supported`,
        remainingRequests: Math.max(0, DAILY_LIMIT - used),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const comp = await getCompetitionKey(client, sportKey);
    if (!comp) {
      const usedNow = await readCounter(client);
      return new Response(JSON.stringify({
        data: [], source: "error", code: "NO_COMPETITION",
        remainingRequests: Math.max(0, DAILY_LIMIT - usedNow),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const eventsList = await getEventsList(client, comp.key);
    // Upcoming-only filter so we don't waste budget on finished games.
    const cutoff = Date.now() - 3 * 60 * 60 * 1000;
    const upcoming = eventsList
      .filter((e: any) => {
        const t = e?.startTime ? new Date(e.startTime).getTime() : 0;
        return t === 0 || t >= cutoff;
      })
      .slice(0, MAX_EVENT_KEYS_PER_CALL);
    const eventKeys = upcoming.map((e: any) => e.key).filter(Boolean);

    const eventsWithOdds = await getEventsWithOdds(client, eventKeys);
    console.log(`Sport ${sportKey} (${comp.shortName}): ${eventsList.length} events listed, ${eventsWithOdds.length} hydrated with odds`);

    // Snapshot to outcomes_log for research.
    if (eventsWithOdds.length) await logEventOutcomes(client, eventsWithOdds, comp.shortName);

    const games = eventsWithOdds
      .map((ev: any) => eventToOddsApiGame(ev, sportKey, comp.shortName))
      .filter((g: any) => g.bookmakers.length > 0);

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
        endpoint: "/v0/events",
        fetchedAt: new Date().toISOString(),
        requestsUsedToday: usedNow,
        dailyLimit: DAILY_LIMIT,
        league: comp.shortName,
        eventsListed: eventsList.length,
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