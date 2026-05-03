import { RotateCw, SearchX } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import SuggestionCard from "@/components/suggestions/SuggestionCard";
import EmptyState from "@/components/ui/EmptyState";
import { cn, fmtUSD } from "@/lib/utils";
import type { DirectionFilter, SortBy, StatusFilter } from "@/store/useAppStore";

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
  const suggestions = useAppStore((s) => s.suggestions);
  const bankroll = useAppStore((s) => s.settings.bankroll);
  const filters = useAppStore((s) => s.suggestionFilters);
  const setFilters = useAppStore((s) => s.setSuggestionFilters);

  const filtered = suggestions
    .filter((s) => filters.category === "All" || s.category === filters.category)
    .filter((s) => filters.direction === "all" || s.direction === filters.direction)
    .filter((s) => filters.status !== "active" || s.status === "active")
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
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
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
      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No suggestions match your filters"
          subtitle="Try widening your category, direction or status filters."
          action={{ label: "Reset filters", onClick: () => setFilters({ category: "All", direction: "all", status: "active", sortBy: "confidence" }) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filtered.map((s) => <SuggestionCard key={s.id} suggestion={s} bankroll={bankroll} />)}
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
