import { Sparkles } from "lucide-react";

export default function EliteTeaser() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple/15 text-purple">
        <Sparkles className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
          Unlock with Elite
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Risk Assessment and Devil's Advocate run on every pick.
        </p>
      </div>
      <a
        href="/upgrade"
        className="shrink-0 rounded-lg bg-purple px-3 py-2 text-[11px] font-bold text-white hover:opacity-90"
      >
        Upgrade
      </a>
    </div>
  );
}
