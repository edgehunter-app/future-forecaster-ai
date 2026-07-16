import { useNavigate } from "react-router-dom";
import type { Suggestion } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  suggestions: Suggestion[];
}

function edgeTone(edgePct: number) {
  if (edgePct >= 5) return "text-success";
  if (edgePct >= 2) return "text-warning";
  return "text-muted-foreground";
}

function verdictBucket(confidence: number, edgePct: number): "go" | "caution" | "skip" {
  if (confidence >= 65 && edgePct >= 3) return "go";
  if (confidence >= 50) return "caution";
  return "skip";
}

export default function TodaySignalsList({ suggestions }: Props) {
  const navigate = useNavigate();
  const sorted = [...suggestions].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0)).slice(0, 8);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-card p-6 text-center">
        <p className="text-[13px] text-muted-foreground">
          No signals yet today. New picks post as edges appear.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const edgePct = (s.edge ?? 0) * 100;
        const v = verdictBucket(s.confidence ?? 0, edgePct);
        const emoji = v === "go" ? "✅" : v === "caution" ? "⚠️" : "⛔";
        const emojiBg =
          v === "go" ? "bg-success/15" : v === "caution" ? "bg-warning/15" : "bg-destructive/15";
        return (
          <button
            key={s.id}
            onClick={() => navigate("/suggestions")}
            className="w-full flex items-center gap-3 rounded-2xl border border-white/5 bg-card px-4 py-3 text-left hover:border-info/30 transition"
          >
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-[18px]",
                emojiBg,
              )}
            >
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground truncate">
                {s.question}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {s.category ?? "Signal"} · {s.direction}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={cn("font-mono text-[13px] font-bold", edgeTone(edgePct))}>
                {edgePct >= 0 ? "+" : ""}{edgePct.toFixed(1)}%
              </span>
              {(s.walletSignals?.[0] || s.keySignals?.[0]) && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground truncate max-w-[100px]">
                  {s.walletSignals?.[0] ?? s.keySignals?.[0]}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}