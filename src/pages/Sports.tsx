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
import { useIsAdmin } from "@/hooks/useIsAdmin";
import UsagePanel from "@/components/sports/UsagePanel";

export default function Sports() {
  usePageTitle("Sports Odds Board");
  const { isAdmin } = useIsAdmin();
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
    hasApiKey,
    scan,
    loadGamesForSport,
    loadedSports,
    activeKey,
    usageSummary,
    nextScanAt,
    scanInterval,
  } = useSportsOdds(markets);

  const [activeSport, setActiveSport] = useState<string>("all");

  const filteredGames = useMemo(() => {
    const list = fullGames ?? [];
    if (!activeSport || activeSport === "all") return list;
    const sportLabel = SPORTS.find((s) => s.key === activeSport)?.label.toLowerCase() ?? "";
    return list.filter(
      (g) =>
        g.sport === activeSport ||
        (sportLabel && g.league?.toLowerCase().includes(sportLabel)),
    );
  }, [fullGames, activeSport]);

  if (typeof window !== "undefined") {
    console.log("Full games:", fullGames);
    console.log("Full games length:", fullGames?.length);
    console.log("Selected sport:", activeSport);
    console.log("Filtered games:", filteredGames);
    console.log("Unique sport keys:", [...new Set((fullGames ?? []).map((g) => g.sport))]);
  }

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
          <span className="text-xs font-mono text-muted-foreground">
            {(() => {
              if (!lastScanned) return loading ? "Loading..." : "—";
              const minutesAgo = Math.floor((Date.now() - lastScanned.getTime()) / 60000);
              const refreshing = loading ? " — refreshing..." : "";
              if (minutesAgo === 0) return `Updated just now${refreshing}`;
              return `Updated ${minutesAgo}m ago${refreshing}`;
            })()}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => void scan("manual")}
              disabled={loading || !activeKey}
              className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50"
            >
              <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <span className="text-[10px] text-muted-foreground">
              {isAdmin
                ? !activeKey
                  ? `Auto-scan paused — resets ${usageSummary.resetDate}`
                  : nextScanAt
                    ? `Next auto-scan: ${nextScanAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : scanInterval === Infinity
                      ? "Auto-scan paused"
                      : "Next auto-scan: pending"
                : ""}
            </span>
          </div>
        </div>
      </div>

      {isAdmin && !activeKey && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm flex items-start gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>All Odds API keys exhausted. Auto-scan paused until reset on {usageSummary.resetDate}.</span>
        </div>
      )}

      {isAdmin && usageSummary && (
        <UsagePanel summary={usageSummary} />
      )}

      {/* Sport selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {[{ key: "all", label: "All" }, ...SPORTS].map((s) => {
          const active = activeSport === s.key;
          const count = counts[s.key] ?? 0;
          const isLoaded = s.key === "all" || loadedSports.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => {
                setActiveSport(s.key);
                if (s.key !== "all" && !selectedSports.includes(s.key)) {
                  setSelectedSports([...selectedSports, s.key]);
                }
                if (s.key !== "all" && !loadedSports.has(s.key) && activeKey) {
                  void loadGamesForSport(s.key);
                }
              }}
              disabled={s.key !== "all" && !isLoaded && !activeKey}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                active
                  ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{s.label}</span>
              {count > 0 && <span className="opacity-70">{count}</span>}
              {isAdmin && s.key !== "all" && (
                <span className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-bold uppercase",
                  isLoaded
                    ? active ? "bg-white/20 text-white" : "bg-success/15 text-success"
                    : active ? "bg-white/20 text-white" : "bg-warning/15 text-warning",
                )}>
                  {isLoaded ? "Cached" : "1 req"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {isAdmin ? error : "Couldn't load latest odds. Please try again in a moment."}
        </div>
      )}

      {/* Main odds board */}
      <OddsBoard games={filteredGames} loading={loading} mispricings={mispricings} />

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
