import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Brain, ChevronDown, ChevronUp, GitCompare, Info, Loader2, RotateCw, SearchX, ShieldAlert, X } from "lucide-react";
import { useCrossMarket } from "@/hooks/useCrossMarket";
import { useAppStore } from "@/store/useAppStore";
import { analyzeMarketWithClaude } from "@/lib/claude";
import EmptyState from "@/components/ui/EmptyState";
import ConfidenceBar from "@/components/ui/ConfidenceBar";
import { cn, fmtUSD } from "@/lib/utils";
import type { CrossMarketOpp, ClaudeAnalysis } from "@/types";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSportsOdds } from "@/hooks/useSportsOdds";
import SportsMispricingCard from "@/components/sports/SportsMispricingCard";
import GamblingDisclaimer from "@/components/sports/GamblingDisclaimer";

export default function CrossMarket() {
  usePageTitle("Cross-Market");
  const { opportunities, loading, lastScanned, kalshiAvailable, scan } = useCrossMarket();
  const setCrossMarketOpps = useAppStore((s) => s.setCrossMarketOpps);
  const markets = useAppStore((s) => s.markets);
  const { mispricings: sportsMispricings, hasApiKey: hasOddsKey } = useSportsOdds(markets);
  const [howOpen, setHowOpen] = useState(false);
  const [view, setView] = useState<"all" | "prediction" | "sports">("all");

  useEffect(() => { setCrossMarketOpps(opportunities); }, [opportunities, setCrossMarketOpps]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Cross-Market Radar</h1>
          <p className="text-sm text-muted-foreground">
            {opportunities.length + sportsMispricings.length} opportunities — Polymarket vs Kalshi & Vegas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            Last scanned: {lastScanned ? lastScanned.toLocaleTimeString() : "—"}
          </span>
          <button onClick={() => void scan()} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 transition-colors disabled:opacity-50">
            <RotateCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {loading ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card p-1">
        {([
          { k: "all", label: "All" },
          { k: "prediction", label: "Prediction Markets" },
          { k: "sports", label: "Sports Books" },
        ] as const).map((t) => (
          <button key={t.k} onClick={() => setView(t.k)}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-semibold transition-colors",
              view === t.k ? "bg-info text-white" : "text-muted-foreground hover:text-foreground",
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Kalshi public API info */}
      <div className="rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-info flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Kalshi data is fetched from their public API. No account or API key required. Prices update every 15 minutes.</span>
      </div>

      {!kalshiAvailable && !loading && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Kalshi market data is temporarily unavailable. Cross-market comparison is paused. Polymarket data is unaffected.</span>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button onClick={() => setHowOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors">
          <span className="inline-flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-info" />
            How cross-market detection works
          </span>
          {howOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {howOpen && (
          <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground leading-relaxed">
            When the same event is priced differently on Polymarket and Kalshi, an arbitrage or edge
            opportunity exists. We surface these automatically by matching markets via question
            similarity and flagging any spread above 5%.
          </div>
        )}
      </div>

      {opportunities.length === 0 && !loading && (
        <EmptyState
          icon={SearchX}
          title="No spreads above 5% detected right now"
          subtitle="Both platforms are pricing these events similarly. Check back in 15 minutes."
          action={{ label: "Scan again", onClick: () => void scan() }}
        />
      )}

      {(view === "all" || view === "prediction") && (
        <div className="space-y-4">
          {view === "all" && opportunities.length > 0 && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prediction Markets</h2>
          )}
          {opportunities.map((o) => <OpportunityCard key={o.question} opp={o} />)}
        </div>
      )}

      {(view === "all" || view === "sports") && hasOddsKey && (
        <div className="space-y-4">
          {view === "all" && sportsMispricings.length > 0 && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sports Books</h2>
          )}
          {sportsMispricings.length === 0 ? (
            view === "sports" ? (
              <EmptyState icon={SearchX} title="No sports gaps detected right now"
                subtitle="Vegas and Polymarket are aligned on current sports markets." />
            ) : null
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sportsMispricings.map((m) => <SportsMispricingCard key={m.id} mispricing={m} />)}
            </div>
          )}
          <GamblingDisclaimer variant="compact" />
        </div>
      )}

      {view === "sports" && !hasOddsKey && (
        <EmptyState icon={SearchX} title="Sports odds not configured"
          subtitle="Add your Odds API key in Settings to enable Vegas comparisons." />
      )}
    </div>
  );
}

function OpportunityCard({ opp }: { opp: CrossMarketOpp }) {
  const wallets = useAppStore((s) => s.trackedWallets);
  const bankroll = useAppStore((s) => s.settings.bankroll);
  const kelly = useAppStore((s) => s.settings.kellyMultiplier);
  const maxPosition = useAppStore((s) => s.settings.maxPosition);
  const [analysis, setAnalysis] = useState<ClaudeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spreadPct = opp.spread * 100;
  const spreadColor = spreadPct >= 10 ? "success" : "warning";
  const polyFav = opp.favoredPlatform === "polymarket";

  const analyze = async () => {
    setLoading(true);
    setError(null);
    const market = polyFav ? opp.polymarket : opp.kalshi;
    const r = await analyzeMarketWithClaude({
      market, wallets, bankroll, kellyMultiplier: kelly,
      maxPositionPct: maxPosition * 100,
      crossMarketData: {
        kalshiYes: opp.kalshiYes,
        spread: opp.spread,
        favoredPlatform: opp.favoredPlatform,
      },
    });
    if (r) setAnalysis(r);
    else setError("No strong signal detected on this market right now.");
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold leading-snug text-foreground">{opp.question}</h3>

      <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <PlatformCol name="Polymarket" yes={opp.polyYes} no={1 - opp.polyYes}
          volume={opp.polymarket.volume24h} highlight={polyFav} />

        <div className="flex flex-col items-center gap-2">
          <span className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
            spreadColor === "success"
              ? "border-success/40 bg-success/15 text-success"
              : "border-warning/40 bg-warning/15 text-warning",
          )}>{spreadPct.toFixed(1)}% Spread</span>
          <ArrowRight className={cn("h-5 w-5", polyFav ? "rotate-180 text-info" : "text-info")} />
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
            Buy on {opp.favoredPlatform}
          </span>
        </div>

        <PlatformCol name="Kalshi" yes={opp.kalshiYes} no={1 - opp.kalshiYes}
          volume={opp.kalshi.volume24h} highlight={!polyFav} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <span className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">
          Buy {opp.direction} on {opp.favoredPlatform}
        </span>
        <span className="text-xs font-mono text-success font-semibold">+{(opp.edge * 100).toFixed(1)}% estimated edge</span>
        <button onClick={analyze} disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-purple/40 bg-purple/10 px-3 py-1.5 text-xs font-semibold text-purple hover:bg-purple/20 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
          {loading ? "Analyzing..." : "Analyze with Claude"}
        </button>
      </div>

      {error && !analysis && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {analysis && (
        <div className="mt-4 relative rounded-md border border-purple/30 bg-purple/5 p-4 space-y-3">
          <button onClick={() => setAnalysis(null)}
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple uppercase tracking-wide">
            <Brain className="h-3.5 w-3.5" /> Claude Analysis
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className={cn("rounded-md px-2 py-0.5 font-bold",
              analysis.direction === "YES" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
              {analysis.direction}
            </span>
            <span className="font-bold text-foreground">{fmtUSD(analysis.suggestedAmount)}</span>
            <span className="text-success">+{(analysis.edge * 100).toFixed(1)}% edge</span>
            <span className="text-warning capitalize">{analysis.riskLevel} risk</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{analysis.reasoning}</p>
          <ConfidenceBar value={analysis.confidence} size="sm" />
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
            <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
            <span>AI suggestion only. Verify independently before trading.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformCol({ name, yes, no, volume, highlight }: {
  name: string; yes: number; no: number; volume: number; highlight: boolean;
}) {
  return (
    <div className={cn(
      "rounded-md border bg-background/40 p-3",
      highlight ? "border-info/50 bg-info/5" : "border-border",
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{name}</span>
        <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
          {fmtUSD(volume)}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div>
          <div className="text-[10px] uppercase text-success/80 font-semibold">YES</div>
          <div className="font-sans text-2xl font-extrabold text-success leading-none">{(yes * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-destructive/80 font-semibold">NO</div>
          <div className="font-mono text-sm font-bold text-destructive">{(no * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}
