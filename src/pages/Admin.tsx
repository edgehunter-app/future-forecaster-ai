import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Loader2, Activity, Database, Brain, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { loadKeyUsage, getUsageSummary, type KeyManager } from "@/lib/oddsApiKeyManager";
import { getDailyCount, DAILY_CAP } from "@/lib/oddsDailyCap";
import { getAnalysisCounts } from "@/lib/analysisCounter";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const CLAUDE_COST_PER_RUN = 0.003;
const REFRESH_OPTIONS = [5, 10, 15, 30];
const RAPID_DAILY_LIMIT = 150;

type PillState = "ok" | "warn" | "error";
function StatusPill({ label, state, text }: { label: string; state: PillState; text: string }) {
  const cls =
    state === "ok"
      ? "border-success/40 bg-success/10 text-success"
      : state === "warn"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <div className={cn("flex items-center justify-between rounded-md border px-3 py-2", cls)}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[11px] font-mono uppercase">{text}</span>
    </div>
  );
}

function StatBlock({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function Admin() {
  usePageTitle("Admin");
  const { isAdmin, loading } = useIsAdmin();

  const [usage, setUsage] = useState<KeyManager | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const [analysisCounts, setAnalysisCounts] = useState({ market: 0, sports: 0, total: 0 });
  const [rapidUsedToday, setRapidUsedToday] = useState<number>(0);
  const refreshInterval = useAppStore((s) => s.settings.sportsRefreshMinutes ?? 10);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [stats, setStats] = useState({
    totalUsers: 0,
    walletUsers: 0,
    totalSuggestions: 0,
    suggestionsToday: 0,
    suggestionsMonth: 0,
  });
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setUsage(loadKeyUsage());
    setDailyCount(getDailyCount());
    setAnalysisCounts(getAnalysisCounts());
    const loadRapid = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("api_usage")
        .select("request_count")
        .eq("provider", "rapidapi-sportsbook")
        .eq("used_at", today)
        .maybeSingle();
      setRapidUsedToday(data?.request_count ?? 0);
    };
    void loadRapid();
    const id = setInterval(() => {
      setDailyCount(getDailyCount());
      setAnalysisCounts(getAnalysisCounts());
      void loadRapid();
    }, 5000);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    void Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tracked_wallets").select("user_id"),
      supabase.from("suggestions").select("*", { count: "exact", head: true }),
      supabase.from("suggestions").select("*", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
      supabase.from("suggestions").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth.toISOString()),
    ]).then(([profiles, wallets, sugAll, sugDay, sugMonth]) => {
      const uniqueWalletUsers = new Set((wallets.data ?? []).map((w: any) => w.user_id)).size;
      setStats({
        totalUsers: profiles.count ?? 0,
        walletUsers: uniqueWalletUsers,
        totalSuggestions: sugAll.count ?? 0,
        suggestionsToday: sugDay.count ?? 0,
        suggestionsMonth: sugMonth.count ?? 0,
      });
    });
    return () => clearInterval(id);
  }, [isAdmin]);

  if (loading) return <PageLoadingSkeleton />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const summary = usage ? getUsageSummary(usage) : null;
  const oddsState: PillState =
    !summary || summary.totalRemaining === 0 ? "error" : summary.totalRemaining < 100 ? "warn" : "ok";

  const handleGrant = async () => {
    const email = grantEmail.trim();
    if (!email) return;
    setGranting(true);
    try {
      const { data, error } = await supabase.rpc("grant_admin_by_email", { _email: email });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (result?.ok) {
        toast.success("Admin access granted");
        setGrantEmail("");
      } else {
        toast.error(result?.error ?? "User not found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant admin");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-warning" />
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Admin</h1>
      </div>

      {/* 1. API Usage */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Sports Data APIs</h2>
        </div>

        {/* Sportsbook API (RapidAPI) — active provider */}
        <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Sportsbook API (RapidAPI)</span>
            <span className="font-mono text-xs text-foreground">
              {rapidUsedToday} / {RAPID_DAILY_LIMIT} requests today
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-all",
                rapidUsedToday / RAPID_DAILY_LIMIT >= 0.85
                  ? "bg-destructive"
                  : rapidUsedToday / RAPID_DAILY_LIMIT >= 0.6
                    ? "bg-warning"
                    : "bg-success",
              )}
              style={{ width: `${Math.min((rapidUsedToday / RAPID_DAILY_LIMIT) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Active provider · powers sports board and cross-market gaps</span>
            <span>Resets at 00:00 UTC</span>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border/60 mt-2">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Refresh interval</label>
            <div className="flex gap-1">
              {REFRESH_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => updateSettings({ sportsRefreshMinutes: m })}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors",
                    refreshInterval === m
                      ? "border-info/50 bg-info/15 text-info"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto">
              ~{Math.floor((24 * 60) / refreshInterval)} calls/day max
            </span>
          </div>
        </div>

        {/* Legacy The Odds API — exhausted */}
        <div className="rounded-md border border-border bg-background/20 p-3 space-y-2 opacity-60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">The Odds API (legacy)</span>
            <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-destructive/15 text-destructive border border-destructive/30">
              Exhausted — resets June 1
            </span>
          </div>

        {/* Hard daily cap (client-side) */}
        <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Daily request cap</span>
            <span className="font-mono text-xs text-foreground">
              Today: {dailyCount} / {DAILY_CAP} requests used
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full transition-all",
                dailyCount >= DAILY_CAP
                  ? "bg-destructive"
                  : dailyCount >= Math.ceil(DAILY_CAP * 0.7)
                    ? "bg-warning"
                    : "bg-success",
              )}
              style={{ width: `${Math.min((dailyCount / DAILY_CAP) * 100, 100)}%` }}
            />
          </div>
          {dailyCount >= DAILY_CAP && (
            <div className="text-[11px] text-destructive">
              Daily cap reached — further Odds API calls are blocked until tomorrow.
            </div>
          )}
        </div>
        {usage && summary ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(["primary", "secondary"] as const).map((k) => {
                const key = usage[k];
                return (
                  <div key={k} className="rounded-md border border-border bg-background/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold capitalize text-foreground">{k} key</span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase rounded-full px-2 py-0.5",
                          key.exhausted
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-success/15 text-success border border-success/30",
                        )}
                      >
                        {key.exhausted ? "Exhausted" : "Active"}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-foreground">
                      {key.requestsUsed} / 500 used
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {key.requestsRemaining} remaining
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBlock label="Total remaining" value={summary.totalRemaining} hint={`of ${summary.totalLimit}`} />
              <StatBlock label="Days until reset" value={summary.daysLeft} />
              <StatBlock
                label="Projected daily use"
                value={summary.projectedDailyUse}
                hint={summary.willLastUntilReset ? "On track" : "At risk"}
              />
              <StatBlock label="Reset date" value={summary.resetDate} />
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Loading usage…</div>
        )}
        </div>
      </section>

      {/* 2. Claude AI Cost */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">AI Cost Tracking</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Runs today" value={stats.suggestionsToday} />
          <StatBlock label="Runs this month" value={stats.suggestionsMonth} />
          <StatBlock
            label="Est. cost today"
            value={`$${(stats.suggestionsToday * CLAUDE_COST_PER_RUN).toFixed(3)}`}
          />
          <StatBlock
            label="Est. cost this month"
            value={`$${(stats.suggestionsMonth * CLAUDE_COST_PER_RUN).toFixed(3)}`}
            hint={`@ $${CLAUDE_COST_PER_RUN.toFixed(3)} per run`}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Market analyses" value={analysisCounts.market} />
          <StatBlock label="Sports analyses" value={analysisCounts.sports} />
          <StatBlock label="Total analyses" value={analysisCounts.total} />
          <StatBlock
            label="Estimated cost"
            value={`$${(analysisCounts.total * CLAUDE_COST_PER_RUN).toFixed(3)}`}
            hint="lifetime, this device"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Cost estimated from suggestions generated. For exact billing, check the AI provider dashboard.
        </p>
      </section>

      {/* 3. User Stats */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-info" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">User Stats</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBlock label="Registered users" value={stats.totalUsers} />
          <StatBlock label="Users tracking wallets" value={stats.walletUsers} />
          <StatBlock label="Total suggestions" value={stats.totalSuggestions} />
        </div>
      </section>

      {/* 4. System Status */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-success" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">System Status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <StatusPill label="Polymarket API" state="ok" text="Connected" />
          <StatusPill label="Kalshi API" state="ok" text="Connected" />
          <StatusPill label="Claude AI" state="ok" text="Connected" />
          <StatusPill
            label="Odds API"
            state={oddsState}
            text={oddsState === "error" ? "Exhausted" : "Connected"}
          />
          <StatusPill label="Lovable Cloud" state="ok" text="Connected" />
        </div>
      </section>

      {/* 5. Grant admin */}
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Grant Admin Access</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Promotes the user with this email to <span className="font-mono text-warning">admin</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="partner@example.com"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-warning focus:outline-none"
          />
          <button
            onClick={handleGrant}
            disabled={granting || !grantEmail.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
          >
            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Grant Admin Access
          </button>
        </div>
      </section>
    </div>
  );
}