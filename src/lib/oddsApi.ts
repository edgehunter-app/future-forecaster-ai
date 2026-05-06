import type { Market } from "@/types";
import { supabase } from "@/integrations/supabase/client";

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
  { key: "mma_mixed_martial_arts", label: "MMA", icon: "zap" },
  { key: "tennis_atp_french_open", label: "Tennis", icon: "circle" },
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
  homeMoneyline: number;
  awayMoneyline: number;
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
  awayTeam: string;
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
  polymarketMatch: Market | null;
  polymarketImplied: number | null;
  mispricingGap: number | null;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function fetchFullOdds(sportKey: string): Promise<FullGame[]> {
  const { data: resp, error } = await supabase.functions.invoke("fetch-sports-odds", {
    body: { sportKey, regions: "us", markets: "h2h,spreads,totals", oddsFormat: "american" },
  });
  if (error) {
    console.warn("fetch-sports-odds error:", error);
    return [];
  }
  if (resp && typeof resp.remainingRequests === "number") {
    lastRemaining = resp.remainingRequests;
  }
  const data = resp?.data;
  if (!Array.isArray(data)) return [];

  return data.map((g: any): FullGame => {
    const home = g.home_team ?? "Home";
    const away = g.away_team ?? "Away";
    const books: FullBookmakerLine[] = (g.bookmakers ?? []).map((b: any) => {
      const h2h = b.markets?.find((m: any) => m.key === "h2h");
      const sp = b.markets?.find((m: any) => m.key === "spreads");
      const tot = b.markets?.find((m: any) => m.key === "totals");
      const homeML = h2h?.outcomes?.find((o: any) => o.name === home)?.price ?? 0;
      const awayML = h2h?.outcomes?.find((o: any) => o.name === away)?.price ?? 0;
      const homeSpOut = sp?.outcomes?.find((o: any) => o.name === home);
      const awaySpOut = sp?.outcomes?.find((o: any) => o.name === away);
      const overOut = tot?.outcomes?.find((o: any) => o.name === "Over");
      const underOut = tot?.outcomes?.find((o: any) => o.name === "Under");
      return {
        name: b.title ?? b.key,
        key: b.key,
        homeMoneyline: homeML,
        awayMoneyline: awayML,
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
      sport: sportKey,
      league: g.sport_title ?? sportKey,
      homeTeam: home,
      awayTeam: away,
      commenceTime,
      isLive,
      moneyline: {
        home: Math.round(homeImpliedRaw && consensus.home > 0 ? 0 : 0) || (books[0]?.homeMoneyline ?? 0),
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
      polymarketMatch: null,
      polymarketImplied: null,
      mispricingGap: null,
    };
  });
}

let lastFullGames: FullGame[] = [];
export function getLastFullGames(): FullGame[] { return lastFullGames; }
export function setLastFullGames(g: FullGame[]) { lastFullGames = g; }

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

export async function fetchOdds(sportKey: string): Promise<OddsGame[]> {
  const { data: resp, error } = await supabase.functions.invoke("fetch-sports-odds", {
    body: { sportKey, regions: "us", markets: "h2h", oddsFormat: "american" },
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
): Promise<SportsMispricing[]> {
  void apiKey;
  const results = await Promise.allSettled(SPORTS.slice(0, 4).map((s) => fetchOdds(s.key)));
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
