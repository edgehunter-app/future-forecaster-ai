import { useEffect, useMemo, useState } from "react";
import { LineChart, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PickRow {
  id: string;
  picked_at: string;
  sport_key: string;
  league: string;
  bet_type: string;
  selection: string;
  odds_at_pick: number | null;
  confidence: number | null;
  confidence_tier: string;
  result: string | null;
  payout_flat_100: number | null;
  clv: number | null;
  closing_odds: number | null;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
];
const TIERS = ["all", "high", "medium", "low"];

/** Wilson score interval half-width for a win rate — tells us when the sample is big enough. */
function wilsonHalfWidth(wins: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const halfWidth = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return halfWidth * 100;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-lg font-bold", tone ?? "text-foreground")}>{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function PickPerformancePanel() {
  const [rows, setRows] = useState<PickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [tier, setTier] = useState("all");
  const [sport, setSport] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pick_log")
      .select("id,picked_at,sport_key,league,bet_type,selection,odds_at_pick,confidence,confidence_tier,result,payout_flat_100,clv,closing_odds")
      .order("picked_at", { ascending: false })
      .limit(2000);
    if (error) toast.error(error.message);
    setRows((data ?? []) as PickRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const runBackfill = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-picks", { body: {} });
      if (error) throw error;
      const d = data as { closingCaptured?: number; graded?: number };
      toast.success(`Backfill: ${d?.graded ?? 0} graded · ${d?.closingCaptured ?? 0} closing lines captured`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setRunning(false);
    }
  };

  const sports = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.sport_key).filter(Boolean))).sort()],
    [rows],
  );

  const filtered = useMemo(() => {
    const cutoff = rangeDays > 0 ? Date.now() - rangeDays * 86400_000 : 0;
    return rows.filter((r) => {
      if (cutoff && new Date(r.picked_at).getTime() < cutoff) return false;
      if (tier !== "all" && r.confidence_tier !== tier) return false;
      if (sport !== "all" && r.sport_key !== sport) return false;
      return true;
    });
  }, [rows, rangeDays, tier, sport]);

  const graded = filtered.filter((r) => r.result === "win" || r.result === "loss" || r.result === "push");
  const decided = graded.filter((r) => r.result !== "push");
  const wins = decided.filter((r) => r.result === "win").length;
  const winRate = decided.length ? (wins / decided.length) * 100 : 0;
  const staked = graded.length * 100;
  const profit = graded.reduce((sum, r) => sum + Number(r.payout_flat_100 ?? 0), 0);
  const roi = staked ? (profit / staked) * 100 : 0;
  const clvRows = graded.filter((r) => r.clv !== null && r.clv !== undefined);
  const avgClv = clvRows.length ? clvRows.reduce((s, r) => s + Number(r.clv), 0) / clvRows.length : 0;
  const ciHalf = wilsonHalfWidth(wins, decided.length);
  const pending = filtered.filter((r) => !r.result).length;
  const enough = decided.length >= 100 && ciHalf <= 10;

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-purple" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Pick Performance (internal)</h2>
        </div>
        <button
          onClick={runBackfill}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Run backfill
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono transition-colors",
                rangeDays === r.days ? "border-info/50 bg-info/15 text-info" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md border px-2 py-0.5 capitalize transition-colors",
                tier === t ? "border-purple/50 bg-purple/15 text-purple" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground"
        >
          {sports.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All sports" : s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading picks…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Picks graded" value={String(graded.length)} hint={`${pending} awaiting result`} />
            <Stat
              label="Win rate"
              value={decided.length ? `${winRate.toFixed(1)}%` : "—"}
              hint={`${wins}-${decided.length - wins}${graded.length - decided.length ? ` · ${graded.length - decided.length} push` : ""}`}
              tone={decided.length && winRate >= 52.4 ? "text-success" : "text-foreground"}
            />
            <Stat
              label="ROI (flat $100)"
              value={staked ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
              hint={staked ? `${profit >= 0 ? "+" : ""}$${profit.toFixed(0)} on $${staked.toLocaleString()} staked` : undefined}
              tone={staked ? (roi >= 0 ? "text-success" : "text-destructive") : "text-foreground"}
            />
            <Stat
              label="Avg CLV"
              value={clvRows.length ? `${avgClv >= 0 ? "+" : ""}${avgClv.toFixed(2)} pts` : "—"}
              hint={`${clvRows.length} picks with closing odds`}
              tone={clvRows.length ? (avgClv >= 0 ? "text-success" : "text-destructive") : "text-foreground"}
            />
            <Stat label="Sample size" value={String(decided.length)} hint="decided picks (excl. pushes)" />
            <Stat
              label="95% CI width"
              value={decided.length ? `±${ciHalf.toFixed(1)} pts` : "—"}
              hint={enough ? "sample sufficient for internal read" : "too small for any claim"}
              tone={enough ? "text-success" : "text-warning"}
            />
          </div>

          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] leading-snug text-warning/90">
            Internal tracking only — no public-facing performance claims until the sample is large enough
            (target: 100+ decided picks and a CI width under ±10 points).
          </div>

          {/* Recent picks */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Picked</th>
                  <th className="py-1 pr-2 font-medium">Sport</th>
                  <th className="py-1 pr-2 font-medium">Selection</th>
                  <th className="py-1 pr-2 font-medium">Type</th>
                  <th className="py-1 pr-2 font-medium">Odds</th>
                  <th className="py-1 pr-2 font-medium">Close</th>
                  <th className="py-1 pr-2 font-medium">Conf</th>
                  <th className="py-1 pr-2 font-medium">Result</th>
                  <th className="py-1 pr-2 font-medium">P/L</th>
                  <th className="py-1 font-medium">CLV</th>
                </tr>
              </thead>
              <tbody className="font-mono text-foreground">
                {filtered.slice(0, 25).map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.picked_at).toLocaleDateString()}</td>
                    <td className="py-1 pr-2">{r.league || r.sport_key || "—"}</td>
                    <td className="py-1 pr-2 max-w-[160px] truncate">{r.selection}</td>
                    <td className="py-1 pr-2">{r.bet_type}</td>
                    <td className="py-1 pr-2">{r.odds_at_pick ?? "—"}</td>
                    <td className="py-1 pr-2">{r.closing_odds ?? "—"}</td>
                    <td className="py-1 pr-2">{r.confidence ?? "—"}</td>
                    <td className={cn(
                      "py-1 pr-2 uppercase",
                      r.result === "win" ? "text-success" : r.result === "loss" ? "text-destructive" : "text-muted-foreground",
                    )}>
                      {r.result ?? "pending"}
                    </td>
                    <td className="py-1 pr-2">{r.payout_flat_100 === null || r.payout_flat_100 === undefined ? "—" : `${Number(r.payout_flat_100) >= 0 ? "+" : ""}${Number(r.payout_flat_100).toFixed(0)}`}</td>
                    <td className="py-1">{r.clv === null || r.clv === undefined ? "—" : Number(r.clv).toFixed(2)}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="py-3 text-center text-muted-foreground">No picks logged yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
