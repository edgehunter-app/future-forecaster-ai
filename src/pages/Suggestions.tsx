import { RotateCw, SearchX, Lightbulb } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import SuggestionCard from "@/components/suggestions/SuggestionCard";
import EmptyState from "@/components/ui/EmptyState";
import { cn, fmtUSD } from "@/lib/utils";
import type { DirectionFilter, SortBy, StatusFilter } from "@/store/useAppStore";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Sparkles } from "lucide-react";
import {
  getConfidenceTier,
  getConfidenceColor,
  getConfidenceBg,
  type ConfidenceTier,
} from "@/lib/confidenceColor";

const CATEGORIES = ["All", "Economics", "Crypto", "Science", "Finance", "Politics"];
const SORTS: { key: SortBy; label: string }[] = [
  { key: "confidence", label: "Highest Confidence" },
  { key: "edge", label: "Highest Edge" },
  { key: "newest", label: "Newest" },
  { key: "expiring", label: "Expiring Soon" },
];
const DIRS: { key: DirectionFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "YES", label: "YES only" }, { key: "NO", label: "NO only" },
];
const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Active" }, { key: "expired", label: "Expired" },
  { key: "won", label: "Won" }, { key: "lost", label: "Lost" },
];

export default function Suggestions() {
  usePageTitle("Suggestions");
  const filters = useAppStore((s) => s.suggestionFilters);
  const setFilters = useAppStore((s) => s.setSuggestionFilters);
  const statuses =
    filters.status === "active" ? ["active"] :
    filters.status === "expired" ? ["expired"] :
    filters.status === "won" ? ["won"] :
    filters.status === "lost" ? ["lost"] : ["active"];
  const { suggestions, dismissSuggestion, markOutcome, reload } = useSuggestionsDB(statuses);
  const bankroll = useAppStore((s) => s.settings.bankroll);
  const { isElite } = useSubscription();
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  useEffect(() => {
    if (!isElite) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("wallet_scan_runs")
        .select("ran_at")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setLastScanAt(data?.ran_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isElite, suggestions.length]);
  const [activeTiers, setActiveTiers] = useState<ConfidenceTier[]>(["strong", "moderate", "weak"]);
  const toggleTier = (t: ConfidenceTier) =>
    setActiveTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const filtered = suggestions
    .filter((s) => filters.category === "All" || s.category === filters.category)
    .filter((s) => filters.direction === "all" || s.direction === filters.direction)
    .filter((s) => filters.status !== "active" || s.status === "active")
    .filter((s) => activeTiers.includes(getConfidenceTier(s.confidence)))
    .sort((a, b) => {
      switch (filters.sortBy) {
        case "edge": return b.edge - a.edge;
        case "newest": return parseInt(a.createdAt) - parseInt(b.createdAt);
        case "expiring": return parseInt(a.expiresAt) - parseInt(b.expiresAt);
        default: return b.confidence - a.confidence;
      }
    });

  const avgConf = filtered.length ? filtered.reduce((a, s) => a + s.confidence, 0) / filtered.length : 0;
  const totalCap = filtered.reduce((a, s) => a + s.suggestedAmount, 0);
  const edgeValue = filtered.reduce((a, s) => a + s.suggestedAmount * s.edge, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Trade Suggestions</h1>
          <p className="text-sm text-muted-foreground">AI-powered analysis — manual execution only</p>
          {isElite && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-purple-400" />
              {lastScanAt
                ? `Last wallet scan: ${formatRelative(lastScanAt)}`
                : "Wallet scan: awaiting first daily run"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              console.log("[Suggestions] Refresh clicked, calling reload()");
              const t0 = performance.now();
              await reload();
              console.log(
                `[Suggestions] reload() done in ${(performance.now() - t0).toFixed(0)}ms — visible suggestions: ${suggestions.length}`,
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 live-dot" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {suggestions.filter((s) => s.status === "active").length} Active
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilters({ category: c })}
              className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filters.category === c ? "border-info bg-info text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20")}>{c}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterGroup label="Signal">
            {(["strong", "moderate", "weak"] as ConfidenceTier[]).map((t) => {
              const score = t === "strong" ? 70 : t === "moderate" ? 55 : 30;
              const c = getConfidenceColor(score);
              const active = activeTiers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors"
                  style={{
                    borderColor: active ? c : "hsl(var(--border))",
                    background: active ? getConfidenceBg(score) : "transparent",
                    color: active ? c : "hsl(var(--muted-foreground))",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                  {t}
                </button>
              );
            })}
          </FilterGroup>
          <FilterGroup label="Sort by">
            {SORTS.map((o) => (
              <PillBtn key={o.key} active={filters.sortBy === o.key} onClick={() => setFilters({ sortBy: o.key })}>{o.label}</PillBtn>
            ))}
          </FilterGroup>
          <FilterGroup label="Direction">
            {DIRS.map((o) => (
              <PillBtn key={o.key} active={filters.direction === o.key} onClick={() => setFilters({ direction: o.key })}>{o.label}</PillBtn>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            {STATUSES.map((o) => (
              <PillBtn key={o.key} active={filters.status === o.key} onClick={() => setFilters({ status: o.key })}>{o.label}</PillBtn>
            ))}
          </FilterGroup>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card/60 px-5 py-3">
        <SumStat label="Showing" value={String(filtered.length)} />
        <Divider />
        <SumStat label="Avg Confidence" value={`${avgConf.toFixed(0)}%`} color="hsl(var(--info))" />
        <Divider />
        <SumStat label="Suggested Capital" value={fmtUSD(totalCap)} />
        <Divider />
        <SumStat label="Edge Value" value={fmtUSD(edgeValue)} color="hsl(var(--success))" />
      </div>

      {/* Grid */}
      {suggestions.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No suggestions yet"
          subtitle="Analyze a game on Sports or check a bet on Search to generate your first AI-powered signals here."
          action={{ label: "Go to Sports", onClick: () => { window.location.href = "/sports"; } }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No suggestions match your filters"
          subtitle="Try widening your category, direction or status filters."
          action={{ label: "Reset filters", onClick: () => setFilters({ category: "All", direction: "all", status: "active", sortBy: "confidence" }) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filtered.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              bankroll={bankroll}
              onDismiss={() => dismissSuggestion(s.id)}
              onMarkOutcome={(o) => markOutcome(s.id, o)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}:</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active ? "border-info bg-info/15 text-info"
          : "border-border bg-card text-muted-foreground hover:text-foreground")}>{children}</button>
  );
}

function SumStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: color ?? "hsl(var(--foreground))" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden h-8 w-px bg-border md:inline-block" />;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
