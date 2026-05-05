import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, RotateCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useSportsOdds } from "@/hooks/useSportsOdds";
import SportsMispricingCard from "@/components/sports/SportsMispricingCard";
import GamblingDisclaimer from "@/components/sports/GamblingDisclaimer";
import { SPORTS } from "@/lib/oddsApi";
import { getConfidenceTier } from "@/lib/confidenceColor";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

const TIERS = [
  { key: "strong", label: "Strong 65%+", color: "#10b981" },
  { key: "moderate", label: "Moderate 50-64%", color: "#f59e0b" },
  { key: "weak", label: "Weak <50%", color: "#ef4444" },
] as const;

export default function Sports() {
  usePageTitle("Sports");
  const markets = useAppStore((s) => s.markets);
  const { mispricings, loading, lastScanned, fromCache, error, remainingRequests, hasApiKey, scan } =
    useSportsOdds(markets);

  const [activeSport, setActiveSport] = useState<string>("all");
  const [activeTiers, setActiveTiers] = useState<Set<string>>(new Set(["strong", "moderate", "weak"]));
  const [howOpen, setHowOpen] = useState(false);

  const filtered = useMemo(() => {
    return mispricings.filter((m) => {
      if (activeSport !== "all" && m.game.sport !== activeSport) return false;
      const tier = getConfidenceTier(m.confidence);
      return activeTiers.has(tier);
    });
  }, [mispricings, activeSport, activeTiers]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: mispricings.length };
    for (const s of SPORTS) out[s.key] = mispricings.filter((m) => m.game.sport === s.key).length;
    return out;
  }, [mispricings]);

  const tierCounts = useMemo(() => ({
    strong: mispricings.filter((m) => getConfidenceTier(m.confidence) === "strong").length,
    moderate: mispricings.filter((m) => getConfidenceTier(m.confidence) === "moderate").length,
    weak: mispricings.filter((m) => getConfidenceTier(m.confidence) === "weak").length,
  }), [mispricings]);

  const avgGap = mispricings.length > 0
    ? (mispricings.reduce((s, m) => s + m.spread, 0) / mispricings.length) * 100
    : 0;

  if (!hasApiKey) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 max-w-2xl mx-auto text-center space-y-5">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Sports Edge Finder</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare Vegas sportsbook odds against Polymarket to find mispricings automatically.
            </p>
          </div>
          <ol className="text-left space-y-3 text-sm">
            <li className="rounded-md border border-border bg-background/40 p-3">
              <span className="font-semibold text-foreground">1. Get a free API key</span>
              <div className="mt-1">
                <a href="https://the-odds-api.com" target="_blank" rel="noreferrer"
                  className="text-info underline">the-odds-api.com</a>
                <span className="ml-2 text-xs text-muted-foreground">Free tier: 500 requests/month</span>
              </div>
            </li>
            <li className="rounded-md border border-border bg-background/40 p-3">
              <span className="font-semibold text-foreground">2. Add it in </span>
              <Link to="/settings" className="text-info underline">Settings → Sports and Odds</Link>
            </li>
            <li className="rounded-md border border-border bg-background/40 p-3">
              <span className="font-semibold text-foreground">3. Come back — we scan automatically</span>
            </li>
          </ol>
          <Link to="/settings"
            className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90">
            Go to Settings
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
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Sports Edge Finder</h1>
          <p className="text-sm text-muted-foreground">Vegas odds vs Polymarket</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {remainingRequests !== null && (
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              remainingRequests <= 0 ? "border-destructive/40 bg-destructive/15 text-destructive" :
              remainingRequests < 20 ? "border-destructive/40 bg-destructive/15 text-destructive" :
              remainingRequests < 100 ? "border-warning/40 bg-warning/15 text-warning" :
              "border-border bg-card text-muted-foreground",
            )}>
              {remainingRequests <= 0 ? "Limit reached" : `${remainingRequests} requests left`}
            </span>
          )}
          <span className="text-xs font-mono text-muted-foreground">
            {lastScanned
              ? `${fromCache ? "From cache — " : ""}${lastScanned.toLocaleTimeString()}`
              : "—"}
          </span>
          <button onClick={() => void scan()} disabled={loading || (remainingRequests !== null && remainingRequests <= 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50">
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {loading ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      {remainingRequests !== null && remainingRequests > 0 && remainingRequests < 100 && (
        <div className={cn(
          "rounded-lg border px-4 py-2 text-sm flex items-start gap-2",
          remainingRequests < 20 ? "border-destructive/40 bg-destructive/10 text-destructive"
                                 : "border-warning/40 bg-warning/10 text-warning",
        )}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {remainingRequests < 20
              ? "Almost out of API requests. New scans paused to preserve quota. Resets on the 1st."
              : `${remainingRequests} API requests remaining this month. Consider upgrading at the-odds-api.com.`}
          </span>
        </div>
      )}

      {remainingRequests === 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Monthly API limit reached. Showing cached data. Resets on the 1st of next month.</span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button onClick={() => setHowOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30">
          <span className="inline-flex items-center gap-2">
            <Trophy className="h-4 w-4 text-info" />
            How it works
          </span>
          {howOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {howOpen && (
          <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground leading-relaxed">
            Vegas books represent sharp professional money. When Polymarket prices the same event differently,
            one side is likely mispriced. EdgeHunter finds these gaps and tells you which side has better value.
            This is an informational tool only.
          </div>
        )}
      </div>

      {/* Sport tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {[{ key: "all", label: "All" } as { key: string; label: string }, ...SPORTS].map((s) => {
          const active = activeSport === s.key;
          const count = counts[s.key] ?? 0;
          return (
            <button key={s.key} onClick={() => setActiveSport(s.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active ? "border-info bg-info text-white"
                       : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}>
              {s.label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tier filter */}
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => {
          const active = activeTiers.has(t.key);
          return (
            <button key={t.key}
              onClick={() => {
                const next = new Set(activeTiers);
                if (next.has(t.key)) next.delete(t.key); else next.add(t.key);
                setActiveTiers(next);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active ? "text-foreground" : "text-muted-foreground opacity-60",
              )}
              style={{ borderColor: active ? t.color : "hsl(var(--border))",
                       backgroundColor: active ? `${t.color}20` : "transparent" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
        <Pill>{filtered.length} opportunities</Pill>
        <Pill>Avg gap {avgGap.toFixed(1)}%</Pill>
        <Pill color="#10b981">{tierCounts.strong} strong</Pill>
        <Pill color="#f59e0b">{tierCounts.moderate} moderate</Pill>
        <Pill color="#ef4444">{tierCounts.weak} weak</Pill>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && filtered.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Markets are aligned right now</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            No gaps above {((useAppStore.getState().settings.sportsGapThreshold ?? 0.05) * 100).toFixed(0)}% detected
            between Vegas and Polymarket on current sports markets.
          </p>
          {lastScanned && (
            <p className="mt-2 text-xs font-mono text-muted-foreground">Last scanned: {lastScanned.toLocaleTimeString()}</p>
          )}
          <button onClick={() => void scan()} disabled={loading}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90">
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Scan Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => <SportsMispricingCard key={m.id} mispricing={m} />)}
        </div>
      )}

      <GamblingDisclaimer variant="full" className="-mx-4 sm:-mx-6 lg:-mx-8 mt-8" />
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground"
      style={color ? { color, borderColor: `${color}40`, backgroundColor: `${color}15` } : undefined}>
      {children}
    </span>
  );
}
