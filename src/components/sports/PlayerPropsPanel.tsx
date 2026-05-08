import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatOdds,
  formatPropType,
  findPropEdge,
  hasPropsSupport,
  type GameProps,
  type PlayerProp,
  type FullGame,
} from "@/lib/oddsApi";
import { useGameProps } from "@/hooks/useGameProps";
import GamblingDisclaimer from "./GamblingDisclaimer";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Props {
  game: FullGame;
  sportKey: string;
}

export default function PlayerPropsPanel({ game, sportKey }: Props) {
  const { isAdmin } = useIsAdmin();
  const { fetchProps, isLoading, getCached, isCached } = useGameProps();
  const [props, setProps] = useState<GameProps | null>(getCached(game.id));
  const [activeType, setActiveType] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(isCached(game.id));

  useEffect(() => {
    const cached = getCached(game.id);
    if (cached) {
      setProps(cached);
      setHasFetched(true);
    }
  }, [game.id, getCached]);

  const load = async () => {
    const result = await fetchProps(sportKey, game.id);
    if (result) {
      setProps(result);
      setHasFetched(true);
      if (result.propTypes.length > 0) setActiveType(result.propTypes[0]);
    } else {
      setHasFetched(true);
    }
  };

  if (!hasPropsSupport(sportKey)) {
    return (
      <div className="border-t border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
        Player props are not available for this sport.
      </div>
    );
  }

  if (!hasFetched) {
    return (
      <div className="border-t border-border px-3 py-4 text-center space-y-2">
        <button
          onClick={load}
          disabled={isLoading(game.id)}
          className="inline-flex items-center gap-2 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50"
        >
          {isLoading(game.id) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isLoading(game.id) ? "Loading props..." : "Load Player Props"}
        </button>
      </div>
    );
  }

  if (!props || props.props.length === 0) {
    return (
      <div className="border-t border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
        No player props available for this game yet. Props typically appear closer to game time.
      </div>
    );
  }

  const filtered = activeType ? props.props.filter((p) => p.propType === activeType) : props.props;
  const byPlayer: Record<string, PlayerProp[]> = {};
  for (const p of filtered) {
    if (!byPlayer[p.playerName]) byPlayer[p.playerName] = [];
    byPlayer[p.playerName].push(p);
  }

  const refreshIn = Math.max(0, Math.round((props.fetchedAt + 7200000 - Date.now()) / 60000));

  return (
    <div className="border-t border-border px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-foreground">
          Player Props ({props.props.length})
        </span>
        {isAdmin && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Cached · refreshes in {refreshIn}m
          </span>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <PropTab active={!activeType} onClick={() => setActiveType(null)}>All</PropTab>
        {props.propTypes.map((t) => (
          <PropTab key={t} active={activeType === t} onClick={() => setActiveType(t)}>
            {formatPropType(t)}
          </PropTab>
        ))}
      </div>

      <div className="space-y-2">
        {Object.entries(byPlayer).map(([player, list]) => (
          <PlayerPropRow key={player} player={player} props={list} />
        ))}
      </div>

      <GamblingDisclaimer variant="inline" />
    </div>
  );
}

function PropTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-info bg-info text-white"
          : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PlayerPropRow({ player, props }: { player: string; props: PlayerProp[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
      <div className="text-[12px] font-bold text-foreground mb-1.5">{player}</div>
      {props.map((prop) => {
        const edge = findPropEdge(prop);
        const key = `${prop.propType}_${prop.line}`;
        const isExpanded = expanded === key;
        return (
          <div key={key} className="mt-2 border-t border-border/40 pt-2 first:mt-0 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {prop.description}
              </span>
              <span className="text-[12px] font-bold font-mono text-foreground">{prop.line}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OverUnderBox label={`Over ${prop.line}`} odds={prop.bestOverOdds} book={prop.bestOverBook} kind="over" />
              <OverUnderBox label={`Under ${prop.line}`} odds={prop.bestUnderOdds} book={prop.bestUnderBook} kind="under" />
            </div>
            {edge && (
              <div className="mt-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">
                Best line: {edge.side.toUpperCase()} {formatOdds(edge.odds)} at {edge.book} (+{(edge.edge * 100).toFixed(1)}% vs worst)
              </div>
            )}
            {prop.bookmakers.length > 1 && (
              <button
                onClick={() => setExpanded(isExpanded ? null : key)}
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {isExpanded ? "Hide books" : `Compare ${prop.bookmakers.length} books`}
              </button>
            )}
            {isExpanded && (
              <div className="mt-2 overflow-x-auto rounded-md border border-border/40">
                <table className="w-full text-[10px] font-mono">
                  <thead className="bg-background/60">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-1">Book</th>
                      <th className="px-2 py-1">Over</th>
                      <th className="px-2 py-1">Under</th>
                      <th className="px-2 py-1">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prop.bookmakers.map((b, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1 text-foreground">{b.name}</td>
                        <td className={cn("px-2 py-1", b.overOdds === prop.bestOverOdds && "text-success font-bold")}>
                          {formatOdds(b.overOdds)}
                        </td>
                        <td className={cn("px-2 py-1", b.underOdds === prop.bestUnderOdds && "text-success font-bold")}>
                          {formatOdds(b.underOdds)}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{b.line}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverUnderBox({
  label,
  odds,
  book,
  kind,
}: {
  label: string;
  odds: number;
  book: string;
  kind: "over" | "under";
}) {
  const colorCls = kind === "over"
    ? "border-success/30 bg-success/10 text-success"
    : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <div className={cn("rounded-md border px-2 py-1.5 text-center", colorCls)}>
      <div className="text-[9px] uppercase tracking-wide opacity-90">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold font-mono">{formatOdds(odds)}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{book}</div>
    </div>
  );
}
