import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, RotateCw, AlertTriangle, Zap, Loader2, Globe2, X, Bell, BellRing } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useSportsOdds } from "@/hooks/useSportsOdds";
import SportsMispricingCard from "@/components/sports/SportsMispricingCard";
import GamblingDisclaimer from "@/components/sports/GamblingDisclaimer";
import OddsBoard from "@/components/sports/OddsBoard";
import { GolfLeaderboardCard } from "@/components/sports/OddsBoard";
import { useGolfData } from "@/hooks/useGolfData";
import BestBetCard from "@/components/sports/BestBetCard";
import { useBestBet } from "@/hooks/useBestBet";
import { SPORTS } from "@/lib/oddsApi";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import UsagePanel from "@/components/sports/UsagePanel";

const GOLF_NOTIFY_KEY = "eh.golfNotify";

function GolfEmptyState({ onClearCacheReload, loading }: { onClearCacheReload: () => void; loading: boolean }) {
  const [notify, setNotify] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(GOLF_NOTIFY_KEY) === "1";
  });
  const toggle = () => {
    const next = !notify;
    setNotify(next);
    try {
      window.localStorage.setItem(GOLF_NOTIFY_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-5">
      <div className="text-5xl" aria-hidden>⛳</div>
      <div className="space-y-1">
        <h2 className="text-lg font-extrabold text-foreground">No active tournament this week</h2>
        <p className="text-xs text-muted-foreground">
          Major championship odds post here when available. Weekly PGA Tour
          events aren't covered on the current data plan.
        </p>
      </div>
      <div className="mx-auto max-w-sm rounded-lg border border-border bg-background/50 p-4 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Next major</p>
        <p className="mt-1 text-sm font-bold text-foreground">⛳ The Open Championship</p>
        <p className="text-xs text-muted-foreground">July 17–20, 2026 · Royal Portrush</p>
        <p className="mt-2 text-[11px] text-success">
          Odds are live now — tap Refresh to load the leaderboard.
        </p>
      </div>
      <button
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
          notify
            ? "bg-success/15 text-success hover:bg-success/20"
            : "bg-info text-white hover:bg-info/90",
        )}
      >
        {notify ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        {notify ? "You'll be notified" : "Notify me when odds go live"}
      </button>
      <button
        onClick={onClearCacheReload}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        Clear cache & reload
      </button>
    </div>
  );
}

export default function Sports() {
  usePageTitle("Sports Odds Board");
  const { isAdmin } = useIsAdmin();
  const markets = useAppStore((s) => s.markets);
  const triggerBestBetOnSports = useAppStore((s) => s.triggerBestBetOnSports);
  const setTriggerBestBetOnSports = useAppStore((s) => s.setTriggerBestBetOnSports);
  const pendingBestBetScan = useAppStore((s) => s.pendingBestBetScan);
  const setPendingBestBetScan = useAppStore((s) => s.setPendingBestBetScan);
  const navigate = useNavigate();
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
    clearGolfCache,
    loadedSports,
    nextScanAt,
    setCurrentSport,
  } = useSportsOdds(markets);

  const golf = useGolfData();
  const golfData = useMemo(
    () => ({
      tournament: golf.tournament,
      leaderboard: golf.leaderboard,
      isLive: golf.isLive,
      loading: golf.loading,
      error: golf.error,
      fetchedAt: golf.fetchedAt,
      nextRefreshAt: golf.nextRefreshAt,
      onRefresh: (force?: boolean) => void golf.fetchCurrent(force ?? true),
    }),
    [golf.tournament, golf.leaderboard, golf.isLive, golf.loading, golf.error,
     golf.fetchedAt, golf.nextRefreshAt, golf.fetchCurrent],
  );
  if (import.meta.env.DEV) {
    console.log("[Sports] passing leaderboard rows:",
      golf.leaderboard?.rows?.length ?? 0,
      "tournament:", golf.tournament?.name ?? "NONE");
  }

  const [activeSport, setActiveSport] = useState<string>("all");
  const [wcBannerDismissed, setWcBannerDismissed] = useState(false);

  const handleClearGolfAndReload = () => {
    clearGolfCache();
    setActiveSport("golf");
    setCurrentSport("golf");
    if (!selectedSports.includes("golf")) {
      setSelectedSports([...selectedSports, "golf"]);
    }
    void loadGamesForSport("golf", true);
  };

  // Detect whether the Sportsbook API is actually returning any World Cup
  // events right now. The competition exists upstream (FIFA_WC) but the
  // provider doesn't always have games listed.
  const worldCupAvailable = useMemo(() => {
    return (fullGames ?? []).some((g) => {
      const s = (g.sport ?? "").toLowerCase();
      const l = (g.league ?? "").toLowerCase();
      return s.includes("world") || s.includes("fifa")
        || l.includes("world") || l.includes("fifa");
    });
  }, [fullGames]);

  const {
    findBestBet,
    loading: bestBetLoading,
    scannedSoFar,
    scanProgress,
    result: bestBetResult,
    error: bestBetError,
    clear: clearBestBet,
  } = useBestBet();

  const handleBestBet = async () => {
    await findBestBet();
    setTimeout(() => {
      document
        .getElementById("best-bet-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  useEffect(() => {
    if (triggerBestBetOnSports) {
      setTriggerBestBetOnSports(false);
      void handleBestBet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerBestBetOnSports]);

  // If a Best Bet scan is pending and games are not loaded, trigger a refresh first.
  useEffect(() => {
    if (pendingBestBetScan && (fullGames?.length ?? 0) === 0 && !loading) {
      void scan("manual");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBestBetScan]);

  // Once games are loaded, run the pending Best Bet scan.
  useEffect(() => {
    if (
      pendingBestBetScan &&
      (fullGames?.length ?? 0) > 0 &&
      !bestBetLoading &&
      !loading
    ) {
      setPendingBestBetScan(false);
      void handleBestBet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBestBetScan, fullGames?.length, bestBetLoading, loading]);

  const filteredGames = useMemo(() => {
    const list = fullGames ?? [];
    if (!activeSport || activeSport === "all") return list;
    if (activeSport === "soccer_fifa_world_cup") {
      return list.filter((g) => {
        const s = (g.sport ?? "").toLowerCase();
        const l = (g.league ?? "").toLowerCase();
        return s.includes("world") || s.includes("fifa")
          || l.includes("world") || l.includes("fifa");
      });
    }
    if (activeSport === "golf") {
      return list.filter((g) => {
        const s = (g.sport ?? "").toLowerCase();
        const l = (g.league ?? "").toLowerCase();
        return s.startsWith("golf") || l.includes("golf");
      });
    }
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
    const mmaGames = (fullGames ?? []).filter((g) => g.sport === "mma_mixed_martial_arts");
    console.log("[mma] tonight's fights:",
      mmaGames
        .filter((g) => {
          const gameTime = new Date(g.commenceTime).getTime();
          const hoursUntil = (gameTime - Date.now()) / 3_600_000;
          return hoursUntil > -3 && hoursUntil < 12;
        })
        .map((g) => ({ fight: `${g.awayTeam} vs ${g.homeTeam}`, time: g.commenceTime })),
    );
  }

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: fullGames.length };
    for (const s of SPORTS) {
      if (s.key === "golf") {
        out[s.key] = fullGames.filter((g) => {
          const sp = (g.sport ?? "").toLowerCase();
          const lg = (g.league ?? "").toLowerCase();
          return sp.startsWith("golf") || lg.includes("golf");
        }).length;
      } else if (s.key === "soccer_fifa_world_cup") {
        out[s.key] = fullGames.filter((g) => {
          const sp = (g.sport ?? "").toLowerCase();
          const lg = (g.league ?? "").toLowerCase();
          return sp.includes("world") || sp.includes("fifa") || lg.includes("world") || lg.includes("fifa");
        }).length;
      } else {
        out[s.key] = fullGames.filter((g) => g.sport === s.key).length;
      }
    }
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
          <button
            onClick={handleBestBet}
            disabled={bestBetLoading || (fullGames?.length ?? 0) === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-md transition-opacity disabled:opacity-60",
              "bg-gradient-to-r from-purple to-purple/70 hover:opacity-90",
            )}
            style={{ minHeight: 44 }}
          >
            {bestBetLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="flex flex-col items-start leading-tight">
                  <span>
                    {scanProgress.stage === "sports" && "Scanning sports lines… (1/3)"}
                    {scanProgress.stage === "prediction_markets" && "Scanning prediction markets… (2/3)"}
                    {scanProgress.stage === "wallet_signals" && "Scanning wallet signals… (3/3)"}
                    {scanProgress.stage === "ranking" && "Finding best opportunity…"}
                    {(scanProgress.stage === "idle" || !scanProgress.stage) && "Analyzing…"}
                  </span>
                  <span className="text-[10px] font-normal opacity-80">
                    {scanProgress.total > 0
                      ? `${scanProgress.current} of ${scanProgress.total} analyzed`
                      : "AI multi-source scan"}
                  </span>
                </span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span className="flex flex-col items-start leading-tight">
                  <span>Best Bet Today</span>
                  <span className="text-[10px] font-normal opacity-80">AI scans all games</span>
                </span>
              </>
            )}
          </button>
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => void scan("manual")}
            disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50"
            >
              <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <span className="text-[10px] text-muted-foreground">
              {isAdmin ? "Manual refresh only" : ""}
            </span>
          </div>
        </div>
      </div>

      {bestBetLoading && scanProgress.total > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-purple transition-all duration-300"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-muted-foreground text-right">
            {scanProgress.current} of {scanProgress.total} analyzed
            {scanProgress.stage && scanProgress.stage !== "idle" && (
              <span className="ml-2 opacity-70">
                · {scanProgress.stage === "sports" && "sports"}
                {scanProgress.stage === "prediction_markets" && "prediction markets"}
                {scanProgress.stage === "wallet_signals" && "wallet signals"}
                {scanProgress.stage === "ranking" && "ranking"}
              </span>
            )}
          </div>
        </div>
      )}

      {bestBetError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {bestBetError}
        </div>
      )}

      {pendingBestBetScan && (
        <div className="rounded-lg border border-purple/40 bg-purple/10 px-4 py-3 text-sm text-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-purple" />
          {(fullGames?.length ?? 0) === 0
            ? "Loading games for Best Bet scan..."
            : "Running Best Bet analysis..."}
        </div>
      )}

      {bestBetResult && (
        <BestBetCard result={bestBetResult} onClear={clearBestBet} onRescan={handleBestBet} />
      )}

      {isAdmin && <UsagePanel />}

      {/* FIFA World Cup 2026 banner — only show when games are actually
          available in the live feed. */}
      {!wcBannerDismissed && worldCupAvailable && (
        <div className="relative overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 px-4 py-3 sm:px-5 sm:py-4">
          <button
            onClick={() => setWcBannerDismissed(true)}
            className="absolute right-2 top-2 rounded-md p-1 text-amber-200/80 hover:bg-amber-500/10 hover:text-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <Globe2 className="h-6 w-6 shrink-0 text-amber-300" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-amber-100">
                    🌍 FIFA World Cup 2026 — LIVE NOW
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80">
                  48 teams · Group Stage · Through June 27
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveSport("soccer_fifa_world_cup");
                if (!selectedSports.includes("soccer_fifa_world_cup")) {
                  setSelectedSports([...selectedSports, "soccer_fifa_world_cup"]);
                }
                setCurrentSport("soccer_fifa_world_cup");
                if (!loadedSports.has("soccer_fifa_world_cup")) {
                  void loadGamesForSport("soccer_fifa_world_cup");
                }
              }}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-400"
            >
              View World Cup Games →
            </button>
          </div>
        </div>
      )}

      {/* Sport selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {[{ key: "all", label: "All" }, ...SPORTS].map((s) => {
          const active = activeSport === s.key;
          const count = counts[s.key] ?? 0;
          const isLoaded = s.key === "golf"
            ? loadedSports.has("golf") && count > 0
            : s.key === "all" || loadedSports.has(s.key);
          const isWC = s.key === "soccer_fifa_world_cup";
          const isMMA = s.key === "mma_mixed_martial_arts";
          const mmaLiveTonight = isMMA && fullGames.some((g) => {
            if (g.sport !== "mma_mixed_martial_arts") return false;
            const t = new Date(g.commenceTime).getTime();
            if (!Number.isFinite(t)) return false;
            const diff = t - Date.now();
            return diff > -3 * 3600_000 && diff < 12 * 3600_000;
          });
          return (
            <button
              key={s.key}
              onClick={() => {
                setActiveSport(s.key);
                if (s.key !== "all" && !selectedSports.includes(s.key)) {
                  setSelectedSports([...selectedSports, s.key]);
                }
                if (s.key !== "all") {
                  setCurrentSport(s.key);
                }
                if (s.key !== "all" && !isLoaded) {
                  void loadGamesForSport(s.key);
                }
                if (s.key === "soccer_fifa_world_cup") {
                  // Force fresh fetch for WC so pre-7-day-filter cache is bypassed.
                  void loadGamesForSport(s.key, true);
                }
              }}
              disabled={loading && s.key !== activeSport}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                isWC
                  ? active
                    ? "border-amber-400 bg-amber-500 text-amber-950"
                    : "border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  : isMMA
                    ? active
                      ? "border-orange-400 bg-gradient-to-r from-red-500 to-orange-500 text-white"
                      : "border-orange-400/50 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
                    : active
                      ? "border-info bg-info text-white"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{isMMA ? "🥊 MMA" : s.label}</span>
              {count > 0 && <span className="opacity-70">{count}</span>}
              {isWC && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/20 px-1.5 py-px text-[8px] font-bold uppercase text-destructive">
                  <span className="h-1 w-1 rounded-full bg-destructive animate-pulse" />
                  Live
                </span>
              )}
              {mmaLiveTonight && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/25 px-1.5 py-px text-[8px] font-bold uppercase text-destructive-foreground">
                  <span className="h-1 w-1 rounded-full bg-destructive animate-pulse" />
                  Live
                </span>
              )}
              {isAdmin && s.key !== "all" && (
                <span className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-bold uppercase",
                  isLoaded
                    ? active ? "bg-white/20 text-white" : "bg-success/15 text-success"
                    : active ? "bg-white/20 text-white" : "bg-warning/15 text-warning",
                )}>
                  {s.key === "golf" && isLoaded ? "Live" : isLoaded ? "Cached" : "1 req"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSport === "golf" && (filteredGames.length === 0 || (loadedSports.has("golf") && counts["golf"] === 0)) && (
        <div className="flex justify-end">
          <button
            onClick={handleClearGolfAndReload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Clear cache & reload
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {isAdmin ? error : "Couldn't load latest odds. Please try again in a moment."}
        </div>
      )}

      {/* Main odds board */}
      {activeSport === "golf" ? (
        // Golf tab always renders the card — the card itself handles the
        // "Tap Refresh" empty state so the user can trigger the one manual
        // API call (quota is 250/month).
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GolfLeaderboardCard
            golf={golfData}
            game={filteredGames.find((g) => g.isOutright && g.players?.length)}
          />
        </div>
      ) : (
        <>
          {error && /quota|429|monthly|limit|exhaust/i.test(error) && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning space-y-1">
              <div className="font-bold">
                Sports lines unavailable — daily API limit reached.
              </div>
              <div className="text-warning/90 text-xs">
                Resets at midnight UTC. Golf leaderboard and analysis are
                still available on the Golf tab.
              </div>
            </div>
          )}
          <OddsBoard
            games={filteredGames}
            loading={loading}
            mispricings={mispricings}
            onRefresh={() => void scan("manual")}
            golfData={golfData}
          />
        </>
      )}

      {/* Mispricings section — hidden on Golf tab (golf has no prediction-market gaps) */}
      {activeSport !== "golf" && (
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
      )}

      <GamblingDisclaimer variant="full" className="-mx-4 sm:-mx-6 lg:-mx-8 mt-8" />
    </div>
  );
}
