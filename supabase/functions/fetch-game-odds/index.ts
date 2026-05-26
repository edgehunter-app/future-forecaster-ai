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

    const key = Deno.env.get("RAPID_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ bookmakers: [], error: "NO_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("fetch-game-odds called", JSON.stringify({ eventId, homeTeam, awayTeam }));

    let source = "per-event";
    let json: any = null;

    if (eventId) {
      const r = await rapidGet(`/v1/events/${encodeURIComponent(eventId)}/odds`, key);
      if (r.json) json = r.json;
    }

    if (!json && homeTeam && awayTeam) {
      source = "fallback-search";
      const qs = `?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}`;
      const r = await rapidGet(`/v1/odds${qs}`, key);
      if (r.json) json = r.json;
    }

    if (!json) {
      return new Response(JSON.stringify({ bookmakers: [], error: "NOT_FOUND", eventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Response keys:", Object.keys(json));
    console.log("Response preview:", JSON.stringify(json).slice(0, 500));

    const bookmakers = buildBookmakers(json, homeTeam, awayTeam);
    console.log("Built bookmakers:", bookmakers.length,
      "→", bookmakers.map((b) => b.key).join(","));

    return new Response(JSON.stringify({ bookmakers, source }), {
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
