import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Loader2, Activity, Database, Brain, Trophy, Users, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getAnalysisCounts } from "@/lib/analysisCounter";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
const CLAUDE_COST_PER_RUN = 0.003;
// 0 = Manual refresh only (no setInterval). Other values are minutes.
const REFRESH_OPTIONS = [0, 15, 30, 60, 120];
const RAPID_DAILY_LIMIT = 1000;   // Pro tier hard limit
const RAPID_RATE_LIMIT = 60;      // requests / minute

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

  const [analysisCounts, setAnalysisCounts] = useState({ market: 0, sports: 0, total: 0 });
  const [rapidUsedToday, setRapidUsedToday] = useState<number>(0);
  const [lastCallAt, setLastCallAt] = useState<string | null>(null);
  const refreshInterval = useAppStore((s) => s.settings.sportsRefreshMinutes ?? 0);
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
  const [research, setResearch] = useState<{
    total_rows: number;
    earliest: string | null;
    latest: string | null;
    unique_events_24h: number;
    unique_sources_24h: number;
    sources_24h: string[];
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
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
    const loadLastCall = async () => {
      const { data } = await supabase
        .from("outcomes_log")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastCallAt(data?.fetched_at ?? null);
    };
    void loadLastCall();
    const loadResearch = async () => {
      const { data, error } = await supabase.rpc("outcomes_log_stats" as any);
      if (!error && data) setResearch(data as any);
    };
    void loadResearch();
    const id = setInterval(() => {
      setAnalysisCounts(getAnalysisCounts());
      void loadRapid();
      void loadResearch();
      void loadLastCall();
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

  // Projected daily total: extrapolate from hours elapsed today (UTC, matches reset).
  const now = new Date();
  const utcHoursElapsed =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const projectedDaily =
    utcHoursElapsed > 0.1 ? Math.round((rapidUsedToday / utcHoursElapsed) * 24) : rapidUsedToday;
  const projColor =
    projectedDaily > RAPID_DAILY_LIMIT
      ? "text-destructive"
      : projectedDaily > 130
        ? "text-warning"
        : "text-success";
  const rapidPct = Math.round((rapidUsedToday / RAPID_DAILY_LIMIT) * 100);

  // Per-refresh cost estimate
  const perRefreshOdds = 0;   // no longer primary
  const perRefreshRapid = 2;  // advantages + 1 competition events

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
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Sports Data: Sportsbook API (RapidAPI)</h2>
        </div>

        {/* Sportsbook API (RapidAPI) — active provider */}
        <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Sportsbook API (RapidAPI · Pro)</span>
            <span className="font-mono text-xs text-foreground">
              {rapidUsedToday} / {RAPID_DAILY_LIMIT} ({rapidPct}%)
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Pro tier · $10/month · {RAPID_DAILY_LIMIT.toLocaleString()} req/day · rate limit {RAPID_RATE_LIMIT}/min
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
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-muted-foreground">
              Last call:{" "}
              <span className="font-mono text-foreground">
                {lastCallAt ? new Date(lastCallAt).toLocaleTimeString() : "—"}
              </span>
            </span>
            <span className={cn("font-mono font-semibold", projColor)}>
              Projected: ~{projectedDaily} / day
            </span>
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
                  {m === 0 ? "Manual" : `${m}m`}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto">
              Manual recommended — auto-scan burns through quota fast
            </span>
          </div>

          {/* Scanning behavior */}
          <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground uppercase text-[9px]">Current mode</div>
              <div className="font-mono text-foreground">
                {refreshInterval === 0 ? "Manual only" : `Auto · every ${refreshInterval}m`}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase text-[9px]">Per refresh cost</div>
              <div className="font-mono text-foreground">
                ~{perRefreshRapid} RapidAPI requests
              </div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase text-[9px]">Daily budget at pace</div>
              <div className={cn("font-mono", projColor)}>
                ~{projectedDaily} / {RAPID_DAILY_LIMIT.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-info/90 leading-snug">
          <span className="font-semibold">Note:</span> Board shows today's games with live odds only.
          Games 2+ days out are excluded until lines post.
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
            label="Sportsbook API"
            state={rapidUsedToday >= RAPID_DAILY_LIMIT ? "error" : rapidUsedToday >= RAPID_DAILY_LIMIT * 0.85 ? "warn" : "ok"}
            text={rapidUsedToday >= RAPID_DAILY_LIMIT ? "Exhausted" : "Connected"}
          />
          <StatusPill label="Lovable Cloud" state="ok" text="Connected" />
        </div>
      </section>

      {/* Research Data */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-purple" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Research Data</h2>
        </div>
        {research ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBlock label="Total outcomes logged" value={research.total_rows.toLocaleString()} />
              <StatBlock
                label="Unique events (24h)"
                value={research.unique_events_24h}
              />
              <StatBlock
                label="Unique sources (24h)"
                value={research.unique_sources_24h}
              />
              <StatBlock
                label="Latest snapshot"
                value={research.latest ? new Date(research.latest).toLocaleString() : "—"}
                hint={research.earliest ? `since ${new Date(research.earliest).toLocaleDateString()}` : undefined}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Sources seen (24h):{" "}
              <span className="font-mono text-foreground">
                {research.sources_24h?.length ? research.sources_24h.join(", ") : "none"}
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Loading research stats…</div>
        )}
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