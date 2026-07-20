import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getLastOddsApiStatus, type OddsApiStatusSnapshot } from "@/lib/oddsApi";
import { AlertTriangle } from "lucide-react";

const RAPID_DAILY_LIMIT = 1000;
const GOLF_LB_MONTHLY_LIMIT = 250;

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString().slice(0, 10);
}
function nextMonthResetLabel(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export default function UsagePanel() {
  const [usedToday, setUsedToday] = useState<number>(0);
  const [oddsApiUsedToday, setOddsApiUsedToday] = useState<number>(0);
  const [oddsApiRemaining, setOddsApiRemaining] = useState<number | null>(null);
  const [golfLbUsedMonth, setGolfLbUsedMonth] = useState<number>(0);
  const [golfLbRemaining, setGolfLbRemaining] = useState<number | null>(null);
  const [oddsApiStatus, setOddsApiStatus] = useState<OddsApiStatusSnapshot>(getLastOddsApiStatus());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = monthStartIso();
      const [rapid, oddsToday, oddsRem, golfMonth, golfRem] = await Promise.all([
        supabase.from("api_usage").select("request_count")
          .eq("provider", "rapidapi-sportsbook").eq("used_at", today).maybeSingle(),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "the-odds-api").eq("used_at", today).maybeSingle(),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "the-odds-api").eq("used_at", "9999-12-31").maybeSingle(),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "rapidapi-golf-leaderboard").gte("used_at", monthStart)
          .lt("used_at", "9999-12-31"),
        supabase.from("api_usage").select("request_count")
          .eq("provider", "rapidapi-golf-leaderboard").eq("used_at", "9999-12-31").maybeSingle(),
      ]);
      if (cancelled) return;
      setUsedToday(rapid.data?.request_count ?? 0);
      setOddsApiUsedToday(oddsToday.data?.request_count ?? 0);
      setOddsApiRemaining(
        typeof oddsRem.data?.request_count === "number" ? oddsRem.data.request_count : null,
      );
      const monthSum = Array.isArray(golfMonth.data)
        ? golfMonth.data.reduce((s: number, r: any) => s + (r?.request_count ?? 0), 0)
        : 0;
      setGolfLbUsedMonth(monthSum);
      setGolfLbRemaining(
        typeof golfRem.data?.request_count === "number" ? golfRem.data.request_count : null,
      );
    };
    void load();
    const id = setInterval(load, 30_000);
    const statusId = setInterval(() => setOddsApiStatus(getLastOddsApiStatus()), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(statusId);
    };
  }, []);

  const pct = Math.min(100, Math.round((usedToday / RAPID_DAILY_LIMIT) * 100));
  const ratio = usedToday / RAPID_DAILY_LIMIT;
  const colorBar = ratio >= 0.8 ? "bg-destructive" : ratio >= 0.5 ? "bg-warning" : "bg-success";
  const colorText = ratio >= 0.8 ? "text-destructive" : ratio >= 0.5 ? "text-warning" : "text-success";

  const golfPct = Math.min(100, Math.round((golfLbUsedMonth / GOLF_LB_MONTHLY_LIMIT) * 100));
  const golfRatio = golfLbUsedMonth / GOLF_LB_MONTHLY_LIMIT;
  const golfBar = golfRatio >= 0.8 ? "bg-destructive" : golfRatio >= 0.5 ? "bg-warning" : "bg-success";
  const golfText = golfRatio >= 0.8 ? "text-destructive" : golfRatio >= 0.5 ? "text-warning" : "text-success";
  const golfResetLabel = nextMonthResetLabel();

  const exhaustedKeys = (["primary", "secondary"] as const).flatMap((name) => {
    const s = oddsApiStatus.keys[name];
    if (s && s.code === "OUT_OF_USAGE_CREDITS") return [{ name, ...s }];
    return [];
  });
  const rateLimitedKeys = (["primary", "secondary"] as const).flatMap((name) => {
    const s = oddsApiStatus.keys[name];
    if (s && s.code === "RATE_LIMITED") return [{ name, ...s }];
    return [];
  });
  const otherKeyErrors = (["primary", "secondary"] as const).flatMap((name) => {
    const s = oddsApiStatus.keys[name];
    if (s && s.code !== "OUT_OF_USAGE_CREDITS" && s.code !== "RATE_LIMITED") return [{ name, ...s }];
    return [];
  });

  return (
    <div className="space-y-3">
    {rateLimitedKeys.length > 0 && (
      <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-[12px] font-bold uppercase tracking-wide">
            Odds API rate limit — transient
          </span>
        </div>
        {rateLimitedKeys.map((k) => (
          <div key={k.name} className="text-[11px] text-warning/90">
            <span className="font-semibold uppercase">{k.name} key</span>: HTTP 429 EXCEEDED_FREQ_LIMIT
            {k.message ? ` — ${k.message}` : ""}
          </div>
        ))}
        {oddsApiStatus.rateLimitedSports.length > 0 && (
          <div className="text-[11px] text-warning/80">
            Sports affected this scan:{" "}
            <span className="font-mono">{oddsApiStatus.rateLimitedSports.join(", ")}</span>
          </div>
        )}
        <div className="text-[10px] text-warning/70">
          Requests were too frequent. Throttling + backoff is applied automatically — the next refresh should recover. This is separate from monthly quota exhaustion.
        </div>
      </div>
    )}
    {(exhaustedKeys.length > 0 || otherKeyErrors.length > 0) && (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-[12px] font-bold uppercase tracking-wide">
            Odds API quota exhausted
          </span>
        </div>
        {exhaustedKeys.map((k) => (
          <div key={k.name} className="text-[11px] text-destructive/90">
            <span className="font-semibold uppercase">{k.name} key</span>: quota exhausted
            (HTTP {k.status} · {k.code}) — {k.message || "OUT_OF_USAGE_CREDITS"}
          </div>
        ))}
        {otherKeyErrors.map((k) => (
          <div key={k.name} className="text-[11px] text-destructive/90">
            <span className="font-semibold uppercase">{k.name} key</span>: HTTP {k.status} · {k.code} — {k.message}
          </div>
        ))}
        {oddsApiStatus.quotaExhaustedSports.length > 0 && (
          <div className="text-[11px] text-destructive/80">
            Sports affected this scan:{" "}
            <span className="font-mono">{oddsApiStatus.quotaExhaustedSports.join(", ")}</span>
          </div>
        )}
        <div className="text-[10px] text-destructive/70">
          Users see "Vegas odds temporarily unavailable" on affected games until a working key returns lines.
        </div>
      </div>
    )}
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
    <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Golf Leaderboard Data API · PGA + European Tour · Free plan (250/mo)
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {golfLbUsedMonth.toLocaleString()} / {GOLF_LB_MONTHLY_LIMIT.toLocaleString()} this month
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
          <div className={cn("h-full transition-all", golfBar)} style={{ width: `${golfPct}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {golfLbRemaining !== null
            ? <>API remaining: <span className="text-foreground font-semibold">{golfLbRemaining.toLocaleString()}</span> · Resets {golfResetLabel}</>
            : <>Remaining updates after first refresh · Resets {golfResetLabel}</>}
        </div>
      </div>
      <div className="text-right space-y-0.5">
        <div className={cn("text-sm font-bold", golfText)}>{golfPct}% used</div>
        <div className="text-[11px] text-muted-foreground">30-min cache</div>
      </div>
    </div>
    </div>
  );
}
