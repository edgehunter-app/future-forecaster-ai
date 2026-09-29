import { Flame, Loader2, Search } from "lucide-react";
import type { FullGame } from "@/lib/oddsApi";
import { useSportTop5 } from "@/hooks/useSportTop5";

function fmtOdds(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n === 0) return "N/A";
  return n > 0 ? `+${n}` : `${n}`;
}
function ago(d: Date) {
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface Props {
  sportKey: string;
  sportLabel: string;
  games: FullGame[];
  golfTournamentName?: string;
}

export default function SportTop5Card({ sportKey, sportLabel, games, golfTournamentName }: Props) {
  const t = useSportTop5(sportKey, games, golfTournamentName);
  const isGolf = sportKey === "golf";

  let body: React.ReactNode;
  if (t.loading) {
    body = (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Scoring today's {sportLabel} games… {t.progress.total ? `${t.progress.done}/${t.progress.total}` : ""}
      </div>
    );
  } else if (t.error) {
    body = <div className="py-3 text-xs text-destructive">Couldn't build today's Top 5. Try again later.</div>;
  } else if (!t.hasResult && t.hasGamesToday) {
    body = <div className="py-3 text-xs text-muted-foreground">Tap "Scan for Top 5" to score today's {sportLabel} games.</div>;
  } else if (!t.hasResult && !t.hasGamesToday) {
    body = <div className="py-3 text-xs text-muted-foreground">No {sportLabel} games today.</div>;
  } else if (isGolf && t.golf) {
    body = (
      <ol className="divide-y divide-border/60">
        {t.golf.picks.map((p, i) => (
          <li key={p.player} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/20 text-xs font-extrabold text-warning">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-foreground">{p.player}</span>
                <span className="shrink-0 font-mono text-sm font-bold text-foreground">{fmtOdds(p.odds)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                To win{p.book ? ` · ${p.book}` : ""}{p.reason ? ` · ${p.reason}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
    );
  } else if (!isGolf && t.entries.length > 0) {
    body = (
      <ol className="divide-y divide-border/60">
        {t.entries.map((e, i) => {
          const a = e.analysis;
          const line =
            a.betType === "spread" && a.spreadLine != null
              ? ` ${a.spreadLine > 0 ? "+" : ""}${a.spreadLine}`
              : a.betType === "total" && e.game.total?.line
                ? ` ${e.game.total.line}`
                : "";
          const pick = a.betType === "total" ? `${a.recommendation === "UNDER" ? "Under" : "Over"}${line}` : `${a.recommendedTeam}${line}`;
          return (
            <li key={`${e.game.id}-${i}`} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/20 text-xs font-extrabold text-warning">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{pick}</span>
                  <span className="shrink-0 font-mono text-sm font-bold text-foreground">{fmtOdds(a.odds)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {e.game.awayTeam} @ {e.game.homeTeam} · {fmtTime(e.game.commenceTime)} · {a.betType}
                  {a.bestBook ? ` · ${a.bestBook}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-bold text-info">{e.confidence}%</div>
                <div className="text-[10px] text-success">{e.edge >= 0 ? "+" : ""}{(e.edge * 100).toFixed(1)}% edge</div>
              </div>
            </li>
          );
        })}
      </ol>
    );
  } else {
    body = <div className="py-3 text-xs text-muted-foreground">No bets with a real edge in today's {sportLabel} games.</div>;
  }

  return (
    <section className="rounded-xl border-2 border-warning/40 bg-gradient-to-br from-warning/10 via-card to-purple/5 p-4 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-foreground">
          <Flame className="h-4 w-4 text-warning" /> Top 5 {sportLabel} Bets Today
        </h2>
        <div className="flex items-center gap-2">
          {t.lastScannedAt && (
            <span className="text-[11px] text-muted-foreground">Last scanned: {ago(t.lastScannedAt)}</span>
          )}
          <button
            onClick={t.scan}
            disabled={t.loading || !t.hasGamesToday}
            className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning hover:bg-warning/25 disabled:opacity-50"
          >
            {t.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Scan for Top 5
          </button>
        </div>
      </div>
      {body}
    </section>
  );
}
