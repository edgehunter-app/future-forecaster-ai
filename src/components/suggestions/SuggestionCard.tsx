import { useState } from "react";
import {
  Sparkles, ShieldAlert, ChevronDown, ChevronUp, Copy, X, Share2,
  Zap, TrendingUp, Target, Repeat, Check, XCircle,
} from "lucide-react";
import type { Suggestion } from "@/types";
import { cn, fmtUSD, categoryColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import ConfidenceBar from "@/components/ui/ConfidenceBar";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/components/ui/AppToast";
import {
  getConfidenceColor,
  getConfidenceBg,
  getConfidenceBorder,
  getConfidenceLabel,
  getConfidenceAction,
  getConfidenceTier,
} from "@/lib/confidenceColor";

const COLORS = {
  yes: "#10b981",
  no: "#ef4444",
  purple: "#8b5cf6",
  warning: "#f59e0b",
  info: "#3b82f6",
};

interface Props {
  suggestion: Suggestion;
  bankroll: number;
  onDismiss?: () => void;
  onMarkOutcome?: (outcome: "won" | "lost") => void;
}

export function SuggestionCard({ suggestion: s, bankroll, onDismiss, onMarkOutcome }: Props) {
  const dismissStore = useAppStore((st) => st.dismissSuggestion);
  const kellyMult = useAppStore((st) => st.settings.kellyMultiplier);
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const ageMs = (() => {
    const m = /(\d+)\s*h/.exec(s.createdAt);
    if (m) return Number(m[1]) * 3600000;
    const t = Date.parse(s.createdAt);
    return isNaN(t) ? Infinity : Date.now() - t;
  })();
  const showOutcome = onMarkOutcome && ageMs > 60 * 60 * 1000 && s.status === "active";

  const handleOutcome = (o: "won" | "lost") => {
    onMarkOutcome?.(o);
    showToast("✓ Outcome recorded", "success");
  };
  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    else dismissStore(s.id);
  };

  const dirColor = s.direction === "YES" ? COLORS.yes : COLORS.no;
  const catColor = categoryColor(s.category);

  const confColor = getConfidenceColor(s.confidence);
  const confBg = getConfidenceBg(s.confidence);
  const confBorder = getConfidenceBorder(s.confidence);
  const confLabel = getConfidenceLabel(s.confidence);
  const confAction = getConfidenceAction(s.confidence, s.direction);
  const confTier = getConfidenceTier(s.confidence);
  const isWeak = confTier === "weak";

  const rawKelly = (s.edge * bankroll) / Math.max(s.currentOdds, 0.01);
  const quarterKelly = rawKelly * kellyMult;
  const maxCap = bankroll * 0.05;
  const finalSize = Math.min(quarterKelly, maxCap);

  const statusDot =
    s.status === "active" ? { color: COLORS.yes, pulse: true } :
    s.status === "expired" ? { color: "#6b7280", pulse: false } :
    s.status === "executed" ? { color: COLORS.info, pulse: false } :
    { color: "#ef4444", pulse: false };

  const signals: { icon: typeof Zap; label: string; color: string }[] = [
    { icon: Target, label: "Odds Mispricing", color: COLORS.info },
  ];
  if (s.confidence > 70) signals.unshift({ icon: Zap, label: "Whale Entry", color: COLORS.purple });
  if (s.edge > 0.10) signals.push({ icon: TrendingUp, label: "Volume Spike", color: COLORS.warning });
  if (s.currentOdds < 0.40) signals.push({ icon: Repeat, label: "Contrarian Play", color: COLORS.yes });

  const copyTrade = () => {
    const txt = `EdgeHunter: ${s.question} → ${s.direction} ${fmtUSD(s.suggestedAmount)} (confidence: ${s.confidence}%)`;
    void navigator.clipboard?.writeText(txt);
  };

  return (
    <div
      className="group relative rounded-lg bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden"
      style={{
        border: `1px solid ${confBorder}`,
        boxShadow: `0 0 0 1px ${confColor}10, 0 4px 24px ${confColor}14`,
        opacity: isWeak ? 0.7 : 1,
      }}
    >
      {isWeak && (
        <span
          className="pointer-events-none absolute -right-4 top-6 select-none font-extrabold tracking-widest"
          style={{ fontSize: 48, color: confColor, opacity: 0.15, transform: "rotate(20deg)" }}
        >
          WEAK
        </span>
      )}

      {/* Top row */}
      <div className="flex items-center gap-2 flex-wrap pr-2">
        <Badge color={catColor} small>{s.category}</Badge>
        <Badge color={dirColor}>{s.direction}</Badge>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: confBg, border: `1px solid ${confBorder}` }}
        >
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: confColor }}>
            {statusDot.pulse && (
              <span className="absolute inline-flex h-full w-full rounded-full opacity-60 live-dot" style={{ backgroundColor: confColor }} />
            )}
          </span>
          <span className="text-[10px] font-bold tracking-wider" style={{ color: confColor }}>
            {confLabel.toUpperCase()}
          </span>
        </span>
        <span className="text-xs text-muted-foreground font-mono">{s.createdAt}</span>
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{s.question}</h3>

      {/* Action strip */}
      <div
        className="mt-3 flex items-center justify-between rounded-md px-3 py-2"
        style={{ background: confBg, border: `1px solid ${confBorder}` }}
      >
        <span className="text-[13px] font-bold" style={{ color: confColor }}>
          {isWeak ? "Low Confidence — Consider Skipping" : confAction}
        </span>
        <span className="font-mono text-[11px]" style={{ color: confColor, opacity: 0.85 }}>
          {s.confidence}% confidence
        </span>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Metric label="Current Odds" value={`${(s.currentOdds * 100).toFixed(0)}%`} color="hsl(var(--foreground))" />
        <Metric label="Edge" value={`+${(s.edge * 100).toFixed(1)}%`} color={COLORS.yes} />
        <Metric label="Suggested" value={isWeak ? "—" : fmtUSD(s.suggestedAmount)} color={confColor} />
      </div>

      {/* Confidence */}
      <div className="mt-4">
        <div className="mb-1.5">
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

      {/* Expandable */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80 transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "Hide Analysis" : "Show Analysis"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-border bg-background/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              Position Sizing (Quarter Kelly)
            </div>
            <SizingRow label="Bankroll" value={fmtUSD(bankroll)} />
            <SizingRow label="Raw Kelly" value={fmtUSD(rawKelly)} />
            <SizingRow label={`Quarter Kelly (${kellyMult}x)`} value={fmtUSD(quarterKelly)} />
            <SizingRow label="Max position cap (5%)" value={fmtUSD(maxCap)} />
            <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-xs font-semibold text-foreground">→ Suggested</span>
              <span className="font-mono text-sm font-bold" style={{ color: dirColor }}>{fmtUSD(finalSize)}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Signal Breakdown</div>
            <div className="flex flex-wrap gap-1.5">
              {signals.map((sig) => (
                <span key={sig.label}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${sig.color}1a`, borderColor: `${sig.color}40`, color: sig.color }}>
                  <sig.icon className="h-3 w-3" /> {sig.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Safety */}
      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-warning leading-snug">
          Suggestion only — No auto-execution. Verify independently before trading.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <ActionBtn icon={Copy} label="Copy Trade" onClick={copyTrade} />
        <ActionBtn icon={Share2} label="Share" />
        {showOutcome && (
          <>
            <button
              onClick={() => handleOutcome("won")}
              className="card-action-btn inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/20"
            >
              <Check className="h-3 w-3" /> Won
            </button>
            <button
              onClick={() => handleOutcome("lost")}
              className="card-action-btn inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            >
              <XCircle className="h-3 w-3" /> Lost
            </button>
          </>
        )}
        <ActionBtn icon={X} label="Dismiss" onClick={handleDismiss} danger className="ml-auto" />
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

function SizingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger, className }: {
  icon: typeof Copy; label: string; onClick?: () => void; danger?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "card-action-btn inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs font-medium transition-colors",
        danger ? "text-destructive hover:bg-destructive/10 hover:border-destructive/40"
               : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className,
      )}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

import { memo as __memo } from "react";
export default __memo(SuggestionCard);
