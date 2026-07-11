import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskFactor {
  factor?: string;
  impact?: "LOW" | "MEDIUM" | "HIGH" | string;
  description?: string;
}

export interface RiskProfileData {
  level?: "LOW" | "MEDIUM" | "HIGH" | string;
  score?: number;
  factors?: RiskFactor[];
  volatilityType?: string;
  recommendation?: string;
}

interface Props {
  data: RiskProfileData;
}

function levelTone(l?: string) {
  const up = (l ?? "").toUpperCase();
  if (up === "LOW") return { cls: "border-success/40 bg-success/10 text-success", label: "Low Risk", bar: "bg-success" };
  if (up === "HIGH") return { cls: "border-destructive/50 bg-destructive/15 text-destructive", label: "High Risk", bar: "bg-destructive" };
  return { cls: "border-warning/40 bg-warning/15 text-warning", label: "Medium Risk", bar: "bg-warning" };
}

function impactTone(i?: string) {
  const up = (i ?? "").toUpperCase();
  if (up === "LOW") return "border-success/40 bg-success/10 text-success";
  if (up === "HIGH") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-warning/40 bg-warning/10 text-warning";
}

function volatilityEmoji(v?: string) {
  switch ((v ?? "").toUpperCase()) {
    case "LINE_MOVEMENT": return "📊 Line Movement Risk";
    case "INJURY_RISK": return "🏥 Injury Risk";
    case "PUBLIC_TRAP": return "🐑 Public Money Trap";
    case "SHARP_FADE": return "🎯 Sharp Fade";
    case "WEATHER": return "🌧 Weather Risk";
    case "VARIANCE": return "⚡ High Variance";
    case "STABLE": return "✅ Stable Market";
    default: return v ?? "";
  }
}

export default function RiskAIPanel({ data }: Props) {
  const tone = levelTone(data.level);
  const score = Math.max(0, Math.min(10, Number(data.score ?? 0)));
  const factors = data.factors ?? [];

  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-info">
          <Shield className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Risk Assessment</span>
        </div>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase", tone.cls)}>
          {tone.label}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Risk score</span>
          <span className="text-[11px] font-mono font-bold text-foreground">{score}/10</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full transition-all", tone.bar)} style={{ width: `${score * 10}%` }} />
        </div>
      </div>

      {data.volatilityType && (
        <div>
          <span className="inline-block rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-semibold text-foreground">
            {volatilityEmoji(data.volatilityType)}
          </span>
        </div>
      )}

      {factors.length > 0 && (
        <div className="space-y-1.5">
          {factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2">
              <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase", impactTone(f.impact))}>
                {(f.impact ?? "MED").toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-foreground">{f.factor}</div>
                {f.description && (
                  <div className="text-[10px] text-muted-foreground leading-snug">{f.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.recommendation && (
        <p className="text-[11px] italic text-foreground/90 leading-snug border-t border-border/60 pt-2">
          {data.recommendation}
        </p>
      )}
    </div>
  );
}