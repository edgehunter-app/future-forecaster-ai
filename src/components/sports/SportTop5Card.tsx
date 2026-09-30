import { Flame } from "lucide-react";
import type { FullGame } from "@/lib/oddsApi";
import { useSportTop5, isWeekSport } from "@/hooks/useSportTop5";

function fmtOdds(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n === 0) return "N/A";
  return n > 0 ? `+${n}` : `${n}`;
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

function updatedLabel(d: Date) {
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return d.getHours() < 12 ? `Updated this morning, ${time}` : `Updated today, ${time}`;
  return `Updated ${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

export default function SportTop5Card({ sportKey, sportLabel, games, golfTournamentName: _g }: Props) {
  const t = useSportTop5(sportKey, games);
  const isGolf = sportKey === "golf";
  const when = isWeekSport(sportKey) ? "this week's" : "today's";
  const whenTitle = isWeekSport(sportKey) ? "This Week" : "Today";

  let body: React.ReactNode;
  if (!t.hasResult && t.hasGamesToday) {
    body = (
      <div className="py-3 text-xs text-muted-foreground">
        {t.isScheduled
          ? `${sportLabel} Top 5 is posted each morning around 7 AM ET${isWeekSport(sportKey) ? " on game days" : ""}.`
          : `Top 5 isn't available for ${sportLabel} yet.`}
      </div>
    );
  } else if (!t.hasResult && !t.hasGamesToday) {
    body = isGolf
      ? <div className="py-3 text-xs text-muted-foreground">No golf odds available right now. Golf major odds return ahead of the Masters in April.</div>
      : <div className="py-3 text-xs text-muted-foreground">No {sportLabel} games {whenTitle === "Today" ? "today" : "this week"}.</div>;
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
    body = <div className="py-3 text-xs text-muted-foreground">No bets with a real edge in {when} {sportLabel} games.</div>;
  }

  return (
    <section className="rounded-xl border-2 border-warning/40 bg-gradient-to-br from-warning/10 via-card to-purple/5 p-4 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-foreground">
          <Flame className="h-4 w-4 text-warning" /> Top 5 {sportLabel} Bets {whenTitle}
        </h2>
        {t.lastScannedAt && (
          <span className="text-[11px] text-muted-foreground">{updatedLabel(t.lastScannedAt)}</span>
        )}
      </div>
      {body}
      <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">For live updates on a specific game, use Find the Edge.</p>
    </section>
  );
}
