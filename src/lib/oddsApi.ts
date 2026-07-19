import type { Market } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { isDailyCapReached, incrementDaily, getDailyCount, DAILY_CAP } from "@/lib/oddsDailyCap";

export interface OddsBookmaker {
  key: string;
  title: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
}

export interface OddsGame {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: OddsBookmaker[];
  consensusProb: { home: number; away: number; draw?: number };
}

export interface SportsMispricing {
  id: string;
  question: string;
  game: OddsGame;
  polymarket: Market;
  polyImplied: number;
  vegasImplied: number;
  spread: number;
  edge: number;
  direction: "YES" | "NO";
  favoredSide: string;
  bestBook: string;
  bestOdds: number;
  confidence: number;
  league: string;
  claudeAnalysis?: any | null;
}

export const SPORTS = [
  { key: "americanfootball_nfl", label: "NFL", icon: "football" },
  { key: "basketball_nba", label: "NBA", icon: "circle" },
  { key: "baseball_mlb", label: "MLB", icon: "circle" },
  { key: "icehockey_nhl", label: "NHL", icon: "circle" },
  { key: "soccer_epl", label: "EPL", icon: "circle" },
  { key: "soccer_usa_mls", label: "MLS", icon: "circle" },
  { key: "soccer_fifa_world_cup", label: "🌍 World Cup", icon: "trophy" },
  { key: "golf", label: "⛳ Golf", icon: "trophy" },
  { key: "mma_mixed_martial_arts", label: "MMA", icon: "zap" },
  { key: "tennis", label: "🎾 Tennis", icon: "circle" },
] as const;

export function toImplied(odds: number): number {
  if (odds === 0) return 0.5;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export function removeVig(home: number, away: number): { home: number; away: number } {
  const total = home + away;
  if (total === 0) return { home: 0.5, away: 0.5 };
  return { home: home / total, away: away / total };
}

export function impliedToAmerican(prob: number): string {
  if (prob <= 0 || prob >= 1) return "N/A";
  if (prob >= 0.5) return `-${Math.round((prob / (1 - prob)) * 100)}`;
  return `+${Math.round(((1 - prob) / prob) * 100)}`;
}

let lastRemaining: number | null = null;
export function getRemainingRequests(): number | null { return lastRemaining; }

export interface LastKeyResponse {
  remaining: number | null;
  used: number | null;
  keyUsed: "primary" | "secondary" | null;
  code: string | null;
  source: "live" | "exhausted" | "error" | null;
}
let lastKeyResponse: LastKeyResponse = { remaining: null, used: null, keyUsed: null, code: null, source: null };
export function getLastKeyResponse(): LastKeyResponse { return lastKeyResponse; }
function captureKeyResponse(resp: any) {
  if (!resp || typeof resp !== "object") return;
  lastKeyResponse = {
    remaining: typeof resp.remaining === "number" ? resp.remaining
      : typeof resp.remainingRequests === "number" ? resp.remainingRequests : null,
    used: typeof resp.used === "number" ? resp.used
      : typeof resp.usedRequests === "number" ? resp.usedRequests : null,
    keyUsed: resp.keyUsed ?? null,
    code: resp.code ?? null,
    source: resp.source ?? null,
  };
}

let lastEdgeResponse: any = null;
let lastEdgeError: any = null;
export function getLastEdgeResponse() { return lastEdgeResponse; }
export function getLastEdgeError() { return lastEdgeError; }

let lastGames: OddsGame[] = [];
export function getLastGames(): OddsGame[] { return lastGames; }

// ============= Full odds (h2h + spreads + totals) =============

export interface FullBookmakerLine {
  name: string;
  key: string;
  category: "vegas" | "prediction_market" | "synthetic";
  regulatoryNote: string | null;
  homeMoneyline: number;
  awayMoneyline: number;
  drawMoneyline: number;
  homeSpread: number;     // e.g. -3.5
  spreadHomeOdds: number; // juice e.g. -110
  spreadAwayOdds: number;
  totalLine: number;      // e.g. 47.5
  overOdds: number;
  underOdds: number;
}

export interface FullGame {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  homeTeamShort?: string;
  awayTeam: string;
  awayTeamShort?: string;
  commenceTime: string;
  isLive: boolean;
  moneyline: {
    home: number;
    away: number;
    homeImplied: number;
    awayImplied: number;
    bestHomeBook: string;
    bestAwayBook: string;
    bestHomeOdds: number;
    bestAwayOdds: number;
  };
  spread: {
    homeSpread: number;
    awaySpread: number;
    homeOdds: number;
    awayOdds: number;
    bestBook: string;
  } | null;
  total: {
    line: number;
    overOdds: number;
    underOdds: number;
    bestBook: string;
  } | null;
  bookmakers: FullBookmakerLine[];
  vegasConsensus: {
    home: number;            // American odds
    away: number;
    homeImplied: number;     // de-vigged implied probability
    awayImplied: number;
  } | null;
  polymarketMatch: Market | null;
  polymarketImplied: number | null;
  mispricingGap: number | null;
  // Set when this "game" is actually a golf outright tournament.
  // homeTeam holds the tournament name; players[] holds the leaderboard.
  isOutright?: boolean;
  isTennis?: boolean;
  /** Set when The Odds API returned no lines for this game's sport because
   *  every key hit a quota / auth error (e.g. OUT_OF_USAGE_CREDITS). Used
   *  by the UI to distinguish "quota exhausted" from "lines not posted yet". */
  vegasQuotaExhausted?: boolean;
  players?: Array<{
    name: string;
    lines: Array<{ book: string; odds: number }>;
    bestOdds: number;
    bestBook: string;
  }>;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function fetchFullOdds(
  sportKey: string,
  useSecondary = false,
  trigger: string = "unknown",
  forceRefresh = false,
): Promise<FullGame[]> {
  const bypassCap = trigger === "manual";
  if (!bypassCap && isDailyCapReached()) {
    console.warn(`[oddsApi] Daily cap (${DAILY_CAP}) reached — skipping fetchFullOdds(${sportKey}) trigger=${trigger}`);
    return [];
  }
  incrementDaily();
  console.log(`[oddsApi] fetchFullOdds sport=${sportKey} trigger=${trigger} daily=${getDailyCount()}/${DAILY_CAP}`);
  const { data: resp, error } = await supabase.functions.invoke("fetch-sports-odds", {
    // Sportsbook API returns all sports in one /v0/advantages call. Don't
    // filter server-side — let the client tab filter handle it so a refresh
    // for one tab populates every tab.
    body: {
      regions: "us",
      markets: "h2h,spreads,totals",
      oddsFormat: "american",
      useSecondary,
      trigger,
      forceRefresh,
      sportKey: forceRefresh ? sportKey : undefined,
    },
  });
  if (error) {
    console.warn("fetch-sports-odds error:", error);
    return [];
  }
  console.log("[oddsApi] invoke response keys:", resp ? Object.keys(resp) : null,
    "data isArray:", Array.isArray(resp?.data), "length:", resp?.data?.length);
  if (resp?.data?.[0]) {
    console.log("[oddsApi] first game:", JSON.stringify(resp.data[0]).slice(0, 400));
    console.log("[useSportsOdds] first game bookmakers:",
      resp.data[0]?.bookmakers?.length,
      resp.data[0]?.bookmakers?.map((b: any) => b.key ?? b.name));
  }
  if (resp && typeof resp.remainingRequests === "number") {
    lastRemaining = resp.remainingRequests;
  }
  captureKeyResponse(resp);
  captureOddsApiStatus(resp);
  const quotaSports = new Set<string>(
    (resp?.oddsApiQuotaExhaustedSports ?? resp?.meta?.oddsApiQuotaExhaustedSports ?? []) as string[],
  );
  const data = resp?.data;
  if (!Array.isArray(data)) return [];

  const mapped = data.map((g: any): FullGame => {
    const home = g.home_team ?? "Home";
    const away = g.away_team ?? "Away";
    const gameSportKey = String(g.sport_key ?? sportKey ?? "");
    const vegasQuotaExhausted = quotaSports.has(gameSportKey);

    // Golf outright tournaments: bookmakers carry a single "outrights"
    // market with one outcome per player. Aggregate into a leaderboard.
    const isOutright = g.isOutright === true
      || (g.bookmakers ?? []).some((b: any) =>
        (b.markets ?? []).some((m: any) => m.key === "outrights"));
    if (isOutright) {
      const playerMap = new Map<string, Array<{ book: string; odds: number }>>();
      for (const b of (g.bookmakers ?? [])) {
        const out = (b.markets ?? []).find((m: any) => m.key === "outrights");
        if (!out?.outcomes) continue;
        for (const o of out.outcomes) {
          if (!o?.name) continue;
          if (!playerMap.has(o.name)) playerMap.set(o.name, []);
          playerMap.get(o.name)!.push({ book: b.title ?? b.key, odds: o.price ?? 0 });
        }
      }
      const players = [...playerMap.entries()]
        .map(([name, lines]) => {
          const best = lines.reduce(
            (b, l) => (l.odds > b.bestOdds ? { bestOdds: l.odds, bestBook: l.book } : b),
            { bestOdds: -99999, bestBook: "" },
          );
          return { name, lines, bestOdds: best.bestOdds, bestBook: best.bestBook };
        })
        .sort((a, b) => a.bestOdds - b.bestOdds); // favorites first (most negative / smallest positive)
      return {
        id: g.id,
        sport: g.sport_key ?? sportKey,
        league: g.sport_title ?? sportKey,
        homeTeam: home,
        awayTeam: away,
        commenceTime: g.commence_time ?? "",
        isLive: false,
        moneyline: { home: 0, away: 0, homeImplied: 0, awayImplied: 0,
          bestHomeBook: "", bestAwayBook: "", bestHomeOdds: 0, bestAwayOdds: 0 },
        spread: null,
        total: null,
        bookmakers: [],
        vegasConsensus: null,
        polymarketMatch: null,
        polymarketImplied: null,
        mispricingGap: null,
        isOutright: true,
        players,
        vegasQuotaExhausted,
      };
    }

    const books: FullBookmakerLine[] = (g.bookmakers ?? []).map((b: any) => {
      const h2h = b.markets?.find((m: any) => m.key === "h2h");
      const sp = b.markets?.find((m: any) => m.key === "spreads");
      const tot = b.markets?.find((m: any) => m.key === "totals");
      const homeML = h2h?.outcomes?.find((o: any) => o.name === home)?.price ?? 0;
      const awayML = h2h?.outcomes?.find((o: any) => o.name === away)?.price ?? 0;
      const drawML = h2h?.outcomes?.find((o: any) => o.name === "Draw")?.price ?? 0;
      const homeSpOut = sp?.outcomes?.find((o: any) => o.name === home);
      const awaySpOut = sp?.outcomes?.find((o: any) => o.name === away);
      const overOut = tot?.outcomes?.find((o: any) => o.name === "Over");
      const underOut = tot?.outcomes?.find((o: any) => o.name === "Under");
      return {
        name: b.title ?? b.key,
        key: b.key,
        category: (b.category as any) ?? "vegas",
        regulatoryNote: b.regulatoryNote ?? null,
        homeMoneyline: homeML,
        awayMoneyline: awayML,
        drawMoneyline: drawML,
        homeSpread: homeSpOut?.point ?? 0,
        spreadHomeOdds: homeSpOut?.price ?? 0,
        spreadAwayOdds: awaySpOut?.price ?? 0,
        totalLine: overOut?.point ?? 0,
        overOdds: overOut?.price ?? 0,
        underOdds: underOut?.price ?? 0,
      };
    });

    const homeBest = books.reduce(
      (best, b) => (b.homeMoneyline > best.odds ? { odds: b.homeMoneyline, book: b.name } : best),
      { odds: -99999, book: "" },
    );
    const awayBest = books.reduce(
      (best, b) => (b.awayMoneyline > best.odds ? { odds: b.awayMoneyline, book: b.name } : best),
      { odds: -99999, book: "" },
    );
    const homeImpliedRaw = books.length
      ? books.reduce((s, b) => s + toImplied(b.homeMoneyline), 0) / books.length
      : 0.5;
    const awayImpliedRaw = books.length
      ? books.reduce((s, b) => s + toImplied(b.awayMoneyline), 0) / books.length
      : 0.5;
    const consensus = removeVig(homeImpliedRaw, awayImpliedRaw);

    // Vegas-only consensus, used as the reference for prediction-market gaps.
    const vegasBooks = books.filter(
      (b) => b.category === "vegas" && (b.homeMoneyline !== 0 || b.awayMoneyline !== 0),
    );
    let vegasConsensus: FullGame["vegasConsensus"] = null;
    if (vegasBooks.length > 0) {
      const hRaw = vegasBooks.reduce((s, b) => s + toImplied(b.homeMoneyline), 0) / vegasBooks.length;
      const aRaw = vegasBooks.reduce((s, b) => s + toImplied(b.awayMoneyline), 0) / vegasBooks.length;
      const dv = removeVig(hRaw, aRaw);
      const impToAm = (p: number) =>
        p <= 0 || p >= 1 ? 0 : p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);
      vegasConsensus = {
        home: impToAm(dv.home),
        away: impToAm(dv.away),
        homeImplied: dv.home,
        awayImplied: dv.away,
      };
    }

    const spreadBooks = books.filter((b) => b.homeSpread !== 0 || b.spreadHomeOdds !== 0);
    const spread = spreadBooks.length
      ? {
          homeSpread: median(spreadBooks.map((b) => b.homeSpread)),
          awaySpread: -median(spreadBooks.map((b) => b.homeSpread)),
          homeOdds: median(spreadBooks.map((b) => b.spreadHomeOdds)),
          awayOdds: median(spreadBooks.map((b) => b.spreadAwayOdds)),
          bestBook: spreadBooks[0]?.name ?? "",
        }
      : null;

    const totalBooks = books.filter((b) => b.totalLine !== 0);
    const total = totalBooks.length
      ? {
          line: median(totalBooks.map((b) => b.totalLine)),
          overOdds: median(totalBooks.map((b) => b.overOdds)),
          underOdds: median(totalBooks.map((b) => b.underOdds)),
          bestBook: totalBooks[0]?.name ?? "",
        }
      : null;

    const commenceTime = g.commence_time ?? "";
    const isLive = commenceTime ? new Date(commenceTime).getTime() <= Date.now() : false;

    return {
      id: g.id,
      sport: g.sport_key ?? sportKey,
      league: g.sport_title ?? sportKey,
      homeTeam: home,
      awayTeam: away,
      commenceTime,
      isLive,
      moneyline: {
        home: books[0]?.homeMoneyline ?? 0,
        away: books[0]?.awayMoneyline ?? 0,
        homeImplied: consensus.home,
        awayImplied: consensus.away,
        bestHomeBook: homeBest.book,
        bestAwayBook: awayBest.book,
        bestHomeOdds: homeBest.odds,
        bestAwayOdds: awayBest.odds,
      },
      spread,
      total,
      bookmakers: books,
      vegasConsensus,
      polymarketMatch: null,
      polymarketImplied: null,
      mispricingGap: null,
      isTennis: g.isTennis === true || String(g.sport_key ?? "").startsWith("tennis_"),
      vegasQuotaExhausted,
    };
  });
  if (mapped[0]) {
    console.log("[useSportsOdds] stored game bookmakers:",
      mapped[0].bookmakers?.length,
      mapped[0].bookmakers?.map((b: any) => b.key ?? b.name));
  }
  return mapped;
}

let lastFullGames: FullGame[] = [];
export function getLastFullGames(): FullGame[] { return lastFullGames; }
export function setLastFullGames(g: FullGame[]) { lastFullGames = g; }

// ============= Odds API key/quota status =============
export type OddsApiKeyStatus = {
  code: string;
  message: string;
  status: number;
} | null;
export type OddsApiStatusSnapshot = {
  keys: { primary: OddsApiKeyStatus; secondary: OddsApiKeyStatus };
  quotaExhaustedSports: string[];
  fetchedAt: number;
};
let lastOddsApiStatus: OddsApiStatusSnapshot = {
  keys: { primary: null, secondary: null },
  quotaExhaustedSports: [],
  fetchedAt: 0,
};
export function getLastOddsApiStatus(): OddsApiStatusSnapshot { return lastOddsApiStatus; }
function captureOddsApiStatus(resp: any) {
  if (!resp) return;
  const keys = resp.oddsApiKeyStatus ?? resp.meta?.oddsApiKeyStatus ?? null;
  const sports = resp.oddsApiQuotaExhaustedSports
    ?? resp.meta?.oddsApiQuotaExhaustedSports
    ?? [];
  if (!keys && !Array.isArray(sports)) return;
  lastOddsApiStatus = {
    keys: {
      primary: keys?.primary ?? null,
      secondary: keys?.secondary ?? null,
    },
    quotaExhaustedSports: Array.isArray(sports) ? sports : [],
    fetchedAt: Date.now(),
  };
}

// ============= Sportsbook API cross-market gaps =============

export interface SportsbookGap {
  id: string;
  eventKey: string;
  eventName: string;
  league: string;
  marketType: "MONEYLINE" | "POINT_SPREAD" | "POINT_TOTAL";
  outcomeType: "WIN" | "OVER" | "UNDER";
  participant: string | null;
  modifier: number | null;
  predictionMarkets: Array<{ source: string; payout: number; american: number; implied: number }>;
  vegasBest: { source: string; payout: number; american: number; implied: number };
  edgePct: number;
  startTime: string;
}

let lastSportsbookGaps: SportsbookGap[] = [];
export function getLastSportsbookGaps(): SportsbookGap[] { return lastSportsbookGaps; }

/** Fetch the full /v0/advantages payload once. Returns parsed gaps + games. */
export async function fetchSportsbookGaps(trigger = "manual"): Promise<{
  gaps: SportsbookGap[];
  meta: { uniqueEventsReturned?: number; requestsUsedToday?: number; dailyLimit?: number } | null;
  remaining: number | null;
}> {
  const { data: resp, error } = await supabase.functions.invoke("fetch-cross-market-gaps", {
    body: { trigger },
  });
  if (error) {
    console.warn("fetchSportsbookGaps error", error);
    return { gaps: [], meta: null, remaining: null };
  }
  const gaps: SportsbookGap[] = Array.isArray(resp?.crossMarketGaps) ? resp.crossMarketGaps : [];
  lastSportsbookGaps = gaps;
  return {
    gaps,
    meta: resp?.meta ?? null,
    remaining: typeof resp?.remainingRequests === "number" ? resp.remainingRequests : null,
  };
}

/** Convert a SportsbookGap to a SportsMispricing for the existing UI. */
export function gapToMispricing(g: SportsbookGap): SportsMispricing {
  const bestPred = g.predictionMarkets[0];
  const polyImplied = bestPred?.implied ?? 0;
  const vegasImplied = g.vegasBest.implied;
  const spread = Math.abs(g.edgePct) / 100;
  const direction: "YES" | "NO" = g.edgePct > 0 ? "YES" : "NO";
  const teams = (g.eventName || "").split(/\s+(?:@|vs\.?)\s+/i);
  const away = teams[0] ?? "";
  const home = teams[1] ?? "";
  const label = g.marketType === "POINT_TOTAL"
    ? `${g.outcomeType} ${g.modifier ?? ""}`
    : g.marketType === "POINT_SPREAD"
      ? `${g.participant ?? ""} ${g.modifier ?? ""}`
      : (g.participant ?? "");
  const stubGame: OddsGame = {
    id: g.eventKey,
    sport: g.league.toLowerCase(),
    league: g.league,
    homeTeam: home,
    awayTeam: away,
    commenceTime: g.startTime,
    bookmakers: [],
    consensusProb: { home: vegasImplied, away: 1 - vegasImplied },
  };
  const polyStub: Market = {
    id: `sportsbook-gap-${g.id}`,
    question: `${g.eventName} — ${label}`,
    category: g.league,
    yesPrice: polyImplied,
    noPrice: 1 - polyImplied,
    volume24h: 0,
    totalVolume: 0,
    endDate: g.startTime,
    trend: "flat",
    change24h: 0,
    source: bestPred?.source === "kalshi" ? "kalshi" : "polymarket",
  };
  return {
    id: g.id,
    question: `${g.eventName} — ${label}`,
    game: stubGame,
    polymarket: polyStub,
    polyImplied,
    vegasImplied,
    spread,
    edge: spread,
    direction,
    favoredSide: g.participant ?? g.outcomeType,
    bestBook: g.vegasBest.source,
    bestOdds: g.vegasBest.american,
    confidence: Math.min(Math.round(spread * 600 + 50), 95),
    league: g.league,
    claudeAnalysis: null,
  };
}

// ============= Formatting helpers =============

export function formatOdds(american: number): string {
  if (!american || american === 0) return "N/A";
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function formatGameTime(iso: string): string {
  if (!iso) return "TBD";
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  if (date.toDateString() === now.toDateString()) return `Today · ${timeStr}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${timeStr}`;
  return (
    date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    ` · ${timeStr}`
  );
}

export function getBestMoneyline(
  bookmakers: FullBookmakerLine[],
  side: "home" | "away",
): { odds: number; book: string } {
  let best = { odds: -99999, book: "" };
  for (const b of bookmakers) {
    const odds = side === "home" ? b.homeMoneyline : b.awayMoneyline;
    if (odds > best.odds) best = { odds, book: b.name };
  }
  return best;
}

// ============= Player Props =============

export interface PropBookmakerLine {
  name: string;
  overOdds: number;
  underOdds: number;
  line: number;
}

export interface PlayerProp {
  playerName: string;
  propType: string;
  description: string;
  line: number;
  overOdds: number;
  underOdds: number;
  overImplied: number;
  underImplied: number;
  bestOverBook: string;
  bestUnderBook: string;
  bestOverOdds: number;
  bestUnderOdds: number;
  bookmakers: PropBookmakerLine[];
}

export interface GameProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  fetchedAt: number;
  props: PlayerProp[];
  propTypes: string[];
}

const PROP_MARKETS: Record<string, string[]> = {
  americanfootball_nfl: [
    "player_pass_yds", "player_pass_tds", "player_pass_interceptions",
    "player_rush_yds", "player_rush_attempts",
    "player_receptions", "player_reception_yds", "player_reception_tds",
    "player_anytime_td",
  ],
  basketball_nba: [
    "player_points", "player_rebounds", "player_assists",
    "player_threes", "player_blocks", "player_steals",
    "player_points_rebounds_assists", "player_points_rebounds", "player_points_assists",
  ],
  baseball_mlb: [
    "batter_home_runs", "batter_hits", "batter_rbis", "batter_runs_scored",
    "batter_total_bases", "pitcher_strikeouts", "pitcher_hits_allowed", "pitcher_walks",
  ],
  icehockey_nhl: [
    "player_goals", "player_assists", "player_points",
    "player_shots_on_goal", "player_blocked_shots", "goalie_saves",
  ],
};

const PROP_NAMES: Record<string, string> = {
  player_pass_yds: "Passing Yards",
  player_pass_tds: "Passing TDs",
  player_pass_interceptions: "Interceptions",
  player_rush_yds: "Rushing Yards",
  player_rush_attempts: "Rush Attempts",
  player_receptions: "Receptions",
  player_reception_yds: "Receiving Yards",
  player_reception_tds: "Receiving TDs",
  player_anytime_td: "Anytime TD",
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "3-Pointers Made",
  player_blocks: "Blocks",
  player_steals: "Steals",
  player_points_rebounds_assists: "Pts+Reb+Ast",
  player_points_rebounds: "Pts+Reb",
  player_points_assists: "Pts+Ast",
  batter_home_runs: "Home Runs",
  batter_hits: "Hits",
  batter_rbis: "RBIs",
  batter_runs_scored: "Runs Scored",
  batter_total_bases: "Total Bases",
  pitcher_strikeouts: "Strikeouts",
  pitcher_hits_allowed: "Hits Allowed",
  pitcher_walks: "Walks",
  player_goals: "Goals",
  goalie_saves: "Saves",
  player_shots_on_goal: "Shots on Goal",
  player_blocked_shots: "Blocked Shots",
};

export function formatPropType(key: string): string {
  if (PROP_NAMES[key]) return PROP_NAMES[key];
  return key
    .replace(/^(player_|batter_|pitcher_|goalie_)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function hasPropsSupport(sportKey: string): boolean {
  return !!PROP_MARKETS[sportKey];
}

export async function fetchGameProps(
  sportKey: string,
  gameId: string,
  trigger: string = "unknown",
): Promise<GameProps | null> {
  const propMarkets = PROP_MARKETS[sportKey];
  if (!propMarkets) return null;
  const bypassCap = trigger === "manual";
  if (!bypassCap && isDailyCapReached()) {
    console.warn(`[oddsApi] Daily cap (${DAILY_CAP}) reached — skipping fetchGameProps(${gameId}) trigger=${trigger}`);
    return null;
  }
  incrementDaily();
  console.log(`[oddsApi] fetchGameProps gameId=${gameId} trigger=${trigger} daily=${getDailyCount()}/${DAILY_CAP}`);

  const { data: resp, error } = await supabase.functions.invoke("fetch-sports-odds", {
    body: {
      sportKey,
      eventId: gameId,
      regions: "us",
      markets: propMarkets.join(","),
      oddsFormat: "american",
      trigger,
    },
  });
  if (error) {
    console.warn("fetchGameProps error:", error);
    return null;
  }
  if (resp && typeof resp.remainingRequests === "number") {
    lastRemaining = resp.remainingRequests;
  }
  captureKeyResponse(resp);
  const data = resp?.data;
  if (!data) return null;

  const props: PlayerProp[] = [];
  const propTypes = new Set<string>();

  for (const bookmaker of data.bookmakers ?? []) {
    const bookName = bookmaker.title ?? bookmaker.key;
    for (const market of bookmaker.markets ?? []) {
      propTypes.add(market.key);
      const playerGroups: Record<string, any[]> = {};
      for (const outcome of market.outcomes ?? []) {
        const key = outcome.description ?? outcome.name;
        if (!key) continue;
        if (!playerGroups[key]) playerGroups[key] = [];
        playerGroups[key].push(outcome);
      }
      for (const [player, outcomes] of Object.entries(playerGroups)) {
        const over = outcomes.find((o) => o.name === "Over");
        const under = outcomes.find((o) => o.name === "Under");
        if (!over && !under) continue;
        const line = over?.point ?? under?.point ?? 0;
        const overPrice = over?.price ?? 0;
        const underPrice = under?.price ?? 0;

        const existing = props.find(
          (p) => p.playerName === player && p.propType === market.key && p.line === line,
        );
        if (existing) {
          existing.bookmakers.push({ name: bookName, overOdds: overPrice, underOdds: underPrice, line });
          if (overPrice > existing.bestOverOdds) {
            existing.bestOverOdds = overPrice;
            existing.bestOverBook = bookName;
          }
          if (underPrice > existing.bestUnderOdds) {
            existing.bestUnderOdds = underPrice;
            existing.bestUnderBook = bookName;
          }
        } else {
          props.push({
            playerName: player,
            propType: market.key,
            description: formatPropType(market.key),
            line,
            overOdds: overPrice,
            underOdds: underPrice,
            overImplied: toImplied(overPrice),
            underImplied: toImplied(underPrice),
            bestOverBook: bookName,
            bestUnderBook: bookName,
            bestOverOdds: overPrice,
            bestUnderOdds: underPrice,
            bookmakers: [{ name: bookName, overOdds: overPrice, underOdds: underPrice, line }],
          });
        }
      }
    }
  }

  return {
    gameId,
    homeTeam: data.home_team ?? "",
    awayTeam: data.away_team ?? "",
    fetchedAt: Date.now(),
    props: props.sort(
      (a, b) => a.propType.localeCompare(b.propType) || a.playerName.localeCompare(b.playerName),
    ),
    propTypes: [...propTypes],
  };
}

export function findPropEdge(prop: PlayerProp): {
  side: "over" | "under";
  odds: number;
  book: string;
  edge: number;
} | null {
  if (prop.bookmakers.length < 2) return null;
  const overOdds = prop.bookmakers.map((b) => b.overOdds).filter((o) => o !== 0);
  const underOdds = prop.bookmakers.map((b) => b.underOdds).filter((o) => o !== 0);
  if (overOdds.length < 2 && underOdds.length < 2) return null;

  const bestOver = overOdds.length ? Math.max(...overOdds) : 0;
  const worstOver = overOdds.length ? Math.min(...overOdds) : 0;
  const bestUnder = underOdds.length ? Math.max(...underOdds) : 0;
  const worstUnder = underOdds.length ? Math.min(...underOdds) : 0;

  const overSpread = overOdds.length >= 2 ? Math.abs(toImplied(worstOver) - toImplied(bestOver)) : 0;
  const underSpread = underOdds.length >= 2 ? Math.abs(toImplied(worstUnder) - toImplied(bestUnder)) : 0;

  if (overSpread > underSpread && overSpread > 0.03) {
    const book = prop.bookmakers.find((b) => b.overOdds === bestOver)?.name ?? "";
    return { side: "over", odds: bestOver, book, edge: overSpread };
  }
  if (underSpread > 0.03) {
    const book = prop.bookmakers.find((b) => b.underOdds === bestUnder)?.name ?? "";
    return { side: "under", odds: bestUnder, book, edge: underSpread };
  }
  return null;
}

export async function fetchOdds(sportKey: string, trigger: string = "unknown"): Promise<OddsGame[]> {
  const bypassCap = trigger === "manual";
  if (!bypassCap && isDailyCapReached()) {
    console.warn(`[oddsApi] Daily cap (${DAILY_CAP}) reached — skipping fetchOdds(${sportKey}) trigger=${trigger}`);
    return [];
  }
  incrementDaily();
  console.log(`[oddsApi] fetchOdds sport=${sportKey} trigger=${trigger} daily=${getDailyCount()}/${DAILY_CAP}`);
  const { data: resp, error } = await supabase.functions.invoke("fetch-sports-odds", {
    body: { sportKey, regions: "us", markets: "h2h", oddsFormat: "american", trigger },
  });
  console.log("Edge function response:", resp);
  console.log("Edge function error:", error);
  lastEdgeResponse = resp;
  lastEdgeError = error;
  if (error) {
    console.warn("fetch-sports-odds error:", error);
    return [];
  }
  if (resp && typeof resp.remainingRequests === "number") {
    lastRemaining = resp.remainingRequests;
  }
  const data = resp?.data;
  if (!Array.isArray(data)) return [];
  return data.map((g: any): OddsGame => {
    const books: OddsBookmaker[] = (g.bookmakers ?? []).map((b: any) => {
      const outcomes = b.markets?.[0]?.outcomes ?? [];
      const homePrice = outcomes.find((o: any) => o.name === g.home_team)?.price ?? 0;
      const awayPrice = outcomes.find((o: any) => o.name === g.away_team)?.price ?? 0;
      return { key: b.key, title: b.title, homeOdds: homePrice, awayOdds: awayPrice };
    });
    const rawHome = books.length > 0
      ? books.reduce((s, b) => s + toImplied(b.homeOdds), 0) / books.length
      : 0.5;
    const rawAway = books.length > 0
      ? books.reduce((s, b) => s + toImplied(b.awayOdds), 0) / books.length
      : 0.5;
    const consensus = removeVig(rawHome, rawAway);
    return {
      id: g.id,
      sport: sportKey,
      league: g.sport_title ?? sportKey,
      homeTeam: g.home_team ?? "Home",
      awayTeam: g.away_team ?? "Away",
      commenceTime: g.commence_time ?? "",
      bookmakers: books,
      consensusProb: consensus,
    };
  });
}

const SPORTS_KEYWORDS = [
  "win", "champion", "title", "cup", "bowl", "series",
  "league", "tournament", "match", "game", "beat",
  "defeat", "playoffs", "finals", "nfl", "nba", "mlb",
  "nhl", "soccer", "football", "basketball", "baseball",
  "hockey", "tennis", "golf", "ufc", "mma", "fight",
  "player", "team", "score", "season",
];

const NFL_NICKNAMES: Record<string, string[]> = {
  chiefs: ["kansas", "city", "kc"],
  patriots: ["new", "england"],
  cowboys: ["dallas"],
  eagles: ["philadelphia"],
  niners: ["san", "francisco", "49ers"],
  packers: ["green", "bay"],
  ravens: ["baltimore"],
  steelers: ["pittsburgh"],
  bills: ["buffalo"],
  dolphins: ["miami"],
  bears: ["chicago"],
  lions: ["detroit"],
  vikings: ["minnesota"],
  giants: ["new", "york"],
  jets: ["new", "york"],
};

const NBA_NICKNAMES: Record<string, string[]> = {
  lakers: ["los", "angeles", "la"],
  celtics: ["boston"],
  warriors: ["golden", "state"],
  bulls: ["chicago"],
  heat: ["miami"],
  knicks: ["new", "york"],
  nets: ["brooklyn"],
  sixers: ["philadelphia"],
  bucks: ["milwaukee"],
  nuggets: ["denver"],
};

const ALL_NICKNAMES: Record<string, string[]> = { ...NFL_NICKNAMES, ...NBA_NICKNAMES };

export function isSportsMarket(market: Market): boolean {
  const q = market.question.toLowerCase();
  return (
    market.category === "Sports" ||
    SPORTS_KEYWORDS.some((k) => q.includes(k))
  );
}

function matchGame(market: Market, games: OddsGame[]): OddsGame | null {
  const q = market.question.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  if (!isSportsMarket(market)) return null;

  let bestMatch: OddsGame | null = null;
  let bestScore = 0;

  for (const game of games) {
    let score = 0;
    const homeWords = game.homeTeam
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .filter((w) => w.length > 2);
    const awayWords = game.awayTeam
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .filter((w) => w.length > 2);

    for (const w of homeWords) if (q.includes(w)) score += 2;
    for (const w of awayWords) if (q.includes(w)) score += 2;

    if (q.includes(game.league.toLowerCase())) score += 3;
    if (q.includes(game.sport.toLowerCase())) score += 1;

    const teamStr = `${game.homeTeam.toLowerCase()} ${game.awayTeam.toLowerCase()}`;
    for (const [nickname, aliases] of Object.entries(ALL_NICKNAMES)) {
      if (teamStr.includes(nickname) && aliases.some((a) => q.includes(a))) score += 4;
      if (q.includes(nickname) && aliases.some((a) => teamStr.includes(a))) score += 4;
    }

    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = game;
    }
  }
  return bestMatch;
}

export async function fetchPolymarketSportsMarkets(
  polymarkets: Market[],
): Promise<Market[]> {
  const markets = polymarkets.filter((m) => isSportsMarket(m));
  console.log("Polymarket sports candidates:", markets.length);
  console.log("Sample questions:", markets.slice(0, 3).map((m) => m.question));
  return markets;
}

export interface SportsScanDebug {
  vegasGamesFetched: number;
  polymarketSportsMarkets: number;
  matchesAttempted: number;
  matchesFound: number;
  gapsAboveThreshold: number;
}

let lastDebug: SportsScanDebug = {
  vegasGamesFetched: 0,
  polymarketSportsMarkets: 0,
  matchesAttempted: 0,
  matchesFound: 0,
  gapsAboveThreshold: 0,
};

export function getLastScanDebug(): SportsScanDebug {
  return lastDebug;
}

export async function findSportsMispricings(
  polymarkets: Market[],
  apiKey: string,
  minGap = 0.02,
  trigger: string = "unknown",
): Promise<SportsMispricing[]> {
  void apiKey;
  const results = await Promise.allSettled(SPORTS.slice(0, 4).map((s) => fetchOdds(s.key, trigger)));
  const allGames = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<OddsGame[]>).value);

  const sportsMarkets = polymarkets.filter((m) => isSportsMarket(m));

  lastDebug = {
    vegasGamesFetched: allGames.length,
    polymarketSportsMarkets: sportsMarkets.length,
    matchesAttempted: sportsMarkets.length,
    matchesFound: 0,
    gapsAboveThreshold: 0,
  };
  lastGames = allGames;

  if (allGames.length === 0) return [];

  const mispricings: SportsMispricing[] = [];
  for (const market of sportsMarkets) {
    const game = matchGame(market, allGames);
    if (!game) continue;
    lastDebug.matchesFound++;
    const polyProb = market.yesPrice;
    const vegasProb = game.consensusProb.home;
    const spread = Math.abs(polyProb - vegasProb);
    if (spread < minGap) continue;
    lastDebug.gapsAboveThreshold++;
    const direction: "YES" | "NO" = polyProb < vegasProb ? "YES" : "NO";
    const bestBook = [...game.bookmakers].sort(
      (a, b) => toImplied(b.homeOdds) - toImplied(a.homeOdds),
    )[0];
    mispricings.push({
      id: `sports_${game.id}_${Date.now()}`,
      question: market.question,
      game,
      polymarket: market,
      polyImplied: polyProb,
      vegasImplied: vegasProb,
      spread,
      edge: spread * 0.8,
      direction,
      favoredSide: direction === "YES" ? game.homeTeam : game.awayTeam,
      bestBook: bestBook?.title ?? "Consensus",
      bestOdds: bestBook?.homeOdds ?? 0,
      confidence: Math.min(Math.round(spread * 350 + 40), 92),
      league: game.league,
      claudeAnalysis: null,
    });
  }
  return mispricings.sort((a, b) => b.spread - a.spread).slice(0, 10);
}
