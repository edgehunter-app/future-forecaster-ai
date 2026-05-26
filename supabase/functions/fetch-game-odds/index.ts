// Lazy per-event odds fetch. Called from the client when a game on the board
// has < 2 Vegas books (typical for early-window MLB games that aren't in the
// /v0/advantages arbitrage feed). Returns FullBookmakerLine-shaped objects
// the client can drop straight into the GameCard compare table.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPID_HOST = "sportsbook-api2.p.rapidapi.com";

const SOURCE_MAP: Record<string, { bookmaker: string; category: "vegas" | "prediction_market" | "synthetic"; name: string }> = {
  DRAFT_KINGS: { bookmaker: "draftkings", category: "vegas", name: "DraftKings" },
  FAN_DUEL:    { bookmaker: "fanduel",    category: "vegas", name: "FanDuel" },
  BET_MGM:     { bookmaker: "betmgm",     category: "vegas", name: "BetMGM" },
  BET_PARX:    { bookmaker: "betparx",    category: "vegas", name: "BetParx" },
  BET_RIVERS:  { bookmaker: "betrivers",  category: "vegas", name: "BetRivers" },
  BOVADA:      { bookmaker: "bovada",     category: "vegas", name: "Bovada" },
  ESPN_BET:    { bookmaker: "espnbet",    category: "vegas", name: "ESPN Bet" },
  FANATICS:    { bookmaker: "fanatics",   category: "vegas", name: "Fanatics" },
  KALSHI:      { bookmaker: "kalshi",     category: "prediction_market", name: "Kalshi" },
  POLYMARKET:  { bookmaker: "polymarket", category: "prediction_market", name: "Polymarket" },
  PROPHET_X:   { bookmaker: "prophetx",   category: "prediction_market", name: "ProphetX" },
  KUTT:        { bookmaker: "kutt",       category: "synthetic", name: "Kutt" },
};

function normalizeSource(source: string) {
  if (SOURCE_MAP[source]) return SOURCE_MAP[source];
  const name = source
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { bookmaker: source.toLowerCase().replace(/_/g, ""), category: "vegas" as const, name };
}

const toAmerican = (p: number): number => {
  if (!p || p <= 1) return 0;
  return p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
};

interface FlatOutcome {
  source: string;
  marketType: string;
  outcomeType: string;
  payout: number;
  modifier: number | null;
  participantKey: string | null;
  participantName: string | null;
}

// Accept multiple shapes:
//   { markets: [{ type, outcomes: { SOURCE: [...] } }] }   (grouped)
//   { markets: [{ type, outcomes: [...] }] }               (flat)
//   { outcomes: [...] } / { odds: [...] }                   (top-level)
function flatten(json: any): FlatOutcome[] {
  const out: FlatOutcome[] = [];
  const push = (marketType: string, source: string, o: any) => {
    out.push({
      source,
      marketType,
      outcomeType: o.type ?? "",
      payout: Number(o.payout) || 0,
      modifier: typeof o.modifier === "number" ? o.modifier : null,
      participantKey: o?.participant?.key ?? null,
      participantName: o?.participant?.name ?? null,
    });
  };

  const markets: any[] = Array.isArray(json?.markets) ? json.markets : [];
  for (const m of markets) {
    const seg = m?.segment;
    if (seg && seg !== "FULL_MATCH" && seg !== "REGULATION_TIME") continue;
    const grouped = m?.outcomes;
    if (Array.isArray(grouped)) {
      for (const o of grouped) {
        const src = o.source ?? o.book;
        if (src) push(m.type ?? "", src, o);
      }
    } else if (grouped && typeof grouped === "object") {
      for (const [src, arr] of Object.entries(grouped)) {
        if (!Array.isArray(arr)) continue;
        for (const o of arr as any[]) push(m.type ?? "", src, o);
      }
    }
  }

  const topArr = (Array.isArray(json?.outcomes) && json.outcomes)
    || (Array.isArray(json?.odds) && json.odds)
    || (Array.isArray(json?.data?.outcomes) && json.data.outcomes)
    || [];
  for (const o of topArr as any[]) {
    const src = o.source ?? o.book;
    if (!src) continue;
    push(o.marketType ?? o.market ?? "", src, o);
  }

  return out;
}

function homeKeyFromJson(json: any): string | null {
  return json?.homeParticipantKey
    ?? json?.event?.homeParticipantKey
    ?? json?.data?.homeParticipantKey
    ?? null;
}

function buildBookmakers(json: any, homeTeam: string, awayTeam: string): any[] {
  const flats = flatten(json);
  if (!flats.length) return [];
  const homeKey = homeKeyFromJson(json);

  type Acc = {
    name: string; key: string; category: string; regulatoryNote: string | null;
    homeMoneyline: number; awayMoneyline: number;
    homeSpread: number; spreadHomeOdds: number; spreadAwayOdds: number;
    totalLine: number; overOdds: number; underOdds: number;
  };
  const acc = new Map<string, Acc>();

  const isHome = (o: FlatOutcome): boolean | null => {
    if (homeKey && o.participantKey) return o.participantKey === homeKey;
    const name = (o.participantName ?? "").toLowerCase();
    if (!name) return null;
    if (homeTeam && name.includes(homeTeam.split(" ").pop()!.toLowerCase())) return true;
    if (awayTeam && name.includes(awayTeam.split(" ").pop()!.toLowerCase())) return false;
    return null;
  };

  for (const o of flats) {
    const norm = normalizeSource(o.source);
    if (norm.bookmaker === "kutt") continue;
    let book = acc.get(norm.bookmaker);
    if (!book) {
      const regulatoryNote =
        norm.bookmaker === "kalshi" ? "CFTC regulated"
        : norm.bookmaker === "polymarket" ? "Offshore · USDC"
        : norm.bookmaker === "prophetx" ? "Peer-to-peer exchange"
        : null;
      book = {
        name: norm.name, key: norm.bookmaker, category: norm.category, regulatoryNote,
        homeMoneyline: 0, awayMoneyline: 0,
        homeSpread: 0, spreadHomeOdds: 0, spreadAwayOdds: 0,
        totalLine: 0, overOdds: 0, underOdds: 0,
      };
      acc.set(norm.bookmaker, book);
    }
    const american = toAmerican(o.payout);
    const home = isHome(o);

    if ((o.marketType === "MONEYLINE" || o.outcomeType === "WIN" || o.outcomeType === "MONEYLINE")
        && o.marketType !== "POINT_SPREAD" && o.marketType !== "POINT_TOTAL") {
      if (home === true) book.homeMoneyline = american;
      else if (home === false) book.awayMoneyline = american;
    } else if (o.marketType === "POINT_SPREAD" || o.marketType === "SPREAD") {
      if (home === true) {
        book.homeSpread = o.modifier ?? book.homeSpread;
        book.spreadHomeOdds = american;
      } else if (home === false) {
        book.spreadAwayOdds = american;
      }
    } else if (o.marketType === "POINT_TOTAL" || o.marketType === "TOTAL") {
      book.totalLine = o.modifier ?? book.totalLine;
      if (o.outcomeType === "OVER") book.overOdds = american;
      else if (o.outcomeType === "UNDER") book.underOdds = american;
    }
  }

  return [...acc.values()].filter(
    (b) => b.homeMoneyline || b.awayMoneyline || b.totalLine || b.homeSpread,
  );
}

async function rapidGet(path: string, key: string): Promise<{ status: number; json: any | null }> {
  const url = `https://${RAPID_HOST}${path}`;
  console.log("RapidAPI fetch:", url);
  try {
    const res = await fetch(url, {
      headers: { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    console.log("RapidAPI status:", res.status, path);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (txt) console.warn("RapidAPI error body:", txt.slice(0, 300));
      return { status: res.status, json: null };
    }
    const json = await res.json();
    return { status: res.status, json };
  } catch (e) {
    console.error("RapidAPI fetch threw:", (e as Error).message);
    return { status: 0, json: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const eventId: string | undefined = body.eventId;
    const homeTeam: string = body.homeTeam ?? "";
    const awayTeam: string = body.awayTeam ?? "";
    const sport: string = body.sport ?? "";

    const key = Deno.env.get("RAPID_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ bookmakers: [], error: "NO_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("=== fetch-game-odds debug ===");
    console.log("eventId:", eventId);
    console.log("homeTeam:", homeTeam);
    console.log("awayTeam:", awayTeam);
    console.log("sport:", sport);

    const debug: Record<string, any> = { eventId, homeTeam, awayTeam, sport };
    let bookmakers: any[] = [];
    let source = "none";

    // ---- Test 1: per-event /odds ----
    if (eventId) {
      const r1 = await rapidGet(`/v1/events/${encodeURIComponent(eventId)}/odds`, key);
      debug.url1Status = r1.status;
      debug.url1Body = r1.json ? JSON.stringify(r1.json).slice(0, 300) : null;
      console.log("URL 1 status:", r1.status, "preview:", debug.url1Body);
      if (r1.json) {
        const built = buildBookmakers(r1.json, homeTeam, awayTeam);
        if (built.length) { bookmakers = built; source = "per-event-odds"; }
      }
    }

    // ---- Test 2: per-event bare ----
    if (!bookmakers.length && eventId) {
      const r2 = await rapidGet(`/v1/events/${encodeURIComponent(eventId)}`, key);
      debug.url2Status = r2.status;
      debug.url2Body = r2.json ? JSON.stringify(r2.json).slice(0, 300) : null;
      console.log("URL 2 status:", r2.status, "preview:", debug.url2Body);
      if (r2.json) {
        const built = buildBookmakers(r2.json, homeTeam, awayTeam);
        if (built.length) { bookmakers = built; source = "per-event"; }
      }
    }

    // ---- Test 3: competition events, find by team name ----
    const leagueMap: Record<string, string> = {
      baseball_mlb: "MLB",
      basketball_nba: "NBA",
      icehockey_nhl: "NHL",
      americanfootball_nfl: "NFL",
      soccer_epl: "EPL",
      soccer_usa_mls: "MLS",
    };
    const league = leagueMap[sport] ?? "MLB";
    const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const to = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();
    const r3 = await rapidGet(
      `/v1/competitions/${league}/events?startTimeFrom=${encodeURIComponent(from)}&startTimeTo=${encodeURIComponent(to)}`,
      key,
    );
    debug.url3Status = r3.status;
    if (r3.json) {
      const events: any[] = r3.json?.events ?? r3.json?.data ?? (Array.isArray(r3.json) ? r3.json : []);
      debug.url3EventCount = events.length;
      console.log("URL 3 keys:", Object.keys(r3.json), "event count:", events.length);
      const homeLast = homeTeam.split(" ").pop()?.toLowerCase() ?? "";
      const awayLast = awayTeam.split(" ").pop()?.toLowerCase() ?? "";
      const match = events.find((e) => {
        const name = (e.name ?? e.event?.name ?? "").toLowerCase();
        if (e.key && e.key === eventId) return true;
        return (homeLast && name.includes(homeLast)) || (awayLast && name.includes(awayLast));
      });
      debug.url3MatchKey = match?.key ?? match?.id ?? null;
      console.log("URL 3 match:", debug.url3MatchKey ?? "NOT FOUND");
      if (match) {
        debug.url3MatchPreview = JSON.stringify(match).slice(0, 500);
        console.log("URL 3 match preview:", debug.url3MatchPreview);
        if (!bookmakers.length) {
          const built = buildBookmakers(match, homeTeam, awayTeam);
          if (built.length) { bookmakers = built; source = "competition-events"; }
        }
      }
    }

    // ---- Test 4: advantages ----
    const r4 = await rapidGet(`/v0/advantages/?type=ARBITRAGE`, key);
    debug.url4Status = r4.status;
    if (r4.json) {
      const advantages: any[] = r4.json?.advantages ?? [];
      const homeLast = homeTeam.split(" ").pop()?.toLowerCase() ?? "";
      const match4 = advantages.find((a) => {
        const name = (a?.market?.event?.name ?? "").toLowerCase();
        return homeLast && name.includes(homeLast);
      });
      debug.url4Found = !!match4;
      console.log("URL 4 advantages: total", advantages.length, "found for game:", !!match4);
      if (match4) {
        const sources = (match4.outcomes ?? []).map((o: any) => o.source);
        debug.url4Sources = sources;
        console.log("URL 4 advantage sources:", sources);
      }
    }

    console.log("Built bookmakers:", bookmakers.length, "source:", source,
      "→", bookmakers.map((b) => b.key).join(","));

    return new Response(JSON.stringify({ bookmakers, source, debug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-game-odds threw:", (e as Error).message);
    return new Response(JSON.stringify({ bookmakers: [], error: "EXCEPTION" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
