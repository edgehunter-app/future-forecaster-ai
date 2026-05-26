import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Brain, Loader2, AlertCircle, TrendingUp } from "lucide-react";
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
import GameAnalysisPanel from "./GameAnalysisPanel";

interface Props {
  games: FullGame[];
  loading: boolean;
  mispricings?: SportsMispricing[];
}

type Tab = "games" | "best" | "spreads" | "totals" | "props";

const TABS: { key: Tab; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "best", label: "Best Odds" },
  { key: "spreads", label: "Spreads" },
  { key: "totals", label: "Totals" },
  { key: "props", label: "Props" },
];

function oddsClass(odds: number): string {
  if (!odds) return "text-muted-foreground";
  return odds > 0 ? "text-success" : "text-destructive";
}

export default function OddsBoard({ games, loading, mispricings = [] }: Props) {
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
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">No games available right now for this selection.</p>
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
          {games.map((g) => (
            <GameCard key={g.id} game={g} mispricings={mispricings} />
          ))}
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
  const bookmakers = game.bookmakers ?? [];
  console.log("[GameCard] bookmakers received:",
    bookmakers.length,
    bookmakers.map((b) => b.key ?? b.name));
  const booksWithOdds = bookmakers.filter(
    (b) => b.homeMoneyline !== 0 || b.awayMoneyline !== 0,
  );
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

  const handleAnalyze = () => {
    const kalshi = bookmakers.find((b) => b.key === "kalshi");
    const polymarket = bookmakers.find((b) => b.key === "polymarket");
    analyzeGame(game, polyGap, { kalshi, polymarket });
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
        <Market label="Total">
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

      {/* Compare books */}
      {bookmakers.length > 0 && (
        <div className="rounded-md border border-border/60">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <span>Compare {bookmakers.length} books</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <BookTable
              books={bookmakers}
              bestHome={bestHome}
              bestAway={bestAway}
              vegasConsensus={game.vegasConsensus}
            />
          )}
        </div>
      )}

      {/* Claude AI Analysis */}
      {result ? (
        <GameAnalysisPanel result={result} game={game} onClear={() => clearResult(game.id)} />
      ) : (
        <>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md bg-purple px-3 text-white font-semibold transition-colors hover:bg-purple/90 disabled:opacity-60",
              "h-[52px] sm:h-11",
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Analyzing…</span>
              </>
            ) : (
              <div className="flex items-center gap-2 text-left">
                <Brain className="h-4 w-4" />
                <div>
                  <div className="text-sm leading-tight">Analyze with Claude</div>
                  <div className="text-[10px] opacity-80 leading-tight">AI edge detection for this game</div>
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
          </div>
        </td>
        <td className={cn("px-2 py-1", b.name === bestAway.book && "text-success font-bold")}>{formatOdds(b.awayMoneyline)}</td>
        <td className={cn("px-2 py-1", b.name === bestHome.book && "text-success font-bold")}>{formatOdds(b.homeMoneyline)}</td>
        <td className="px-2 py-1">{isPred ? "—" : b.homeSpread ? formatSpread(b.homeSpread) : "—"}</td>
        <td className={cn("px-2 py-1", !isPred && b.name === bestTotal.book && "text-success font-bold")}>
          {isPred ? "—" : b.totalLine || "—"}
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
            <th className="px-2 py-1">Home ML</th>
            <th className="px-2 py-1">Spread</th>
            <th className="px-2 py-1">Total</th>
            <th className="px-2 py-1 whitespace-nowrap">vs Vegas</th>
          </tr>
        </thead>
        <tbody>
          {vegasBooks.map(renderRow)}
          {predBooks.length > 0 && (
            <tr className="border-t border-border/60 bg-background/40">
              <td colSpan={6} className="px-2 py-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground">
                ── Prediction Markets ──
              </td>
            </tr>
          )}
          {predBooks.map(renderRow)}
        </tbody>
      </table>
      <div className="border-t border-border/60 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
        Best: Away ML <span className="text-success">{bestAway.book} {formatOdds(bestAway.odds)}</span> · Home ML <span className="text-success">{bestHome.book} {formatOdds(bestHome.odds)}</span>
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
              <th className="px-3 py-2">Total</th>
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

function PropsTab({ games }: { games: FullGame[] }) {
  const { propsCache } = useGameProps();
  const [search, setSearch] = useState("");

  const cachedEntries = Object.entries(propsCache);
  const allProps: { game: FullGame; prop: PlayerProp }[] = [];
  for (const [gameId, gp] of cachedEntries) {
    const game = games.find((g) => g.id === gameId);
    if (!game) continue;
    for (const p of gp.props) allProps.push({ game, prop: p });
  }
  const filtered = search.trim()
    ? allProps.filter((x) => x.prop.playerName.toLowerCase().includes(search.toLowerCase()))
    : allProps;

  const lineShop = allProps
    .map((x) => ({ ...x, edge: findPropEdge(x.prop) }))
    .filter((x) => x.edge && x.edge.edge > 0.05);

  if (cachedEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Click "Show Player Props" on any game card to load props. Cached for 2 hours per game.
      </div>
    );
  }

  const players = new Set(allProps.map((x) => x.prop.playerName));
  const propTypes = new Set(allProps.map((x) => x.prop.propType));

  return (
    <div className="space-y-3">
      {lineShop.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning space-y-1">
          <div className="font-bold">Line shopping opportunities</div>
          {lineShop.slice(0, 5).map((x, i) => (
            <div key={i}>
              {x.prop.playerName} {formatPropType(x.prop.propType)} — best{" "}
              {x.edge!.side.toUpperCase()} {formatOdds(x.edge!.odds)} at {x.edge!.book} (+
              {(x.edge!.edge * 100).toFixed(1)}%)
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground font-mono">
          {players.size} players · {propTypes.size} prop types · {cachedEntries.length} games
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player name..."
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-info focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {Array.from(new Set(filtered.map((x) => x.game.id))).map((gid) => {
          const game = games.find((g) => g.id === gid);
          if (!game) return null;
          const list = filtered.filter((x) => x.game.id === gid);
          return (
            <div key={gid} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="text-sm font-bold text-foreground">
                {game.awayTeam} @ {game.homeTeam}
                <span className="ml-2 text-[11px] font-mono text-muted-foreground">
                  {game.league}
                </span>
              </div>
              <div className="space-y-1.5">
                {list.slice(0, 30).map((x, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5 text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-foreground">{x.prop.playerName}</span>
                      <span className="ml-2 text-muted-foreground">
                        {formatPropType(x.prop.propType)} {x.prop.line}
                      </span>
                    </div>
                    <div className="font-mono">
                      <span className="text-success mr-2">O {formatOdds(x.prop.bestOverOdds)}</span>
                      <span className="text-destructive">U {formatOdds(x.prop.bestUnderOdds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No props match your search.
          </div>
        )}
      </div>
    </div>
  );
}