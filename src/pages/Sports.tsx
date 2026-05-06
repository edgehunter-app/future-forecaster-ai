import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, RotateCw, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useSportsOdds } from "@/hooks/useSportsOdds";
import SportsMispricingCard from "@/components/sports/SportsMispricingCard";
import GamblingDisclaimer from "@/components/sports/GamblingDisclaimer";
import OddsBoard from "@/components/sports/OddsBoard";
import { SPORTS } from "@/lib/oddsApi";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Sports() {
  usePageTitle("Sports Odds Board");
  const markets = useAppStore((s) => s.markets);
  const {
    mispricings,
    fullGames,
    selectedSports,
    setSelectedSports,
    loading,
    lastScanned,
    fromCache,
    error,
    remainingRequests,
    hasApiKey,
    scan,
  } = useSportsOdds(markets);

  const [activeSport, setActiveSport] = useState<string>("all");

  const filteredGames = useMemo(() => {
    if (activeSport === "all") return fullGames;
    return fullGames.filter((g) => g.sport === activeSport);
  }, [fullGames, activeSport]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: fullGames.length };
    for (const s of SPORTS) out[s.key] = fullGames.filter((g) => g.sport === s.key).length;
    return out;
  }, [fullGames]);

  if (!hasApiKey) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 max-w-2xl mx-auto text-center space-y-5">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-extrabold text-foreground">Sports Odds Board</h1>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90"
          >
            Configure in Settings
          </Link>
        </div>
        <GamblingDisclaimer variant="full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">
            Sports Odds Board
          </h1>
          <p className="text-sm text-muted-foreground">
            Live lines from DraftKings, FanDuel, BetMGM and more
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {remainingRequests !== null && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                remainingRequests <= 0
                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                  : remainingRequests < 100
                  ? "border-warning/40 bg-warning/15 text-warning"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {remainingRequests <= 0 ? "Limit reached" : `${remainingRequests} requests left`}
            </span>
          )}
          <span className="text-xs font-mono text-muted-foreground">
            {lastScanned
              ? `${fromCache ? "cache · " : ""}${lastScanned.toLocaleTimeString()}`
              : "—"}
          </span>
          <button
            onClick={() => void scan()}
            disabled={loading || (remainingRequests !== null && remainingRequests <= 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50"
          >
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {remainingRequests !== null && remainingRequests > 0 && remainingRequests < 100 && (
        <div
          className={cn(
            "rounded-lg border px-4 py-2 text-sm flex items-start gap-2",
            remainingRequests < 20
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{remainingRequests} API requests remaining this month.</span>
        </div>
      )}

      {/* Sport selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {[{ key: "all", label: "All" }, ...SPORTS].map((s) => {
          const active = activeSport === s.key;
          const count = counts[s.key] ?? 0;
          return (
            <button
              key={s.key}
              onClick={() => {
                setActiveSport(s.key);
                if (s.key !== "all" && !selectedSports.includes(s.key)) {
                  setSelectedSports([...selectedSports, s.key]);
                }
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Main odds board */}
      <OddsBoard games={filteredGames} loading={loading} />

      {/* Mispricings section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Prediction Market Gaps
        </h2>
        {mispricings.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No prediction market gaps detected. Polymarket and Kalshi are aligned with Vegas on
            current games.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mispricings.map((m) => (
              <SportsMispricingCard key={m.id} mispricing={m} />
            ))}
          </div>
        )}
      </div>

      <GamblingDisclaimer variant="full" className="-mx-4 sm:-mx-6 lg:-mx-8 mt-8" />
    </div>
  );
}
