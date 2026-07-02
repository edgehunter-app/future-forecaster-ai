import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Brain, Loader2, AlertCircle, TrendingUp, Clock, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import GolfAnalysisPanel, { type GolfAnalysisResult } from "./GolfAnalysisPanel";
import { cn } from "@/lib/utils";
import {
  formatOdds,
  formatSpread,
  formatGameTime,
  getBestMoneyline,
  findPropEdge,
  formatPropType,
  type FullGame,
  type FullBookmakerLine,
  type PlayerProp,
  type SportsMispricing,
} from "@/lib/oddsApi";
import GamblingDisclaimer from "./GamblingDisclaimer";
import PlayerPropsPanel from "./PlayerPropsPanel";
import { useGameProps } from "@/hooks/useGameProps";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { useGameOdds } from "@/hooks/useGameOdds";
import GameAnalysisPanel from "./GameAnalysisPanel";
import { hasPropsSupport } from "@/lib/oddsApi";
import type { GolfTournament, GolfLeaderboard, GolfLeaderboardRow } from "@/hooks/useGolfData";

export interface GolfDataProps {
  tournament: GolfTournament | null;
  leaderboard: GolfLeaderboard | null;
  isLive: boolean;
  loading: boolean;
  onRefresh: () => void;
}

// Major-tournament metadata. Odds API outright markets only cover the 4 majors,
// and their `commence_time` is the betting-market open time (not tee time) which
// is misleading. We map by name fragment to a human-friendly date + venue.
const MAJOR_INFO: { match: string; range: string; venue: string }[] = [
  { match: "the open", range: "Jul 17–20, 2026", venue: "Royal Portrush" },
  { match: "british open", range: "Jul 17–20, 2026", venue: "Royal Portrush" },
  { match: "masters", range: "Apr 9–12, 2026", venue: "Augusta National" },
  { match: "pga championship", range: "May 14–17, 2026", venue: "Quail Hollow" },
  { match: "u.s. open", range: "Jun 18–21, 2026", venue: "Shinnecock Hills" },
  { match: "us open", range: "Jun 18–21, 2026", venue: "Shinnecock Hills" },
];
function getMajorInfo(name: string | undefined | null) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return MAJOR_INFO.find((m) => lower.includes(m.match)) ?? null;
}

function formatTournamentRange(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "";
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (sameMonth) {
    return `${month(s)} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  return `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

function getTournamentStatus(startDate: Date, endDate: Date) {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  if (todayStr > endStr) return { label: "Complete", color: "gray" };

  if (todayStr >= startStr && todayStr <= endStr) {
    return { label: "🟢 LIVE", color: "green", pulse: true };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA");

  if (startStr === tomorrowStr) return { label: "Tomorrow", color: "blue" };

  const month = startDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = startDate.getUTCDate();

  return { label: `${month} ${day}`, color: "gray" };
}


interface Props {
  games: FullGame[];
  loading: boolean;
  mispricings?: SportsMispricing[];
  onRefresh?: () => void;
  golfData?: GolfDataProps;
}

type Tab = "games" | "best" | "spreads" | "totals" | "props";

const TABS: { key: Tab; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "best", label: "Best Odds" },
  { key: "spreads", label: "Spreads" },
  { key: "totals", label: "Over/Under" },
  { key: "props", label: "Props" },
];

function oddsClass(odds: number): string {
  if (!odds) return "text-muted-foreground";
  return odds > 0 ? "text-success" : "text-destructive";
}

export default function OddsBoard({ games, loading, mispricings = [], onRefresh, golfData }: Props) {
  const [tab, setTab] = useState<Tab>("games");

  if (loading && games.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-foreground">No games with live odds right now</p>
        <p className="text-sm text-muted-foreground">Check back later today for tonight's slate</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              tab === t.key
                ? "border-info bg-info text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "games" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((g) =>
            g.isOutright && g.players?.length
              ? <GolfLeaderboardCard key={g.id} game={g} golf={golfData} />
              : <GameCard key={g.id} game={g} mispricings={mispricings} />,
          )}
        </div>
      )}

      {tab === "best" && <BestOddsTable games={games} />}
      {tab === "spreads" && <SpreadsTab games={games} />}
      {tab === "totals" && <TotalsTab games={games} />}
      {tab === "props" && <PropsTab games={games} />}
    </div>
  );
}

function GameCard({ game, mispricings }: { game: FullGame; mispricings: SportsMispricing[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const { bookmakers, loading: oddsLoading, fetched: oddsFetched, fetchOdds } = useGameOdds(game);
  if (import.meta.env.DEV) {
    console.log("[GameCard] bookmakers received:",
      bookmakers.length,
      bookmakers.map((b) => b.key ?? b.name));
  }
  const booksWithOdds = bookmakers.filter(
    (b) => b.homeMoneyline !== 0 || b.awayMoneyline !== 0,
  );
  const vegasBookCount = booksWithOdds.filter((b) => b.category !== "prediction_market").length;
  const hasBookmakers = booksWithOdds.length > 0;
  const homeOdds = game.moneyline?.home ?? 0;
  const awayOdds = game.moneyline?.away ?? 0;
  const homeImplied = game.moneyline?.homeImplied ?? 0;
  const awayImplied = game.moneyline?.awayImplied ?? 0;
  const bestHome = hasBookmakers ? getBestMoneyline(booksWithOdds, "home") : { odds: homeOdds, book: "" };
  const bestAway = hasBookmakers ? getBestMoneyline(booksWithOdds, "away") : { odds: awayOdds, book: "" };
  const { analyzeGame, clearResult, isAnalyzing, getResult, getError } = useGameAnalysis();
  const result = getResult(game.id);
  const analyzing = isAnalyzing(game.id);
  const error = getError(game.id);

  const polyMispricing = mispricings.find((m) => m.game?.id === game.id);
  const polyGap = polyMispricing
    ? { polyImplied: polyMispricing.polyImplied, gap: polyMispricing.spread }
    : game.polymarketImplied !== null && game.mispricingGap !== null
      ? { polyImplied: game.polymarketImplied, gap: game.mispricingGap }
      : null;

  // Detect prediction-market gaps for the header badge
  const predictionMarketGaps = bookmakers
    .filter((b) => b.category === "prediction_market" && game.vegasConsensus)
    .map((b) => {
      const home = b.homeMoneyline - (game.vegasConsensus!.home || 0);
      const away = b.awayMoneyline - (game.vegasConsensus!.away || 0);
      const maxAbs = Math.abs(home) >= Math.abs(away) ? home : away;
      return { book: b.name, side: Math.abs(home) >= Math.abs(away) ? "Home" : "Away", cents: maxAbs };
    })
    .filter((g) => Math.abs(g.cents) > 5)
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  const topGap = predictionMarketGaps[0];

  const linesPending = vegasBookCount < 2;
  const kalshiBook = bookmakers.find((b) => b.key === "kalshi");

  const handleAnalyze = () => {
    void fetchOdds();
    const kalshi = bookmakers.find((b) => b.key === "kalshi");
    const polymarket = bookmakers.find((b) => b.key === "polymarket");
    analyzeGame(game, polyGap, { kalshi, polymarket }, bookmakers);
  };

  const handleCompareToggle = () => {
    setExpanded((v) => {
      const next = !v;
      if (next) void fetchOdds();
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          {game.league}
        </span>
        <div className="flex items-center gap-2">
          {game.isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              LIVE
            </span>
          )}
          <span className="text-[11px] font-mono text-muted-foreground">{formatGameTime(game.commenceTime)}</span>
        </div>
      </div>

      {/* Prediction-market gap badge */}
      {topGap && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning hover:bg-warning/20"
        >
          <TrendingUp className="h-3 w-3" />
          {topGap.book} Gap: {topGap.cents > 0 ? "+" : ""}{topGap.cents} cents ({topGap.side})
        </button>
      )}

      {/* Matchup row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <div className="text-sm font-bold text-foreground line-clamp-1">{game.awayTeam}</div>
          <div className={cn("text-xl font-extrabold mt-1", oddsClass(awayOdds))}>
            {formatOdds(awayOdds)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {(awayImplied * 100).toFixed(0)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase text-muted-foreground">vs</div>
          {game.spread && (
            <div className="mt-1 text-[10px] font-mono text-foreground">
              {game.spread.homeSpread < 0 ? game.homeTeam.split(" ").pop() : game.awayTeam.split(" ").pop()}{" "}
              {formatSpread(game.spread.homeSpread < 0 ? game.spread.homeSpread : game.spread.awaySpread)}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-foreground line-clamp-1">{game.homeTeam}</div>
          <div className={cn("text-xl font-extrabold mt-1", oddsClass(homeOdds))}>
            {formatOdds(homeOdds)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {(homeImplied * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Markets row */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Market label="Moneyline">
          <div className={oddsClass(awayOdds)}>A {formatOdds(awayOdds)}</div>
          <div className={oddsClass(homeOdds)}>H {formatOdds(homeOdds)}</div>
        </Market>
        <Market label="Spread">
          {game.spread ? (
            <>
              <div>A {formatSpread(game.spread.awaySpread)} ({formatOdds(game.spread.awayOdds)})</div>
              <div>H {formatSpread(game.spread.homeSpread)} ({formatOdds(game.spread.homeOdds)})</div>
            </>
          ) : <div className="text-muted-foreground">—</div>}
        </Market>
        <Market label="O/U">
          {game.total ? (
            <>
              <div>O {game.total.line} ({formatOdds(game.total.overOdds)})</div>
              <div>U {game.total.line} ({formatOdds(game.total.underOdds)})</div>
            </>
          ) : <div className="text-muted-foreground">—</div>}
        </Market>
      </div>

      {/* Polymarket row */}
      {game.polymarketMatch && game.polymarketImplied !== null && game.mispricingGap !== null && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          <div className="font-semibold">
            Polymarket: {(game.polymarketImplied * 100).toFixed(0)}% YES · Gap: {(game.mispricingGap * 100).toFixed(1)}%
          </div>
          <div className="opacity-80">Potential edge vs Vegas consensus</div>
        </div>
      )}

      {/* Compare books — hidden entirely while lines are pending */}
      {linesPending ? (
        <div className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Lines posting soon</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-snug">
            Vegas books typically post 24–36h before first pitch.
          </p>
          {kalshiBook && (kalshiBook.homeMoneyline !== 0 || kalshiBook.awayMoneyline !== 0) && (
            <div className="mt-1.5 rounded-md border border-info/30 bg-info/5 px-2 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-foreground">
                  Kalshi: {game.awayTeam.split(" ").pop()} {formatOdds(kalshiBook.awayMoneyline)}
                  {" · "}
                  {game.homeTeam.split(" ").pop()} {formatOdds(kalshiBook.homeMoneyline)}
                </span>
                <span className="rounded-sm border border-info/40 bg-info/10 px-1 py-px text-[8px] font-bold text-info whitespace-nowrap">
                  Prediction market only
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="rounded-md border border-border/60">
        <button
          onClick={handleCompareToggle}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <span>
            {oddsLoading
              ? "Loading lines…"
              : booksWithOdds.length >= 2
                ? `Compare ${booksWithOdds.length} books`
                : "Compare books"}
          </span>
          {oddsLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {expanded && (
          oddsLoading ? (
            <div className="border-t border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1.5" />
              Loading sportsbook lines…
            </div>
          ) : booksWithOdds.length >= 2 ? (
            <BookTable
              books={booksWithOdds}
              bestHome={bestHome}
              bestAway={bestAway}
              vegasConsensus={game.vegasConsensus}
            />
          ) : (
            <div className="border-t border-border/60 px-3 py-4 text-center space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                {oddsFetched ? "No sportsbook lines posted yet" : "Full lines not yet available"}
              </p>
              <p className="text-[10px] text-muted-foreground/70">Check back closer to game time</p>
            </div>
          )
        )}
      </div>
      )}

      {/* Claude AI Analysis */}
      {result ? (
        <GameAnalysisPanel result={result} game={game} onClear={() => clearResult(game.id)} />
      ) : linesPending ? (
        <div className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/30 px-3 h-[52px] sm:h-11 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Analysis available once lines post</span>
        </div>
      ) : (
        <>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || oddsLoading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md bg-purple px-3 text-white font-semibold transition-colors hover:bg-purple/90 disabled:opacity-60",
              "h-[52px] sm:h-11",
            )}
          >
            {analyzing || oddsLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{oddsLoading ? "Loading lines…" : "Analyzing…"}</span>
              </>
            ) : (
              <div className="flex items-center gap-2 text-left">
                <Brain className="h-4 w-4" />
                <div>
                  <div className="text-sm leading-tight">
                    Analyze with Claude
                  </div>
                  <div className="text-[10px] opacity-80 leading-tight">
                    {vegasBookCount < 2
                      ? "Fetches full sportsbook lines on demand"
                      : "AI edge detection for this game"}
                  </div>
                </div>
              </div>
            )}
          </button>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] text-destructive">{error}</p>
                <button
                  onClick={handleAnalyze}
                  className="mt-1.5 rounded-md border border-destructive/40 bg-background px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Player Props toggle */}
      <div className="rounded-md border border-info/30 bg-info/5">
        <button
          onClick={() => setShowProps((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold transition-colors",
            showProps ? "text-info" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span>{showProps ? "Hide Player Props" : "Show Player Props"}</span>
          <span className="text-[10px] opacity-70">{showProps ? "▲" : "▼"}</span>
        </button>
        {showProps && <PlayerPropsPanel game={game} sportKey={game.sport} />}
      </div>

      <GamblingDisclaimer variant="inline" />
    </div>
  );
}

function Market({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="text-[9px] uppercase font-semibold text-muted-foreground mb-1">{label}</div>
      <div className="font-mono space-y-0.5">{children}</div>
    </div>
  );
}

export function GolfLeaderboardCard({
  game,
  golf,
}: {
  game?: FullGame;
  golf?: GolfDataProps;
}) {
  const [expanded, setExpanded] = useState(false);
  const tournament = golf?.tournament ?? null;
  const leaderboard = golf?.leaderboard ?? null;
  const loading = !!golf?.loading;
  const fetchCurrent = golf?.onRefresh ?? (() => {});
  const players = game?.players ?? [];
  const settings = useAppStore((s) => s.settings);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GolfAnalysisResult | null>(null);


  if (!game && !tournament) return null;

  const bookNames = Array.from(
    new Set(players.flatMap((p) => p.lines.map((l) => l.book))),
  ).slice(0, 4);

  // Index odds by lowercased last name for quick lookup.
  const oddsByLastName = useMemo(() => {
    const map = new Map<string, (typeof players)[number]>();
    for (const p of players) {
      const parts = p.name.trim().split(/\s+/);
      const last = (parts[parts.length - 1] ?? "").toLowerCase();
      if (last) map.set(last, p);
    }
    return map;
  }, [players]);

  const liveRows: GolfLeaderboardRow[] = leaderboard?.rows ?? [];
  const status = tournament
    ? getTournamentStatus(new Date(tournament.startMs), new Date(tournament.endMs))
    : null;
  const isLiveNow = status?.label === "🟢 LIVE";
  const showLive = isLiveNow && liveRows.length > 0;
  const visibleLive = expanded ? liveRows : liveRows.slice(0, 15);
  const visibleOdds = expanded ? players : players.slice(0, 10);

  // Live tournament metadata (from Live Golf Data API).
  const liveRange = tournament ? formatTournamentRange(tournament.startIso, tournament.endIso) : "";


  // Odds-market tournament metadata (from Odds API). Always a major on the
  // current plan, so use the static MAJOR_INFO lookup for date + venue
  // instead of the misleading betting-market `commence_time`.
  const oddsName = game?.homeTeam ?? "";
  const oddsMajor = getMajorInfo(oddsName);
  const oddsSubtitle = oddsMajor
    ? `${oddsMajor.range} · ${oddsMajor.venue}`
    : game?.commenceTime
      ? formatGameTime(game.commenceTime)
      : "";

  // Treat as a single combined section when the live tournament IS the same
  // event as the odds market (both are a major). Otherwise render two
  // clearly-labelled sections so users don't confuse a PGA Tour event with a
  // futures market for an upcoming major.
  const sameEvent =
    !!tournament &&
    !!oddsName &&
    tournament.name.toLowerCase().replace(/\s+/g, "") ===
      oddsName.toLowerCase().replace(/\s+/g, "");

  const analyzeTournamentName = tournament?.name ?? "Golf Tournament";


  const buildPlayerOdds = () => {
    return players.slice(0, 30).map((p) => ({
      name: p.name,
      bestOdds: p.bestOdds,
      bestBook: p.bestBook,
      bookOdds: Object.fromEntries(p.lines.map((l) => [l.book, l.odds])),
    }));
  };

  const [analyzedTournamentName, setAnalyzedTournamentName] = useState<string>("");

  const handleAnalyze = async (mode: "leaderboard" | "odds") => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const isOddsMode = mode === "odds";
      const targetName = isOddsMode ? oddsName : analyzeTournamentName;
      const targetDates = isOddsMode
        ? (oddsMajor ? oddsMajor.range : "TBD")
        : (liveRange || (oddsMajor ? oddsMajor.range : "TBD"));
      const targetCourse = isOddsMode ? (oddsMajor?.venue ?? null) : (oddsMajor?.venue ?? null);
      const playerOdds = isOddsMode ? buildPlayerOdds() : [];
      console.log("[Golf Analyze] sending:", {
        type: "golf",
        tournamentName: targetName,
        players: playerOdds.length,
        leaderboard: liveRows?.length ?? 0,
        hasOddsGame: !!game,
        mode,
        dates: targetDates,
        course: targetCourse,
      });
      const { data, error } = await supabase.functions.invoke("analyze-market", {
        body: {
          type: "golf",
          tournamentName: targetName,
          dates: targetDates,
          course: targetCourse,
          purse: tournament?.purse ?? 0,
          leaderboard: liveRows,
          players: playerOdds,
          bankroll: settings.bankroll,
          kellyMultiplier: settings.kellyMultiplier,
          maxPositionPct: (settings.maxPosition ?? 0.05) * 100,
        },
      });
      if (error) throw error;
      const d = data as Record<string, unknown> | null;
      if (!d) throw new Error("Empty response");
      if (typeof d.error === "string") throw new Error(d.error);
      setAnalyzedTournamentName(targetName);
      setAnalysis(d as GolfAnalysisResult);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-500/5 to-card p-4 space-y-3 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase text-amber-300">⛳ Golf</div>
        <button
          onClick={() => fetchCurrent()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
          title="Refresh live golf data"
        >
          <RotateCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ===== Section 1: Live Leaderboard (Live Golf Data API) ===== */}
      {tournament && (
        <section className="space-y-2">
          <header className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  📊 {showLive ? "Live Leaderboard" : "Next Tournament"}
                </span>
                {showLive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-1.5 py-px text-[9px] font-bold uppercase text-success">
                    <span className="h-1 w-1 rounded-full bg-success animate-pulse" />
                    Live · R{leaderboard?.roundId || "?"}
                  </span>
                ) : status ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold uppercase",
                      status.color === "green" && "bg-success/20 text-success",
                      status.color === "blue" && "bg-info/20 text-info",
                      status.color === "gray" && "bg-muted text-muted-foreground",
                      status.pulse && "animate-pulse",
                    )}
                  >
                    {status.label}
                  </span>
                ) : null}
              </div>

              <div className="text-base font-extrabold text-foreground">{tournament.name}</div>
              {liveRange && (
                <div className="text-[10px] font-mono text-muted-foreground">{liveRange}</div>
              )}
            </div>
            <div className="text-[9px] font-mono uppercase text-muted-foreground text-right">
              Live Golf Data<br />Updates ~15 min
            </div>
          </header>
          {showLive ? (
            <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead className="bg-background/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-2 py-1">Pos</th>
                <th className="px-2 py-1">Player</th>
                <th className="px-2 py-1">Total</th>
                <th className="px-2 py-1">Today</th>
                    {sameEvent && <th className="px-2 py-1">Best Odds</th>}
                    {sameEvent && <th className="px-2 py-1">Book</th>}
              </tr>
            </thead>
            <tbody>
              {visibleLive.map((row) => {
                const last = row.lastName?.toLowerCase() ?? "";
                    const odds = sameEvent ? oddsByLastName.get(last) : null;
                const cut = row.status?.toLowerCase().includes("cut");
                return (
                  <tr key={row.playerId || `${row.firstName}-${row.lastName}`} className="border-t border-border/40">
                    <td className="px-2 py-1 text-muted-foreground">{row.position || "-"}</td>
                    <td className={cn("px-2 py-1 font-semibold whitespace-nowrap", cut ? "text-muted-foreground line-through" : "text-foreground")}>
                      {row.firstName} {row.lastName}
                      {row.isAmateur && <span className="ml-1 text-[9px] text-muted-foreground">(a)</span>}
                    </td>
                    <td className="px-2 py-1 text-foreground">{row.total || "-"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{row.currentRoundScore || "-"}</td>
                        {sameEvent && (
                          <td className="px-2 py-1 text-success font-bold whitespace-nowrap">
                            {odds ? formatOdds(odds.bestOdds) : <span className="text-muted-foreground">—</span>}
                          </td>
                        )}
                        {sameEvent && (
                          <td className="px-2 py-1 text-[10px] text-muted-foreground">
                            {odds?.bestBook ?? ""}
                          </td>
                        )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leaderboard?.cutLines?.[0] && (
            <div className="pt-2 text-[10px] font-mono text-muted-foreground">
              Cut line: {leaderboard.cutLines[0].cutScore} ({leaderboard.cutLines[0].cutCount} players)
            </div>
          )}
            </div>
          ) : (
            <div className="rounded-md border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground">
              Live leaderboard will appear once the tournament tees off.
              {!sameEvent && players.length > 0 && (
                <span> Betting odds for PGA Tour events aren't available on the current data plan — odds below are for the next major.</span>
              )}
            </div>
          )}
          {showLive && liveRows.length > 15 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-semibold text-info hover:underline"
            >
              {expanded ? "Show top 15" : `Show all ${liveRows.length} players`}
            </button>
          )}
        </section>
      )}

      {/* ===== Section 2: Betting Odds (Odds API) — only when distinct from live ===== */}
      {players.length > 0 && !sameEvent && (
        <section className="space-y-2 border-t border-border/60 pt-3">
          <header className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  💰 Outright Winner Odds
                </span>
              </div>
              <div className="text-base font-extrabold text-foreground">{oddsName}</div>
              {oddsSubtitle && (
                <div className="text-[10px] font-mono text-muted-foreground">{oddsSubtitle}</div>
              )}
            </div>
            <div className="text-[9px] font-mono uppercase text-muted-foreground text-right">
              The Odds API<br />Futures market
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
          <thead className="bg-background/40 text-muted-foreground">
            <tr className="text-left">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Player</th>
              {bookNames.map((b) => (
                <th key={b} className="px-2 py-1">{b}</th>
              ))}
              <th className="px-2 py-1">Best</th>
            </tr>
          </thead>
          <tbody>
            {visibleOdds.map((p, i) => (
              <tr key={p.name} className="border-t border-border/40">
                <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1 text-foreground font-semibold whitespace-nowrap">{p.name}</td>
                {bookNames.map((b) => {
                  const line = p.lines.find((l) => l.book === b);
                  return (
                    <td key={b} className="px-2 py-1">
                      {line ? formatOdds(line.odds) : "—"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-success font-bold whitespace-nowrap">
                  {formatOdds(p.bestOdds)} <span className="text-[9px] opacity-80">{p.bestBook}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
          {players.length > 10 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-semibold text-info hover:underline"
            >
              {expanded ? "Show top 10" : `Show all ${players.length} players`}
            </button>
          )}
        </section>
      )}

      {/* Fallback: no live tournament & no odds */}
      {!tournament && players.length === 0 && (
        <div className="rounded-md border border-border/60 bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
          No golf data available right now.
        </div>
      )}

      {/* Claude AI Analysis */}
      {liveRows.length > 0 && (
        analysis ? (
          <GolfAnalysisPanel
            result={analysis}
            tournamentName={analyzeTournamentName}
            onClear={() => setAnalysis(null)}
          />
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 transition disabled:opacity-60"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analyzing field…</span>
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  <span className="text-sm">
                    🤖 Analyze {analyzeTournamentName} · Find Value
                  </span>
                </>
              )}
            </button>
            {analysisError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-destructive">{analysisError}</p>
                  <button
                    onClick={handleAnalyze}
                    className="mt-1.5 rounded-md border border-destructive/40 bg-background px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      <GamblingDisclaimer variant="inline" />
    </div>
  );
}

function BookTable({
  books,
  bestHome,
  bestAway,
  vegasConsensus,
}: {
  books: FullBookmakerLine[];
  bestHome: { odds: number; book: string };
  bestAway: { odds: number; book: string };
  vegasConsensus: FullGame["vegasConsensus"];
}) {
  const bestTotal = books.reduce(
    (b, x) => (x.totalLine > b.line ? { line: x.totalLine, book: x.name } : b),
    { line: 0, book: "" },
  );
  const vegasBooks = books.filter((b) => b.category !== "prediction_market");
  const predBooks = books.filter((b) => b.category === "prediction_market");
  const hasDraw = books.some((b) => (b.drawMoneyline ?? 0) !== 0);

  // Best Over/Under across vegas books only (highest American odds wins).
  const bestOver = vegasBooks
    .filter((b) => b.totalLine && Number.isFinite(b.overOdds) && b.overOdds !== 0)
    .reduce(
      (a, b) => (b.overOdds > a.odds ? { odds: b.overOdds, book: b.name } : a),
      { odds: -99999, book: "" },
    );
  const bestUnder = vegasBooks
    .filter((b) => b.totalLine && Number.isFinite(b.underOdds) && b.underOdds !== 0)
    .reduce(
      (a, b) => (b.underOdds > a.odds ? { odds: b.underOdds, book: b.name } : a),
      { odds: -99999, book: "" },
    );

  const gapFor = (book: FullBookmakerLine): { value: number; side: string } | null => {
    if (!vegasConsensus) return null;
    const home = book.homeMoneyline - vegasConsensus.home;
    const away = book.awayMoneyline - vegasConsensus.away;
    const useHome = Math.abs(home) >= Math.abs(away);
    return { value: useHome ? home : away, side: useHome ? "H" : "A" };
  };

  const renderRow = (b: FullBookmakerLine) => {
    const isPred = b.category === "prediction_market";
    const gap = isPred ? gapFor(b) : null;
    return (
      <tr key={b.key} className={cn("border-t border-border/40", isPred && "bg-info/5")}>
        <td className="sticky left-0 z-10 bg-card px-2 py-1 text-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span>{b.name}</span>
            {b.key === "kalshi" && (
              <span className="rounded-sm border border-info/40 bg-info/10 px-1 py-px text-[8px] font-bold text-info">CFTC</span>
            )}
            {b.key === "polymarket" && (
              <span className="rounded-sm border border-warning/40 bg-warning/10 px-1 py-px text-[8px] font-bold text-warning">Offshore</span>
            )}
            {(b.key === "betonlineag" ||
              b.name.toLowerCase().includes("betonline")) && (
              <span className="rounded-sm border border-warning/40 bg-warning/10 px-1 py-px text-[8px] font-bold text-warning">Offshore</span>
            )}
          </div>
        </td>
        <td className={cn("px-2 py-1", b.name === bestAway.book && "text-success font-bold")}>{formatOdds(b.awayMoneyline)}</td>
        {hasDraw && (
          <td className="px-2 py-1">
            {b.drawMoneyline ? formatOdds(b.drawMoneyline) : "—"}
          </td>
        )}
        <td className={cn("px-2 py-1", b.name === bestHome.book && "text-success font-bold")}>{formatOdds(b.homeMoneyline)}</td>
        <td className="px-2 py-1">{isPred ? "—" : b.homeSpread ? formatSpread(b.homeSpread) : "—"}</td>
        <td className="px-2 py-1 whitespace-nowrap">
          {isPred || !b.totalLine ? (
            "—"
          ) : (
            <span>
              <span className="text-muted-foreground">o{b.totalLine}</span>{" "}
              <span
                className={cn(
                  b.name === bestOver.book && b.overOdds === bestOver.odds && "text-success font-bold",
                )}
              >
                {formatOdds(b.overOdds)}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span
                className={cn(
                  b.name === bestUnder.book && b.underOdds === bestUnder.odds && "text-success font-bold",
                )}
              >
                u{formatOdds(b.underOdds)}
              </span>
            </span>
          )}
        </td>
        <td className={cn(
          "px-2 py-1 font-bold",
          !gap ? "text-muted-foreground"
            : gap.value > 0 ? "text-success"
            : gap.value < 0 ? "text-destructive"
            : "text-muted-foreground",
        )}>
          {gap ? `${gap.value > 0 ? "+" : ""}${gap.value} (${gap.side})` : "—"}
        </td>
      </tr>
    );
  };

  return (
    <div className="border-t border-border/60 overflow-x-auto">
      <table className="w-full min-w-[480px] text-[10px] font-mono">
        <thead className="bg-background/40">
          <tr className="text-left text-muted-foreground">
            <th className="sticky left-0 z-10 bg-background/40 px-2 py-1">Book</th>
            <th className="px-2 py-1">Away ML</th>
            {hasDraw && <th className="px-2 py-1">Draw</th>}
            <th className="px-2 py-1">Home ML</th>
            <th className="px-2 py-1">Spread</th>
            <th className="px-2 py-1 whitespace-nowrap">Total (O/U)</th>
            <th className="px-2 py-1 whitespace-nowrap">vs Vegas</th>
          </tr>
        </thead>
        <tbody>
          {vegasBooks.map(renderRow)}
          {predBooks.length > 0 && (
            <tr className="border-t border-border/60 bg-background/40">
              <td colSpan={hasDraw ? 7 : 6} className="px-2 py-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground">
                ── Prediction Markets ──
              </td>
            </tr>
          )}
          {predBooks.map(renderRow)}
        </tbody>
      </table>
      <div className="border-t border-border/60 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
        Best: Away ML <span className="text-success">{bestAway.book} {formatOdds(bestAway.odds)}</span> · Home ML <span className="text-success">{bestHome.book} {formatOdds(bestHome.odds)}</span>
        {bestOver.book && (
          <>
            {" · "}Over <span className="text-success">{bestOver.book} {formatOdds(bestOver.odds)}</span>
          </>
        )}
        {bestUnder.book && (
          <>
            {" · "}Under <span className="text-success">{bestUnder.book} {formatOdds(bestUnder.odds)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function BestOddsTable({ games }: { games: FullGame[] }) {
  type SortKey = "time" | "spread" | "total" | "gap";
  const [sortBy, setSortBy] = useState<SortKey>("time");

  const sorted = useMemo(() => {
    const arr = [...games];
    if (sortBy === "time") arr.sort((a, b) => (a.commenceTime || "").localeCompare(b.commenceTime || ""));
    if (sortBy === "spread") arr.sort((a, b) => Math.abs(b.spread?.homeSpread ?? 0) - Math.abs(a.spread?.homeSpread ?? 0));
    if (sortBy === "total") arr.sort((a, b) => (b.total?.line ?? 0) - (a.total?.line ?? 0));
    if (sortBy === "gap") arr.sort((a, b) => Math.abs(b.mispricingGap ?? 0) - Math.abs(a.mispricingGap ?? 0));
    return arr;
  }, [games, sortBy]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border text-[11px]">
        <span className="text-muted-foreground">Sort:</span>
        {(["time", "spread", "total", "gap"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={cn(
              "rounded-full border px-2 py-0.5 font-semibold capitalize",
              sortBy === k ? "border-info bg-info text-white" : "border-border bg-background/40 text-muted-foreground",
            )}
          >
            {k === "gap" ? "ML gap" : k}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-background/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2">Game</th>
              <th className="px-3 py-2">Away ML</th>
              <th className="px-3 py-2">Home ML</th>
              <th className="px-3 py-2">Spread</th>
              <th className="px-3 py-2">O/U</th>
              <th className="px-3 py-2">Best Book</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => {
              const bestHome = getBestMoneyline(g.bookmakers, "home");
              const bestAway = getBestMoneyline(g.bookmakers, "away");
              return (
                <tr key={g.id} className="border-t border-border/40">
                  <td className="px-3 py-2 text-foreground">
                    <div className="font-semibold">{g.awayTeam} @ {g.homeTeam}</div>
                    <div className="text-[10px] text-muted-foreground">{formatGameTime(g.commenceTime)}</div>
                  </td>
                  <td className="px-3 py-2 text-success">{formatOdds(bestAway.odds)}</td>
                  <td className="px-3 py-2 text-success">{formatOdds(bestHome.odds)}</td>
                  <td className="px-3 py-2">{g.spread ? formatSpread(g.spread.homeSpread) : "—"}</td>
                  <td className="px-3 py-2">{g.total?.line ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{bestHome.book || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpreadsTab({ games }: { games: FullGame[] }) {
  const withSpreads = games.filter((g) => g.spread);
  if (withSpreads.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground text-center">No spread data available.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {withSpreads.map((g) => (
        <div key={g.id} className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-semibold text-foreground">{g.awayTeam} @ {g.homeTeam}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{formatGameTime(g.commenceTime)}</div>
          <div className="mt-2 text-sm font-mono">
            <div>{g.awayTeam}: {formatSpread(g.spread!.awaySpread)} ({formatOdds(g.spread!.awayOdds)})</div>
            <div>{g.homeTeam}: {formatSpread(g.spread!.homeSpread)} ({formatOdds(g.spread!.homeOdds)})</div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">Best book: <span className="text-foreground">{g.spread!.bestBook}</span></div>
        </div>
      ))}
    </div>
  );
}

function TotalsTab({ games }: { games: FullGame[] }) {
  const withTotals = games.filter((g) => g.total);
  if (withTotals.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground text-center">No totals data available.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {withTotals.map((g) => {
        const t = g.total!;
        const high = t.line > 50;
        const low = t.line < 35 && t.line > 0;
        return (
          <div key={g.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">{g.awayTeam} @ {g.homeTeam}</div>
              {high && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">HIGH SCORING</span>}
              {low && <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] font-bold text-info">LOW SCORING</span>}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">{formatGameTime(g.commenceTime)}</div>
            <div className="mt-2 text-sm font-mono">
              <div>Over {t.line} ({formatOdds(t.overOdds)})</div>
              <div>Under {t.line} ({formatOdds(t.underOdds)})</div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Best book: <span className="text-foreground">{t.bestBook}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function propCategory(propType: string): string {
  const k = propType.toLowerCase();
  if (/pass/.test(k)) return "PASSING";
  if (/rush/.test(k)) return "RUSHING";
  if (/recept|receiv/.test(k)) return "RECEIVING";
  if (/(^|_)(pitcher_|strikeout|pitch)/.test(k)) return "PITCHING";
  if (/(batter_|hit|home_run|rbi|total_bases|stolen)/.test(k)) return "HITTING";
  if (/(point|rebound|assist|three|block|steal)/.test(k)) return "BASKETBALL";
  if (/(goal|save|shot)/.test(k)) return "HOCKEY";
  return "OTHER";
}

function PropsTab({ games }: { games: FullGame[] }) {
  const eligible = games.filter((g) => hasPropsSupport(g.sport));
  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.id ?? null);
  const { fetchProps, getCached, isCached, isLoading } = useGameProps();
  const selected = eligible.find((g) => g.id === selectedId) ?? null;
  const cached = selected ? getCached(selected.id) : null;
  const loading = selected ? isLoading(selected.id) : false;

  if (eligible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No games support player props right now.
      </div>
    );
  }

  const handleSelect = async (g: FullGame) => {
    setSelectedId(g.id);
    if (!isCached(g.id)) {
      await fetchProps(g.sport, g.id);
    }
  };

  // Group props by category
  const grouped: Record<string, PlayerProp[]> = {};
  if (cached) {
    for (const p of cached.props) {
      const cat = propCategory(p.propType);
      (grouped[cat] ??= []).push(p);
    }
  }
  const categoryOrder = ["PASSING", "RUSHING", "RECEIVING", "HITTING", "PITCHING", "BASKETBALL", "HOCKEY", "OTHER"];
  const categories = categoryOrder.filter((c) => grouped[c]?.length);

  return (
    <div className="space-y-4">
      {/* Game selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {eligible.map((g) => {
          const cachedFlag = isCached(g.id);
          const isActive = g.id === selectedId;
          return (
            <button
              key={g.id}
              onClick={() => void handleSelect(g)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors text-left",
                isActive
                  ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <div>{g.awayTeam} @ {g.homeTeam}</div>
              <div className="text-[9px] font-mono opacity-80">
                {g.league}{cachedFlag ? " · cached" : ""}
              </div>
            </button>
          );
        })}
      </div>

      {!selected ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Select a game above to load player props.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading props for {selected.awayTeam} @ {selected.homeTeam}…
        </div>
      ) : !cached ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
          <button
            onClick={() => void fetchProps(selected.sport, selected.id)}
            className="rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90"
          >
            Load player props
          </button>
        </div>
      ) : cached.props.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No props available for this game yet.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-background/40 text-[11px] font-bold tracking-wide text-foreground">
                {cat}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Stat</th>
                      <th className="px-3 py-2">Line</th>
                      <th className="px-3 py-2">Over</th>
                      <th className="px-3 py-2">Under</th>
                      <th className="px-3 py-2">Best Book</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[cat].map((p, i) => {
                      const edge = findPropEdge(p);
                      return (
                        <tr key={`${p.playerName}-${p.propType}-${p.line}-${i}`} className="border-t border-border/40">
                          <td className="px-3 py-2 text-foreground font-semibold">{p.playerName}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatPropType(p.propType)}</td>
                          <td className="px-3 py-2 text-foreground">{p.line}</td>
                          <td className="px-3 py-2 text-success font-bold">{formatOdds(p.bestOverOdds)}</td>
                          <td className="px-3 py-2 text-success font-bold">{formatOdds(p.bestUnderOdds)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {edge ? `${edge.book} (${edge.side})` : p.bestOverBook || p.bestUnderBook || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}