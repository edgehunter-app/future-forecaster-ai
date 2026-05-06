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
