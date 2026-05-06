import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatOdds,
  formatSpread,
  formatGameTime,
  getBestMoneyline,
  type FullGame,
  type FullBookmakerLine,
} from "@/lib/oddsApi";
import GamblingDisclaimer from "./GamblingDisclaimer";

interface Props {
  games: FullGame[];
  loading: boolean;
}

type Tab = "games" | "best" | "spreads" | "totals";

const TABS: { key: Tab; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "best", label: "Best Odds" },
  { key: "spreads", label: "Spreads" },
  { key: "totals", label: "Totals" },
];

function oddsClass(odds: number): string {
  if (!odds) return "text-muted-foreground";
  return odds > 0 ? "text-success" : "text-destructive";
}

export default function OddsBoard({ games, loading }: Props) {
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
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}

      {tab === "best" && <BestOddsTable games={games} />}
      {tab === "spreads" && <SpreadsTab games={games} />}
      {tab === "totals" && <TotalsTab games={games} />}
    </div>
  );
}

function GameCard({ game }: { game: FullGame }) {
  const [expanded, setExpanded] = useState(false);
  const bestHome = getBestMoneyline(game.bookmakers, "home");
  const bestAway = getBestMoneyline(game.bookmakers, "away");

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

      {/* Matchup row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center">
          <div className="text-sm font-bold text-foreground line-clamp-1">{game.awayTeam}</div>
          <div className={cn("text-xl font-extrabold mt-1", oddsClass(game.moneyline.away))}>
            {formatOdds(game.moneyline.away)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {(game.moneyline.awayImplied * 100).toFixed(0)}%
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
          <div className={cn("text-xl font-extrabold mt-1", oddsClass(game.moneyline.home))}>
            {formatOdds(game.moneyline.home)}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {(game.moneyline.homeImplied * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Markets row */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Market label="Moneyline">
          <div className={oddsClass(game.moneyline.away)}>A {formatOdds(game.moneyline.away)}</div>
          <div className={oddsClass(game.moneyline.home)}>H {formatOdds(game.moneyline.home)}</div>
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
      {game.bookmakers.length > 0 && (
        <div className="rounded-md border border-border/60">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <span>Compare {game.bookmakers.length} books</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && <BookTable books={game.bookmakers} bestHome={bestHome} bestAway={bestAway} />}
        </div>
      )}

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
}: {
  books: FullBookmakerLine[];
  bestHome: { odds: number; book: string };
  bestAway: { odds: number; book: string };
}) {
  const bestTotal = books.reduce(
    (b, x) => (x.totalLine > b.line ? { line: x.totalLine, book: x.name } : b),
    { line: 0, book: "" },
  );
  return (
    <div className="border-t border-border/60 overflow-x-auto">
      <table className="w-full text-[10px] font-mono">
        <thead className="bg-background/40">
          <tr className="text-left text-muted-foreground">
            <th className="px-2 py-1">Book</th>
            <th className="px-2 py-1">Away ML</th>
            <th className="px-2 py-1">Home ML</th>
            <th className="px-2 py-1">Spread</th>
            <th className="px-2 py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.key} className="border-t border-border/40">
              <td className="px-2 py-1 text-foreground">{b.name}</td>
              <td className={cn("px-2 py-1", b.name === bestAway.book && "text-success font-bold")}>{formatOdds(b.awayMoneyline)}</td>
              <td className={cn("px-2 py-1", b.name === bestHome.book && "text-success font-bold")}>{formatOdds(b.homeMoneyline)}</td>
              <td className="px-2 py-1">{b.homeSpread ? formatSpread(b.homeSpread) : "—"}</td>
              <td className={cn("px-2 py-1", b.name === bestTotal.book && "text-success font-bold")}>{b.totalLine || "—"}</td>
            </tr>
          ))}
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