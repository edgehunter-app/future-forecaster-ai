import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DevilsAdvocateData {
  verdict?: "PROCEED" | "CAUTION" | "AVOID" | string;
  strength?: number;
  topArguments?: string[];
  keyRisks?: string[];
  alternativeView?: string;
  verdictReason?: string;
}

interface Props {
  data: DevilsAdvocateData;
}

function verdictTone(v?: string) {
  const up = (v ?? "").toUpperCase();
  if (up === "PROCEED") return { cls: "border-success/40 bg-success/10 text-success", label: "Risk Acceptable" };
  if (up === "AVOID") return { cls: "border-destructive/50 bg-destructive/15 text-destructive", label: "Strong Case Against" };
  return { cls: "border-warning/40 bg-warning/15 text-warning", label: "Proceed Carefully" };
}

function strengthTone(s: number) {
  if (s >= 7) return "bg-destructive";
  if (s >= 4) return "bg-warning";
  return "bg-success";
}

export default function DevilsAdvocatePanel({ data }: Props) {
  const v = verdictTone(data.verdict);
  const strength = Math.max(0, Math.min(10, Number(data.strength ?? 0)));
  const args = data.topArguments ?? [];
  const risks = data.keyRisks ?? [];

  return (
    <div className="rounded-lg border-2 border-destructive/40 bg-gradient-to-br from-destructive/5 via-warning/5 to-card p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">😈</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-destructive">
              Devil's Advocate
            </div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">
              The case AGAINST this bet
            </div>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", v.cls)}>
          {(data.verdict ?? "CAUTION").toUpperCase()} · {v.label}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
            Argument strength
          </span>
          <span className="text-[11px] font-mono font-bold text-foreground">{strength}/10</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all", strengthTone(strength))}
            style={{ width: `${strength * 10}%` }}
          />
        </div>
      </div>

      {args.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
            Top Arguments
          </div>
          <ol className="space-y-1.5">
            {args.map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                <div className="text-[11px] text-foreground/90 leading-relaxed">
                  <span className="font-bold text-destructive mr-1">{i + 1}.</span>
                  {a}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {risks.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase font-semibold text-muted-foreground">
            Key Risks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {risks.map((r, i) => (
              <span
                key={i}
                className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.alternativeView && (
        <div className="rounded-md border border-border/60 bg-background/70 p-3">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
            What the market may know
          </div>
          <p className="text-[11px] italic text-foreground/90 leading-relaxed">
            {data.alternativeView}
          </p>
        </div>
      )}

      {data.verdictReason && (
        <div className="flex items-start gap-2 border-t border-border/60 pt-2">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
          <p className="text-[12px] font-bold text-foreground leading-snug">
            {data.verdictReason}
          </p>
        </div>
      )}
    </div>
  );
}