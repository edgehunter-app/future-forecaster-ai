import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const RAPID_DAILY_LIMIT = 1000;

export default function UsagePanel() {
  const [usedToday, setUsedToday] = useState<number>(0);
  const [oddsApiUsedToday, setOddsApiUsedToday] = useState<number>(0);
  const [oddsApiRemaining, setOddsApiRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [rapid, oddsToday, oddsRem] = await Promise.all([
        supabase.from("api_usage").select("request_count")
          .eq("provider", "rapidapi-sportsbook").eq("used_at", today).maybeSingle(),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "the-odds-api").eq("used_at", today).maybeSingle(),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "the-odds-api").eq("used_at", "9999-12-31").maybeSingle(),
      ]);
      if (cancelled) return;
      setUsedToday(rapid.data?.request_count ?? 0);
      setOddsApiUsedToday(oddsToday.data?.request_count ?? 0);
      setOddsApiRemaining(
        typeof oddsRem.data?.request_count === "number" ? oddsRem.data.request_count : null,
      );
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
    <div className="space-y-3">
    <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sportsbook API (RapidAPI Pro) · NBA, MLB, NHL, NFL, MLS, EPL
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
      <div className="md:col-span-3 border-t border-border/60 pt-2 mt-1 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-foreground">Best Bet scan cost:</span>
        <span>Sports only: ~$0.015</span>
        <span>Prediction markets: ~$0.015</span>
        <span>Wallet signals: ~$0.009</span>
        <span className="text-foreground font-semibold">Full scan (all sources): ~$0.04</span>
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            The Odds API · FIFA World Cup + Golf majors
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {oddsApiUsedToday.toLocaleString()} calls today
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {oddsApiRemaining !== null
            ? <>Requests remaining: <span className="text-foreground font-semibold">{oddsApiRemaining.toLocaleString()}</span> · Resets monthly</>
            : <>Remaining updates after first refresh · Resets monthly</>}
        </div>
      </div>
      <div className="text-right space-y-0.5">
        <div className="text-sm font-bold text-info">
          {oddsApiRemaining !== null ? `${oddsApiRemaining.toLocaleString()} left` : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground">Secondary source</div>
      </div>
    </div>
    </div>
  );
}
