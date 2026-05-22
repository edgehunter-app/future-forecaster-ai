import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { UsageSummary } from "@/lib/oddsApiKeyManager";

const RAPID_DAILY_LIMIT = 1000;

// `summary` is accepted for compatibility but no longer rendered — the legacy
// Odds API quota is exhausted and tracked separately in Admin.
export default function UsagePanel(_props: { summary: UsageSummary }) {
  const [usedToday, setUsedToday] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("api_usage")
        .select("request_count")
        .eq("provider", "rapidapi-sportsbook")
        .eq("used_at", today)
        .maybeSingle();
      if (!cancelled) setUsedToday(data?.request_count ?? 0);
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const pct = Math.min(100, Math.round((usedToday / RAPID_DAILY_LIMIT) * 100));
  const ratio = usedToday / RAPID_DAILY_LIMIT;
  const colorBar = ratio >= 0.8 ? "bg-destructive" : ratio >= 0.5 ? "bg-warning" : "bg-success";
  const colorText = ratio >= 0.8 ? "text-destructive" : ratio >= 0.5 ? "text-warning" : "text-success";

  return (
    <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            RapidAPI · Sportsbook (Pro)
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {usedToday.toLocaleString()} / {RAPID_DAILY_LIMIT.toLocaleString()} used today
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
          <div className={cn("h-full transition-all", colorBar)} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground">Resets daily at midnight UTC</div>
      </div>
      <div className="text-right space-y-0.5">
        <div className={cn("text-sm font-bold", colorText)}>{pct}% used</div>
        <div className="text-[11px] text-muted-foreground">Manual refresh only</div>
      </div>
    </div>
  );
}
