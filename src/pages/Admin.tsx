import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Loader2, Activity, Database, Brain, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { loadKeyUsage, getUsageSummary, type KeyManager } from "@/lib/oddsApiKeyManager";
import { cn } from "@/lib/utils";

const CLAUDE_COST_PER_RUN = 0.003;

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
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Odds API Usage</h2>
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