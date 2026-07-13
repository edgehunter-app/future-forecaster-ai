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
const DAILY_LIMIT = 1000;
const PROVIDER = "rapidapi-sportsbook";
const ADVANTAGES_TTL_MS = 90_000; // 90s
const ODDS_TTL_MS = 90_000;

// ============ Secondary source: The Odds API ============
// Used ONLY for sports the Sportsbook API doesn't cover well — currently
// FIFA World Cup (soccer 3-way) and golf majors (outrights).
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_API_PROVIDER = "the-odds-api";
const ODDS_API_REMAINING_SENTINEL = "9999-12-31"; // used_at row that stores latest "remaining" header
const ODDS_API_SOCCER_SPORTS = ["soccer_fifa_world_cup"];
// MMA has one global feed on The Odds API — covers UFC, PFL, Bellator, etc.
const ODDS_API_MMA_SPORTS = ["mma_mixed_martial_arts"];
// The Odds API only carries major-winner outrights on the current plan —
// no weekly PGA Tour or LIV feed. Real keys all use the `_winner` suffix.
// We probe /sports first and only call the ones flagged active=true to
// avoid burning quota on 404s.
const ODDS_API_GOLF_SPORTS = [
  "golf_the_open_championship_winner",
  "golf_masters_tournament_winner",
  "golf_pga_championship_winner",
  "golf_us_open_winner",
];
const oddsApiCache = new Map<string, { expires: number; payload: any[] }>();

// Probe /sports to find which golf majors are currently active. Cached for
// 10 minutes per cold start; /sports doesn't count against the daily quota.
let activeGolfCache: { expires: number; keys: string[] } | null = null;
async function getActiveGolfSports(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh && activeGolfCache && activeGolfCache.expires > now) return activeGolfCache.keys;
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch(`${ODDS_API_BASE}/sports?apiKey=${apiKey}&all=true`);
    if (!res.ok) {
      console.warn("[odds-api/discovery] /sports status=", res.status);
      return activeGolfCache?.keys ?? [];
    }
    const sports = await res.json();
    if (!Array.isArray(sports)) return [];
    const golf = sports
      .filter((s: any) => s?.group === "Golf" || (typeof s?.key === "string" && s.key.includes("golf")))
      .map((s: any) => ({ key: s.key, title: s.title, active: s.active, has_outrights: s.has_outrights }));
    console.log("[odds-api/discovery] golf sports:", JSON.stringify(golf));
    const active = golf
      .filter((s: any) => s.active && ODDS_API_GOLF_SPORTS.includes(s.key))
      .map((s: any) => s.key);
    console.log("[odds-api/discovery] active golf keys:", JSON.stringify(active));
    activeGolfCache = { expires: now + 10 * 60 * 1000, keys: active };
    return active;
  } catch (e) {
    console.warn("[odds-api/discovery] failed:", e);
    return activeGolfCache?.keys ?? [];
  }
}

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
  soccer_fifa_world_cup: (s) =>
    s === "WC" || s === "WORLD_CUP" || /world\s*cup/i.test(s) || /fifa/i.test(s),
};

const SHORT_TO_SPORT_KEY: Record<string, string> = {
  MLB: "baseball_mlb",
  NBA: "basketball_nba",
  NFL: "americanfootball_nfl",
  NHL: "icehockey_nhl",
  EPL: "soccer_epl",
  MLS: "soccer_usa_mls",
  WNBA: "basketball_wnba",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  WC: "soccer_fifa_world_cup",
  WORLD_CUP: "soccer_fifa_world_cup",
  FIFA_WORLD_CUP: "soccer_fifa_world_cup",
};

function toSportKey(shortName: string): string {
  return SHORT_TO_SPORT_KEY[shortName]
    ?? shortName.toLowerCase().replace(/\s+/g, "_");
}

const toAmerican = (p: number): number =>
  p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
const toImplied = (p: number): number => (p > 0 ? 1 / p : 0);

// ---------------- module caches ----------------
let advantagesCache: { expires: number; payload: any[] } | null = null;
const competitionEventsCache = new Map<string, { expires: number; payload: any[] }>();
const SPORT_KEY_TO_SHORT: Record<string, string> = {
  americanfootball_nfl: "NFL",
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  soccer_epl: "EPL",
  soccer_usa_mls: "MLS",
};

// Some sports map to MULTIPLE possible competition short names — we try
// each until one returns events. Discovered via logged advantages payload.
const SPORT_KEY_TO_SHORT_CANDIDATES: Record<string, string[]> = {
  soccer_fifa_world_cup: [
    // FIFA_WC is the only valid competition short on this provider — the
    // others 404. We keep the working key here in case more variants get
    // added later.
    "FIFA_WC",
  ],
};

function shortNamesFor(sportKey: string): string[] {
  if (SPORT_KEY_TO_SHORT_CANDIDATES[sportKey]) return SPORT_KEY_TO_SHORT_CANDIDATES[sportKey];
  return SPORT_KEY_TO_SHORT[sportKey] ? [SPORT_KEY_TO_SHORT[sportKey]] : [];
}

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
  console.log(
    "[sportsbook-api] quota remaining=",
    res.headers.get("x-ratelimit-requests-remaining"),
    "limit=",
    res.headers.get("x-ratelimit-requests-limit"),
    "reset=",
    res.headers.get("x-ratelimit-requests-reset"),
  );
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

// /v1/competitions/{SHORT}/events returns events with main markets (moneyline,
// spread, total) and latest outcomes baked in. One call = one full league
// slate. Cached per-competition.
async function getCompetitionEvents(client: any, short: string): Promise<any[]> {
  const now = Date.now();
  const cached = competitionEventsCache.get(short);
  if (cached && cached.expires > now) return cached.payload;
  // Provide an explicit startTimeFrom (yesterday UTC) — the API errors out
  // with "If a startTimeTo is provided a startTimeFrom is required" otherwise.
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const qs = `?startTimeFrom=${encodeURIComponent(from)}&startTimeTo=${encodeURIComponent(to)}&includeOdds=true`;
  const json = await rapidFetch(`/v1/competitions/${encodeURIComponent(short)}/events${qs}`);
  if (!json) return cached?.payload ?? [];
  await bumpCounter(client);
  const events: any[] = Array.isArray(json?.events) ? json.events : [];
  if (short === "MLB") {
    const first = events?.[0];
    const firstMarket = first?.markets?.[0];
    const outs = firstMarket?.outcomes;
    const outCount = Array.isArray(outs)
      ? outs.length
      : (outs && typeof outs === "object" ? Object.keys(outs).length : 0);
    console.log("[competitions] MLB with odds:", outCount, "outcomes on first game");
  }
  competitionEventsCache.set(short, { expires: now + ADVANTAGES_TTL_MS, payload: events });
  return events;
}

// v1 events come back with markets already attached but outcomes may be flat
// arrays. Normalize into the same `markets[].outcomes = { source: [...] }`
// shape the rest of the transformer expects, and stamp competitionInstance
// so leagueShort resolves correctly downstream.
function normalizeCompetitionEvents(events: any[], short: string): any[] {
  return events.map((ev: any) => {
    const markets = Array.isArray(ev?.markets) ? ev.markets : [];
    const normMarkets = markets.map((m: any) => {
      const outs = m?.outcomes;
      let grouped: Record<string, any[]>;
      if (outs && !Array.isArray(outs) && typeof outs === "object") {
        grouped = outs;
      } else {
        grouped = {};
        for (const o of (Array.isArray(outs) ? outs : [])) {
          const src = o?.source;
          if (!src) continue;
          (grouped[src] ||= []).push({
            type: o.type,
            payout: o.payout,
            modifier: o.modifier,
            participant: o.participant,
          });
        }
      }
      return {
        key: m.key ?? (m.type ? String(m.type).toLowerCase() : "market"),
        type: m.type,
        segment: m.segment ?? "FULL_MATCH",
        outcomes: grouped,
      };
    });
    const inst = ev.competitionInstance ?? {};
    const comp = (inst.competition && typeof inst.competition === "object") ? inst.competition : {};
    return {
      key: ev.key,
      name: ev.name ?? null,
      startTime: ev.startTime ?? null,
      homeParticipantKey: ev.homeParticipantKey ?? null,
      participants: Array.isArray(ev.participants) ? ev.participants : [],
      competitionInstance: { ...inst, competition: { ...comp, shortName: comp.shortName ?? short } },
      markets: normMarkets,
    };
  });
}

// Merge advantages events onto odds events. Odds = primary (all games),
// advantages adds extra markets (arbitrage / cross-market) and flags
// hasArbitrage on matching events.
function mergeEvents(oddsEvents: any[], advEvents: any[]): { events: any[]; arbKeys: Set<string> } {
  const byKey = new Map<string, any>();
  for (const ev of oddsEvents) byKey.set(ev.key, ev);
  const arbKeys = new Set<string>();
  for (const ev of advEvents) {
    arbKeys.add(ev.key);
    const existing = byKey.get(ev.key);
    if (existing) {
      existing.markets.push(...(ev.markets ?? []));
      if (!existing.competitionInstance) existing.competitionInstance = ev.competitionInstance;
    } else {
      byKey.set(ev.key, ev);
    }
  }
  return { events: [...byKey.values()], arbKeys };
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
      } else if (m.type === "MONEYLINE" && o.type === "DRAW") {
        // Soccer/3-way moneyline: emit a synthetic "Draw" outcome so the
        // client can render a Draw column in the book comparison table.
        bucket.h2h.push({ name: "Draw", price: american });
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
    const regulatoryNote =
      norm.bookmaker === "kalshi" ? "CFTC regulated"
      : norm.bookmaker === "polymarket" ? "Offshore · USDC"
      : norm.bookmaker === "prophetx" ? "Peer-to-peer exchange"
      : null;
    bookmakers.push({
      key: norm.bookmaker,
      title: norm.bookmaker.charAt(0).toUpperCase() + norm.bookmaker.slice(1),
      category: norm.category,
      regulatoryNote,
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
// ============ Secondary source: The Odds API helpers ============
async function bumpOddsApiCounter(client: any, by = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await client
    .from("api_usage")
    .select("request_count")
    .eq("provider", ODDS_API_PROVIDER)
    .eq("used_at", today)
    .maybeSingle();
  const current = data?.request_count ?? 0;
  await client
    .from("api_usage")
    .upsert(
      { provider: ODDS_API_PROVIDER, used_at: today, request_count: current + by },
      { onConflict: "provider,used_at" },
    );
}
async function storeOddsApiRemaining(client: any, remaining: number) {
  await client
    .from("api_usage")
    .upsert(
      { provider: ODDS_API_PROVIDER, used_at: ODDS_API_REMAINING_SENTINEL, request_count: remaining },
      { onConflict: "provider,used_at" },
    );
}

/**
 * Transform an Odds API event ({h2h, spreads, totals}) into the same shape
 * the downstream client (oddsApi.ts) consumes for Sportsbook API events.
 * Soccer 3-way: Draw outcome is preserved as a synthetic "Draw" h2h entry.
 */
function oddsApiEventToGame(game: any): any {
  const home = game.home_team ?? "";
  const away = game.away_team ?? "";
  const bookmakers = (game.bookmakers ?? []).map((b: any) => {
    const h2h = (b.markets ?? []).find((m: any) => m.key === "h2h");
    const sp = (b.markets ?? []).find((m: any) => m.key === "spreads");
    const tot = (b.markets ?? []).find((m: any) => m.key === "totals");
    const ms: any[] = [];
    if (h2h?.outcomes?.length) {
      const outs = h2h.outcomes.map((o: any) => ({
        name: o.name === home ? home : o.name === away ? away : o.name, // keeps "Draw" verbatim
        price: o.price,
      }));
      ms.push({ key: "h2h", outcomes: outs });
    }
    if (sp?.outcomes?.length) {
      ms.push({
        key: "spreads",
        outcomes: sp.outcomes.map((o: any) => ({ name: o.name, price: o.price, point: o.point ?? 0 })),
      });
    }
    if (tot?.outcomes?.length) {
      ms.push({
        key: "totals",
        outcomes: tot.outcomes.map((o: any) => ({ name: o.name, price: o.price, point: o.point ?? 0 })),
      });
    }
    return {
      key: b.key,
      title: b.title,
      category: "vegas",
      regulatoryNote: null,
      markets: ms,
    };
  });
  return {
    id: game.id,
    sport_key: game.sport_key,
    sport_title: game.sport_title,
    commence_time: game.commence_time,
    home_team: home,
    away_team: away,
    bookmakers,
    source: "odds-api",
  };
}

/**
 * Golf outrights -> one pseudo-game per tournament. Bookmakers carry a
 * synthetic { key: "outrights", outcomes: [{name: player, price}] } market.
 * Client (oddsApi.ts) detects this and exposes a `players` leaderboard.
 */
function oddsApiGolfEventToGame(game: any): any {
  const tournament = game.sport_title ?? "Tournament";
  const bookmakers = (game.bookmakers ?? []).map((b: any) => {
    const out = (b.markets ?? []).find((m: any) => m.key === "outrights");
    return {
      key: b.key,
      title: b.title,
      category: "vegas",
      regulatoryNote: null,
      markets: out?.outcomes?.length
        ? [{ key: "outrights", outcomes: out.outcomes.map((o: any) => ({ name: o.name, price: o.price })) }]
        : [],
    };
  }).filter((b: any) => b.markets.length > 0);
  return {
    id: game.id,
    sport_key: game.sport_key,
    sport_title: tournament,
    commence_time: game.commence_time ?? "",
    home_team: tournament,
    away_team: "Field",
    bookmakers,
    source: "odds-api",
    isOutright: true,
  };
}

async function fetchOddsApiSport(
  client: any,
  sport: string,
  markets: string,
  forceRefresh = false,
): Promise<{ games: any[]; remaining: number | null }> {
  const apiKey = Deno.env.get("ODDS_API_KEY");
  if (!apiKey) {
    console.warn("[odds-api] ODDS_API_KEY not set; skipping", sport);
    return { games: [], remaining: null };
  }
  const cacheKey = sport.startsWith("golf_")
    ? `${sport}:${markets}:winner-v1`
    : `${sport}:${markets}`;
  const now = Date.now();
  const cached = oddsApiCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expires > now) return { games: cached.payload, remaining: null };

  const url = `${ODDS_API_BASE}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;
  const redactedUrl = `${ODDS_API_BASE}/sports/${sport}/odds?apiKey=***&regions=us&markets=${markets}&oddsFormat=american`;
  const isTheOpen = sport === "golf_the_open_championship_winner";
  if (isTheOpen) {
    console.log("The Open API call URL:", redactedUrl);
  }
  try {
    const res = await fetch(url);
    const remainingHdr = res.headers.get("x-requests-remaining");
    const remaining = remainingHdr ? Number(remainingHdr) : null;
    console.log(`[odds-api] ${sport} status=${res.status} remaining=${remainingHdr ?? "n/a"}`);
    if (isTheOpen) console.log("The Open status:", res.status);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[odds-api] ${sport} non-ok body:`, txt.slice(0, 200));
      return { games: [], remaining };
    }
    const json = await res.json();
    if (isTheOpen) {
      console.log("The Open events:", Array.isArray(json) ? json.length : 0);
      console.log("The Open first event:", JSON.stringify(Array.isArray(json) ? json[0] ?? null : null).slice(0, 500));
    }
    if (!Array.isArray(json)) return { games: [], remaining };
    await bumpOddsApiCounter(client, 1);
    if (remaining !== null) await storeOddsApiRemaining(client, remaining);
    const isGolf = sport.startsWith("golf_");
    const mapped = json.map((g: any) => (isGolf ? oddsApiGolfEventToGame(g) : oddsApiEventToGame(g)));
    console.log(`[odds-api] ${sport} games=${mapped.length}`);
    oddsApiCache.set(cacheKey, { expires: now + ODDS_TTL_MS, payload: mapped });
    return { games: mapped, remaining };
  } catch (err) {
    console.error(`[odds-api] ${sport} failed:`, err);
    return { games: [], remaining: null };
  }
}

async function fetchOddsApiAll(client: any, forceRefresh = false): Promise<{ games: any[]; remaining: number | null }> {
  // Soccer 3-way (h2h includes Draw) + golf outrights, run in parallel with
  // ~500ms spacing between calls inside each group to be polite.
  // Probe /sports first so we only call golf majors flagged active=true.
  const activeGolfKeys = await getActiveGolfSports(forceRefresh);
  console.log("Fetching golf with keys:", JSON.stringify(activeGolfKeys));
  const soccerCalls = ODDS_API_SOCCER_SPORTS.map((s) => fetchOddsApiSport(client, s, "h2h,spreads,totals", forceRefresh));
  const golfCalls = activeGolfKeys.map((s) => fetchOddsApiSport(client, s, "outrights", forceRefresh));
  // MMA/UFC is moneyline only.
  const mmaCalls = ODDS_API_MMA_SPORTS.map((s) => fetchOddsApiSport(client, s, "h2h", forceRefresh));
  const results = await Promise.all([...soccerCalls, ...golfCalls, ...mmaCalls]);
  const games: any[] = [];
  let remaining: number | null = null;
  for (const r of results) {
    games.push(...r.games);
    if (typeof r.remaining === "number") remaining = r.remaining;
  }
  const mmaCount = games.filter((g) => g?.sport_key === "mma_mixed_martial_arts").length;
  console.log("[odds-api] MMA events mapped:", mmaCount);
  if (mmaCount > 0) {
    const first = games.find((g) => g?.sport_key === "mma_mixed_martial_arts");
    console.log("[odds-api] MMA first fight:", first?.away_team, "vs", first?.home_team,
      "at", first?.commence_time, "books:", first?.bookmakers?.length ?? 0);
  }
  // Debug: surface how many outright players & a sample for the first golf
  // event, so we can confirm the leaderboard pipeline is fed.
  const firstGolf = games.find((g) => g.isOutright);
  if (firstGolf) {
    const firstBook = firstGolf.bookmakers?.[0];
    const outs = firstBook?.markets?.[0]?.outcomes;
    console.log("[odds-api] golf leaderboard sample:",
      firstGolf.sport_title, "players=", outs?.length ?? 0,
      "first=", JSON.stringify(outs?.[0] ?? null));
  }
  return { games, remaining };
}

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

    // One-off discovery probe: tests whether the Sportsbook API exposes
    // full-slate endpoints (not just /v0/advantages arbitrage).
    if (body.probeSportsbook) {
      const key = apiKey;
      if (!key) {
        return new Response(JSON.stringify({ error: "NO_KEY" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const headers = { "x-rapidapi-key": key, "x-rapidapi-host": RAPID_HOST };
      const results: Record<string, any> = {};

      const hit = async (label: string, path: string) => {
        const url = `${RAPID_BASE}${path}`;
        try {
          const res = await fetch(url, { headers });
          const status = res.status;
          let bodyText = "";
          let json: any = null;
          if (res.ok) {
            const t = await res.text();
            bodyText = t.slice(0, 400);
            try { json = JSON.parse(t); } catch { /* not json */ }
          } else {
            bodyText = (await res.text().catch(() => "")).slice(0, 200);
          }
          const count = Array.isArray(json?.events) ? json.events.length
            : Array.isArray(json?.data) ? json.data.length
            : Array.isArray(json) ? json.length : null;
          console.log(`[probe] ${label} status=${status} count=${count} preview=${bodyText.slice(0, 300)}`);
          results[label] = { status, count, preview: bodyText };
        } catch (e) {
          console.log(`[probe] ${label} threw ${(e as Error).message}`);
          results[label] = { status: 0, error: (e as Error).message };
        }
      };

      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const qs = `?startTimeFrom=${encodeURIComponent(from)}&startTimeTo=${encodeURIComponent(to)}`;
      await hit("MLB_events", `/v1/competitions/MLB/events${qs}`);
      await hit("MLB_events_includeOdds", `/v1/competitions/MLB/events${qs}&includeOdds=true`);
      await hit("odds_baseball", "/v1/odds?sport=BASEBALL");
      await hit("odds_MLB", "/v1/odds?competition=MLB");
      await hit("events_root", `/v1/events${qs}`);
      for (const sport of ["NBA", "NHL", "NFL"]) {
        await hit(`${sport}_events`, `/v1/competitions/${sport}/events${qs}`);
      }

      return new Response(JSON.stringify({ results }, null, 2), {
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

    // Lazy per-sport fetch: /v1/competitions/{SHORT}/events for the requested
    // sport (or all known sports if none given), plus /v0/advantages overlay.
    const sportKey: string | null = body.sportKey ?? null;
    const shortsToFetch: string[] = sportKey
      ? shortNamesFor(sportKey)
      : [
          ...Object.values(SPORT_KEY_TO_SHORT),
          ...Object.values(SPORT_KEY_TO_SHORT_CANDIDATES).flat(),
        ];

    // Run Sportsbook API (primary) + The Odds API (secondary for WC/golf)
    // in parallel. Odds API failures must NOT block the primary response.
    const [advantages, oddsApiResult, ...perSport] = await Promise.all([
      getAdvantages(client),
      fetchOddsApiAll(client, !!body.forceRefresh).catch((e) => {
        console.error("[odds-api] fetchOddsApiAll failed:", e);
        return { games: [] as any[], remaining: null as number | null };
      }),
      ...shortsToFetch.map((s) => getCompetitionEvents(client, s).then((evs) => ({ short: s, evs }))),
    ]);

    // === DISCOVERY LOGGING ===
    // Surface every competition shortName/name the API currently has data for
    // so we can pinpoint the correct key for new tournaments (e.g. World Cup).
    try {
      const compsFromAdvantages = new Map<string, string>();
      for (const adv of advantages) {
        const comp = adv?.market?.event?.competitionInstance?.competition;
        if (comp?.shortName) compsFromAdvantages.set(comp.shortName, comp.name ?? "");
      }
      console.log("[discovery] advantages competitions:",
        JSON.stringify([...compsFromAdvantages.entries()]).slice(0, 600));
      for (const { short, evs } of perSport as Array<{ short: string; evs: any[] }>) {
        console.log(`[discovery] short=${short} -> ${evs.length} events`);
      }
    } catch (e) {
      console.warn("[discovery] failed:", e);
    }

    const advEvents = advantagesToEvents(advantages);
    const compEvents: any[] = [];
    for (const { short, evs } of perSport as Array<{ short: string; evs: any[] }>) {
      compEvents.push(...normalizeCompetitionEvents(evs, short));
    }
    const { events, arbKeys } = mergeEvents(compEvents, advEvents);
    console.log(`Advantages: ${advantages.length} → ${advEvents.length} events; Competitions [${shortsToFetch.join(",")}]: ${compEvents.length} events; merged: ${events.length}`);

    // Optional client-side filter by sport. If sportKey unmatched/missing,
    // we return everything.
    const matcher = sportKey ? SPORT_TO_SHORT[sportKey] : null;

    const allGames = events.map((ev: any) => {
      const leagueShort: string =
        ev?.competitionInstance?.competition?.shortName ?? "UNKNOWN";
      const inferredSportKey = toSportKey(leagueShort);
      const g = eventToOddsApiGame(ev, inferredSportKey, leagueShort);
      (g as any).hasArbitrage = arbKeys.has(ev.key);
      return g;
    }).filter((g: any) => g.bookmakers.length > 0);

    // Debug: per-game bookmaker counts so we can confirm Vegas + prediction
    // markets are both flowing through.
    for (const g of allGames.slice(0, 5)) {
      console.log(
        "Game:", (g as any).home_team, "vs", (g as any).away_team,
        "| bookmakers:", (g as any).bookmakers?.length,
        "→", ((g as any).bookmakers ?? []).map((b: any) => b.key).join(","),
      );
    }

    const games = matcher
      ? allGames.filter((g: any) => matcher(g.sport_title))
      : allGames;

    // Merge in The Odds API games (WC + golf). The relevancy filter above
    // is sport-tab driven on the client; here we just append.
    const mergedGames = [...games, ...(oddsApiResult?.games ?? [])];
    console.log(`[merge] sportsbook=${games.length} oddsApi=${oddsApiResult?.games?.length ?? 0} total=${mergedGames.length}`);

    // Snapshot to outcomes_log for research (everything we saw, not just
    // the filtered slice).
    if (events.length) await logEventOutcomes(client, events, "MIXED");

    const usedNow = await readCounter(client);
    return new Response(JSON.stringify({
      data: mergedGames,
      source: "live",
      keyUsed: "primary",
      remainingRequests: Math.max(0, DAILY_LIMIT - usedNow),
      usedRequests: usedNow,
      remaining: Math.max(0, DAILY_LIMIT - usedNow),
      used: usedNow,
      oddsApiRemaining: oddsApiResult?.remaining ?? null,
      meta: {
        source: "sportsbook-api",
        endpoint: "/v1/competitions/{SHORT}/events + /v0/advantages",
        fetchedAt: new Date().toISOString(),
        requestsUsedToday: usedNow,
        dailyLimit: DAILY_LIMIT,
        league: sportKey ?? "ALL",
        leaguesFetched: shortsToFetch,
        eventsListed: events.length,
        eventsReturned: mergedGames.length,
        oddsApiGames: oddsApiResult?.games?.length ?? 0,
        oddsApiRemaining: oddsApiResult?.remaining ?? null,
        arbitrageEvents: arbKeys.size,
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