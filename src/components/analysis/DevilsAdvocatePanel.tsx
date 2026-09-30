import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge, { type BadgeTone } from "@/components/ui/StatusBadge";

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

function verdictTone(v?: string): { tone: BadgeTone; label: string } {
  const up = (v ?? "").toUpperCase();
  if (up === "PROCEED") return { tone: "success", label: "Risk Acceptable" };
  if (up === "AVOID") return { tone: "destructive", label: "Strong Case Against" };
  return { tone: "warning", label: "Proceed Carefully" };
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
    <div className="rounded-lg border border-border bg-background/40 p-3 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
        <StatusBadge tone={v.tone} size="md">
          {(data.verdict ?? "CAUTION").toUpperCase()} · {v.label}
        </StatusBadge>
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
              <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <span className="shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground/90">{a}</span>
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
              <StatusBadge key={i} tone="destructive" size="sm">
                {r}
              </StatusBadge>
            ))}
          </div>
        </div>
      )}

      {data.alternativeView && (
        <div className="border-t border-border/60 pt-2">
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
