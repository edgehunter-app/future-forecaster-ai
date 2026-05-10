import { Search, X, BarChart2 } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import MarketRow from "@/components/markets/MarketRow";
import EmptyState from "@/components/ui/EmptyState";
import { useMarkets } from "@/hooks/useMarkets";
import { cn, fmtUSD } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

const CATEGORIES = ["All", "Economics", "Crypto", "Science", "Finance"];

type SourceFilter = "all" | "polymarket" | "kalshi";
const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "polymarket", label: "Polymarket" },
  { id: "kalshi", label: "Kalshi" },
];

const LEGEND = [
  { color: "#10b981", label: "Strong (65%+)" },
  { color: "#f59e0b", label: "Moderate (50-64%)" },
  { color: "#ef4444", label: "Weak (below 50%)" },
];

export default function Markets() {
  usePageTitle("Markets");
  const { markets, loading, error } = useMarkets();
  const { searchQuery: search, category: cat } = useAppStore((s) => s.marketFilters);
  const setMarketFilters = useAppStore((s) => s.setMarketFilters);
  const setSearch = (q: string) => setMarketFilters({ searchQuery: q });
  const setCat = (c: string) => setMarketFilters({ category: c });
  const [source, setSource] = useState<SourceFilter>("all");

  const counts = {
    all: markets.length,
    polymarket: markets.filter((m) => m.source !== "kalshi").length,
    kalshi: markets.filter((m) => m.source === "kalshi").length,
  };

  const filtered = markets.filter((m) => {
    const okCat = cat === "All" || m.category === cat;
    const okSearch = !search || m.question.toLowerCase().includes(search.toLowerCase());
    const okSource =
      source === "all" ||
      (source === "kalshi" ? m.source === "kalshi" : m.source !== "kalshi");
    return okCat && okSearch && okSource;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Markets</h1>
        <p className="text-sm text-muted-foreground">
          Live prediction market data from Polymarket and Kalshi
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative w-full md:max-w-[400px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets..."
            className="w-full rounded-md border border-border bg-card pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-info focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                cat === c
                  ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20",
              )}
            >{c}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                source === s.id
                  ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20",
              )}
            >
              {s.label} <span className="opacity-70">({counts[s.id]})</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Kalshi is CFTC regulated · Settles in USD · Polymarket is offshore · Settles in USDC
        </p>
      </div>

      {/* List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-3.5 py-2">
          <span className="text-[11px] text-muted-foreground">Signal strength:</span>
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[11px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
        {markets.length === 0 && !loading && (
          <EmptyState
            icon={BarChart2}
            title="No markets available"
            subtitle={error ?? "Markets will appear here once data loads from Polymarket."}
          />
        )}
        {markets.length > 0 && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No markets match your filters.
          </div>
        )}
        {filtered.map((m) => <MarketRow key={m.id} market={m} />)}
      </div>

      {/* Activity */}
      {markets.length > 0 && <div className="pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground mb-3">Market Activity</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {markets.map((m) => {
            const pct = (m.volume24h / m.totalVolume) * 100;
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm font-semibold text-foreground line-clamp-1">{m.question}</div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>24h: {fmtUSD(m.volume24h)}</span>
                  <span>Total: {fmtUSD(m.totalVolume)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-info transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-1 text-[11px] font-mono text-info">{pct.toFixed(1)}% in last 24h</div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
