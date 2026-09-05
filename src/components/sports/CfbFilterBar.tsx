import { cn } from "@/lib/utils";
import { CFB_CONFERENCES_FBS } from "@/lib/cfbTeams";

export type CfbView = "top25" | "fbs" | "fcs" | "all";

const VIEWS: { key: CfbView; label: string }[] = [
  { key: "top25", label: "Top 25" },
  { key: "fbs", label: "FBS only" },
  { key: "fcs", label: "FCS / buy games" },
  { key: "all", label: "All games" },
];

export default function CfbFilterBar({
  view,
  onViewChange,
  conference,
  onConferenceChange,
  viewCounts,
  conferenceCounts,
  poll,
}: {
  view: CfbView;
  onViewChange: (v: CfbView) => void;
  conference: string | null;
  onConferenceChange: (c: string | null) => void;
  viewCounts: Record<CfbView, number>;
  conferenceCounts: Record<string, number>;
  poll: string | null;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          College football filters
        </span>
        {poll && view === "top25" && (
          <span className="text-[10px] text-muted-foreground">Ranked by {poll}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              view === v.key
                ? "border-info bg-info text-white"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
            <span className="opacity-70">{viewCounts[v.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onConferenceChange(null)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            conference === null
              ? "border-foreground/40 bg-secondary text-foreground"
              : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
          )}
        >
          All conferences
        </button>
        {CFB_CONFERENCES_FBS.filter((c) => (conferenceCounts[c] ?? 0) > 0).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onConferenceChange(conference === c ? null : c)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              conference === c
                ? "border-foreground/40 bg-secondary text-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
            <span className="opacity-70">{conferenceCounts[c]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
