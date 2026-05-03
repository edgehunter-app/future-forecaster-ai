import { Sparkles, ShieldAlert } from "lucide-react";
import type { Suggestion } from "@/types";
import { cn, fmtUSD } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import ConfidenceBar from "@/components/ui/ConfidenceBar";

const COLORS = {
  yes: "#10b981",
  no: "#ef4444",
  purple: "#8b5cf6",
  amber: "#f59e0b",
};

const CATEGORY_COLORS: Record<string, string> = {
  Economics: "#3b82f6",
  Crypto: "#f59e0b",
  Science: "#8b5cf6",
  Finance: "#10b981",
  Sports: "#10b981",
  Politics: "#3b82f6",
};

interface Props {
  suggestion: Suggestion;
  bankroll: number;
}

export function SuggestionCard({ suggestion: s }: Props) {
  const dirColor = s.direction === "YES" ? COLORS.yes : COLORS.no;
  const catColor = CATEGORY_COLORS[s.category] ?? "#6b7280";

  return (
    <div
      className="group rounded-lg bg-card p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        border: `1px solid ${dirColor}33`,
        boxShadow: `0 8px 24px -12px ${dirColor}1a`,
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={catColor} small>{s.category}</Badge>
        <Badge color={dirColor}>{s.direction}</Badge>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{s.createdAt}</span>
      </div>

      {/* Question */}
      <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{s.question}</h3>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Metric label="Current Odds" value={`${(s.currentOdds * 100).toFixed(0)}%`} color="hsl(var(--foreground))" />
        <Metric label="Edge" value={`+${(s.edge * 100).toFixed(1)}%`} color={COLORS.yes} />
        <Metric label="Suggested" value={fmtUSD(s.suggestedAmount, { compact: true })} color={dirColor} />
      </div>

      {/* Confidence */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</span>
        </div>
        <ConfidenceBar value={s.confidence} />
      </div>

      {/* Reasoning */}
      <div className="mt-4 flex gap-2.5 rounded-md bg-muted/40 p-3 border border-border/50">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple" />
        <p className="text-xs italic leading-relaxed text-muted-foreground">{s.reasoning}</p>
      </div>

      {/* Wallet signals */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Wallet signals:</span>
        {s.walletSignals.map((w) => (
          <Badge key={w} color={COLORS.purple} small>{w}</Badge>
        ))}
      </div>

      {/* Safety */}
      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-warning leading-snug">
          Suggestion only — No auto-execution. Verify independently before trading.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={cn("mt-0.5 font-mono text-sm font-bold")} style={{ color }}>{value}</div>
    </div>
  );
}

export default SuggestionCard;
