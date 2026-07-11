import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EliteTeaser() {
  const nav = useNavigate();
  return (
    <div className="rounded-lg border-2 border-dashed border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-purple/5 p-3 sm:p-4 flex items-center gap-3">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-white shrink-0">
        <Lock className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wide">
          <Sparkles className="h-3 w-3" /> Elite Feature
        </div>
        <div className="text-sm font-bold text-foreground leading-tight">
          Devil's Advocate AI + Risk AI
        </div>
        <div className="text-[11px] text-muted-foreground">
          Contrarian second opinion and volatility grading on every pick.
        </div>
      </div>
      <button
        onClick={() => nav("/upgrade")}
        className="shrink-0 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 text-[11px] font-bold text-white hover:opacity-90"
      >
        Upgrade to Elite
      </button>
    </div>
  );
}