import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, AlertTriangle, Clock, MapPin, Loader2, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// deno-lint-ignore no-explicit-any
type Any = any;
type Rating = "GREEN" | "YELLOW" | "RED";

interface Runner {
  number: number;
  name: string;
  age?: number;
  sex?: string;
  weight?: number;
  barrier?: number;
  form?: string;
  last20Starts?: string;
  careerPrizeMoney?: string;
  scratched?: boolean;
  decorators?: Array<{ label?: string; shortLabel?: string; sentiment?: string }>;
  stats?: { overall?: { starts?: number; wins?: number; seconds?: number; thirds?: number } };
}

interface RaceData {
  raceNumber: number;
  raceName?: string;
  distance?: string;
  condition?: string;
  weather?: string;
  startTime?: string;
  timezone?: string;
  numberOfRunners?: number;
  runners: Runner[];
}

interface Meeting {
  track: string;
  trackName: string;
  date: string;
  raceCount: number;
  races: Array<{ race: number; data: RaceData }>;
}

interface FetchResponse {
  date: string;
  meetings: Meeting[];
  meetingCount: number;
}

interface RaceAnalysis {
  track?: string;
  race?: number | string;
  startTime?: string;
  trafficLight: Rating;
  trafficLightReason?: string;
  topPick?: {
    horse?: string;
    number?: number;
    weight?: number | string;
    barrier?: number | string;
    classRating?: number | string;
    classTrend?: string;
    runningStyle?: string;
    decorators?: string[];
    confidence?: number;
    reasoning?: string;
  };
  valuePlay?: { horse?: string; number?: number; reason?: string };
  paceScenario?: string;
  raceSummary?: string;
  keyFactors?: string[];
  warningFlags?: string[];
  exoticSuggestion?: string;
}

interface RaceCardData {
  id: string;
  trackSlug: string;
  trackName: string;
  race: RaceData;
  meetingDate: string;
}

const RATING_STYLES: Record<Rating, { dot: string; chip: string; ring: string }> = {
  GREEN: {
    dot: "bg-success shadow-[0_0_12px_hsl(var(--success))]",
    chip: "bg-success/15 text-success border-success/30",
    ring: "border-success/40",
  },
  YELLOW: {
    dot: "bg-warning shadow-[0_0_12px_hsl(var(--warning))]",
    chip: "bg-warning/15 text-warning border-warning/30",
    ring: "border-warning/40",
  },
  RED: {
    dot: "bg-destructive shadow-[0_0_12px_hsl(var(--destructive))]",
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    ring: "border-destructive/40",
  },
};

function TrafficLight({ rating }: { rating: Rating }) {
  const dot = RATING_STYLES[rating].dot;
  return <span className={cn("inline-block h-5 w-5 rounded-full ring-2 ring-background", dot)} aria-label={`${rating} rating`} />;
}

function formatDistance(d?: string | number): string {
  if (d == null || d === "") return "";
  const raw = String(d);
  const m = /(\d+(?:\.\d+)?)\s*m/i.exec(raw);
  const meters = m ? parseFloat(m[1]) : Number.isFinite(+raw) ? +raw : NaN;
  if (!Number.isFinite(meters)) return raw;
  const map: Array<[number, string]> = [
    [1000, "5 Furlongs"],
    [1100, "5.5 Furlongs"],
    [1207, "6 Furlongs"],
    [1300, "6.5 Furlongs"],
    [1400, "7 Furlongs"],
    [1500, "7.5 Furlongs"],
    [1609, "1 Mile"],
    [1670, "1 1/16 Miles"],
    [1700, "1 1/16 Miles"],
    [1800, "1 1/8 Miles"],
    [1900, "1 3/16 Miles"],
    [2000, "1 1/4 Miles"],
    [2200, "1 3/8 Miles"],
    [2400, "1 1/2 Miles"],
    [2600, "1 5/8 Miles"],
    [2800, "1 3/4 Miles"],
  ];
  let best = map[0];
  let bestDiff = Infinity;
  for (const entry of map) {
    const diff = Math.abs(entry[0] - meters);
    if (diff < bestDiff) { bestDiff = diff; best = entry; }
  }
  return bestDiff <= 60 ? best[1] : `${Math.round(meters)}m`;
}

function todayLocalISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function formatPostTime(iso?: string, tz?: string): string {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function formatRaceDate(iso?: string, tz?: string, fallback?: string): string {
  const src = iso ?? (fallback ? `${fallback}T12:00:00Z` : undefined);
  if (!src) return "";
  try {
    const d = new Date(src);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz || undefined,
    });
  } catch {
    return fallback ?? "";
  }
}

function formatHeaderDate(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function surfaceFromCondition(condition?: string): string {
  if (!condition) return "";
  const c = condition.toLowerCase();
  if (c.includes("synthetic") || c.includes("tapeta") || c.includes("polytrack")) return "Synthetic";
  if (["firm", "yielding", "soft", "heavy"].some((t) => c.includes(t))) return "Turf";
  if (["fast", "sloppy", "muddy", "wet", "good"].some((t) => c.includes(t))) return "Dirt";
  return "";
}

type AnalysisState = { status: "pending" | "loading" | "done" | "error"; data?: RaceAnalysis; error?: string };

function AnalysisPanel({ a }: { a: RaceAnalysis }) {
  const style = RATING_STYLES[a.trafficLight] ?? RATING_STYLES.YELLOW;
  const clean = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^(unknown|n\/a|na|null|undefined|\?|-)$/i.test(s)) return null;
    return s;
  };
  const trendArrow = (t?: string) => {
    const s = (t ?? "").toUpperCase();
    if (s.includes("IMPROV") || s.includes("RIS")) return "↑";
    if (s.includes("DECLIN") || s.includes("FALL")) return "↓";
    return "→";
  };
  return (
    <section className={cn("mt-4 rounded-xl border p-3", style.ring, "bg-info/5")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-info">
          <Sparkles className="h-3.5 w-3.5" />
          FormFav-Powered Edge Analysis
        </div>
        <div className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold", style.chip)}>
          <TrafficLight rating={a.trafficLight} />
          <span>{a.trafficLight}</span>
        </div>
      </div>
      {a.trafficLightReason && (
        <p className="mt-1.5 text-xs text-muted-foreground">{a.trafficLightReason}</p>
      )}
      {a.topPick && (
        <div className="mt-3 rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Top Pick</div>
              <div className="text-base font-semibold text-foreground">
                {a.topPick.number != null && <span className="text-muted-foreground">#{a.topPick.number} </span>}
                {clean(a.topPick.horse) ?? "—"}
                {a.topPick.barrier != null && <span className="ml-1 text-xs text-muted-foreground">(Bar {a.topPick.barrier})</span>}
              </div>
            </div>
            {a.topPick.confidence != null && (
              <div className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
                {a.topPick.confidence}% conf
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {clean(a.topPick.classRating) && (
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                Class {a.topPick.classRating} {trendArrow(a.topPick.classTrend)}
              </span>
            )}
            {clean(a.topPick.runningStyle) && (
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                {a.topPick.runningStyle}
              </span>
            )}
            {clean(a.topPick.weight) && (
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                {a.topPick.weight}
              </span>
            )}
            {(a.topPick.decorators ?? []).map((d, i) => (
              <span key={i} className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success">{d}</span>
            ))}
          </div>
          {a.topPick.reasoning && <p className="mt-2 text-sm text-foreground/90">{a.topPick.reasoning}</p>}
        </div>
      )}
      {a.valuePlay?.horse && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="text-[11px] uppercase tracking-wide text-warning">Value Play</div>
          <div className="text-sm font-semibold text-foreground">
            {a.valuePlay.number != null && <span className="text-muted-foreground">#{a.valuePlay.number} </span>}
            {clean(a.valuePlay.horse) ?? "—"}
          </div>
          {a.valuePlay.reason && <p className="mt-1 text-xs text-foreground/80">{a.valuePlay.reason}</p>}
        </div>
      )}
      {a.paceScenario && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pace Scenario</div>
          <p className="mt-0.5 text-xs text-foreground/90">{a.paceScenario}</p>
        </div>
      )}
      {a.raceSummary && <p className="mt-3 text-sm text-foreground/90">{a.raceSummary}</p>}
      {a.exoticSuggestion && (
        <div className="mt-2 text-xs">
          <span className="font-semibold text-foreground">Exotic: </span>
          <span className="text-muted-foreground">{a.exoticSuggestion}</span>
        </div>
      )}
      {a.keyFactors && a.keyFactors.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {a.keyFactors.map((f, i) => (
            <li key={i} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{f}</li>
          ))}
        </ul>
      )}
      {a.warningFlags && a.warningFlags.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-destructive">
          {a.warningFlags.map((w, i) => (
            <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span>{w}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RaceCard({ card, state, onAnalyze }: { card: RaceCardData; state: AnalysisState; onAnalyze: () => void }) {
  const { race, trackName } = card;
  const analysis = state.data ?? null;
  const loading = state.status === "loading";
  const error = state.status === "error" ? state.error ?? "error" : null;
  const style = analysis ? (RATING_STYLES[analysis.trafficLight] ?? RATING_STYLES.YELLOW) : RATING_STYLES.YELLOW;
  const liveRunners = race.runners.filter((r) => r.scratched !== true);
  const scratches = race.runners.filter((r) => r.scratched === true);
  if (trackName?.toLowerCase().includes("delta")) {
    console.log("[horse-racing][delta] race", race.raceNumber, "total=", race.runners.length,
      "live=", liveRunners.length, "scratched=", scratches.length,
      "names=", race.runners.map((r) => `${r.name}(${r.scratched})`));
  }
  const surface = surfaceFromCondition(race.condition);

  return (
    <article className={cn("rounded-2xl border bg-card p-4 sm:p-5", analysis ? style.ring : "border-border")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{trackName}</span>
            <span>·</span>
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatRaceDate(race.startTime, race.timezone, card.meetingDate)} · {formatPostTime(race.startTime, race.timezone)}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Race {race.raceNumber} · {formatDistance(race.distance)} {surface}
          </h3>
          <p className="text-xs text-muted-foreground">
            {race.raceName ?? "Race"} · {race.condition ?? "?"} · {liveRunners.length} runners
          </p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-semibold text-info hover:bg-info/15 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze This Race"}
        </button>
      </header>

      {analysis && <AnalysisPanel a={analysis} />}

      {error && !analysis && (
        <p className="mt-3 text-xs text-destructive">Analysis unavailable: {error}</p>
      )}

      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Full field · {liveRunners.length} runners
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Horse</th>
                <th className="px-3 py-2 text-left">Age/Sex</th>
                <th className="px-3 py-2 text-left">Barrier</th>
                <th className="px-3 py-2 text-left">Form</th>
                <th className="px-3 py-2 text-right">Wt</th>
              </tr>
            </thead>
            <tbody>
              {race.runners.map((r) => (
                <tr
                  key={r.number}
                  className={cn(
                    "border-t border-border",
                    r.scratched && "text-muted-foreground line-through opacity-60",
                  )}
                >
                  <td className="px-3 py-2 font-mono">{r.number}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                  <td className="px-3 py-2">{r.age}{r.sex ? ` ${r.sex}` : ""}</td>
                  <td className="px-3 py-2">{r.barrier ?? "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.form ?? r.last20Starts ?? "-"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.weight ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


      {scratches.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Scratches: {scratches.map((s) => `#${s.number} ${s.name}`).join(", ")}
        </div>
      )}
    </article>
  );
}

function parseAnalysis(raw: Any): RaceAnalysis | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw.trafficLight) return raw as RaceAnalysis;
  if (typeof raw?.raw === "string") {
    const m = raw.raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  }
  return null;
}

function BestRaceTodayPanel({ date }: { date: string }) {
  const [state, setState] = useState<AnalysisState>({ status: "pending" });

  const run = async () => {
    setState({ status: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("analyze-market", {
        body: { type: "horse-racing", date },
      });
      if (error) { setState({ status: "error", error: error.message }); return; }
      const parsed = parseAnalysis(data);
      if (parsed) setState({ status: "done", data: parsed });
      else setState({ status: "error", error: (data as Any)?.error ?? "no analysis" });
    } catch (e) {
      setState({ status: "error", error: (e as Error).message });
    }
  };

  const loading = state.status === "loading";
  const a = state.data;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-600/20 via-fuchsia-500/10 to-card p-5">
      <div className="absolute right-4 top-4 opacity-20">
        <Trophy className="h-20 w-20 text-purple-400" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-300">Best Race Today</div>
          <h2 className="mt-1 text-xl font-bold text-foreground">FormFav + Claude Race Finder</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Claude scans today's US meetings via FormFav MCP and returns the most bettable race.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading ? "Scanning…" : a ? "Re-scan" : "🏇 Find Best Race Today"}
        </button>
      </div>
      {state.status === "error" && (
        <p className="mt-3 text-xs text-destructive">Scan failed: {state.error}</p>
      )}
      {a && (
        <div className="mt-4 rounded-xl border border-border bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {a.track ?? "Track"} · Race {a.race ?? "?"}
              </div>
              <div className="text-base font-semibold text-foreground">
                {a.startTime ? new Date(a.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Race"}
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              (RATING_STYLES[a.trafficLight] ?? RATING_STYLES.YELLOW).chip,
            )}>
              <TrafficLight rating={a.trafficLight} />
              <span>{a.trafficLight}</span>
            </div>
          </div>
          <AnalysisPanel a={a} />
        </div>
      )}
    </section>
  );
}

function HorseRacingBody({ cards }: { cards: RaceCardData[] }) {
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});

  const analyze = async (card: RaceCardData) => {
    setAnalyses((prev) => ({ ...prev, [card.id]: { status: "loading" } }));
    try {
      const { data, error } = await supabase.functions.invoke("analyze-market", {
        body: {
          type: "horse-racing",
          track: card.trackSlug,
          race: card.race.raceNumber,
          date: card.meetingDate,
        },
      });
      if (error) {
        setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: error.message } }));
        return;
      }
      const parsed = parseAnalysis(data);
      if (parsed) setAnalyses((prev) => ({ ...prev, [card.id]: { status: "done", data: parsed } }));
      else setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: (data as Any)?.error ?? "no analysis" } }));
    } catch (e) {
      setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: (e as Error).message } }));
    }
  };

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <RaceCard
          key={card.id}
          card={card}
          state={analyses[card.id] ?? { status: "pending" }}
          onAnalyze={() => analyze(card)}
        />
      ))}
    </div>
  );
}

export default function HorseRacing() {
  const [data, setData] = useState<FetchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const today = todayLocalISO();
    const tomorrow = (() => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split("T")[0];
    })();
    console.log("[horse-racing] requesting date:", today);
    try {
      const first = await supabase.functions.invoke("fetch-horse-racing", { body: { date: today } });
      if (first.error) { setError(first.error.message); setLoading(false); return; }
      let resp = first.data as FetchResponse;
      console.log("[horse-racing] hook received:", resp);
      console.log("[horse-racing] meetings:", resp?.meetings?.length, "meetingCount:", resp?.meetingCount);
      if (!resp || resp.meetingCount === 0) {
        console.log("[horse-racing] today empty, trying tomorrow:", tomorrow);
        const second = await supabase.functions.invoke("fetch-horse-racing", { body: { date: tomorrow } });
        if (!second.error && second.data) resp = second.data as FetchResponse;
      }
      setData({ ...resp, date: resp.date ?? today });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cards: RaceCardData[] = useMemo(() => {
    if (!data) return [];
    const out: RaceCardData[] = [];
    for (const m of data.meetings) {
      for (const { race, data: rd } of m.races) {
        const liveRunners = (rd.runners ?? []).filter((r) => r.scratched !== true);
        if (liveRunners.length < 1) continue;
        out.push({
          id: `${m.track}-r${rd.raceNumber ?? race}`,
          trackSlug: m.track,
          trackName: m.trackName,
          race: rd,
          meetingDate: m.date,
        });
      }
    }
    console.log("[horse-racing] cards built:", out.length, "from", data.meetings.length, "meetings");
    return out;
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-24 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/15 text-info text-2xl">
            <span aria-hidden>🐎</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Horse Racing</h1>
            <p className="text-sm text-muted-foreground">
              AI-graded race cards from major North American tracks
            </p>
            {data?.date && (
              <p className="mt-0.5 text-xs font-semibold text-info">
                Card date: {formatHeaderDate(data.date)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </header>

      {loading && !data && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">Loading today's cards…</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load: {error}
        </div>
      )}

      <BestRaceTodayPanel date={data?.date ?? todayLocalISO()} />

      {!loading && cards.length === 0 && !error && (
        <div className="space-y-4">
          <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center">
            <div className="text-[64px] leading-none" aria-hidden>🐎</div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">No races posted yet for today</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Race cards are typically posted 2–3 hours before first post.
            </p>
            {lastChecked && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last checked {lastChecked.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/10 px-4 py-2 text-sm font-semibold text-info hover:bg-info/15 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Check again
            </button>
          </section>

          <section className="rounded-2xl border border-info/30 bg-info/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-info">
              <span aria-hidden>🏇</span> Saratoga — Card posts day-of
            </div>
            <p className="mt-1 text-foreground/90">
              Saratoga's full card typically becomes available 2–3 hours before first post. Check back closer to race time.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span aria-hidden>📋</span> Coverage Note
            </div>
            <p className="mt-1 text-muted-foreground">
              Some tracks — including <span className="font-medium text-foreground">Del Mar</span> — aren't
              currently available in our data feed. We're working to add more track coverage.
            </p>
            <p className="mt-2 text-muted-foreground">
              Currently showing: Saratoga, Churchill Downs, Belmont Park, Santa Anita, Gulfstream Park,
              Keeneland, and other major US tracks when cards are available.
            </p>
          </section>
        </div>
      )}

      {cards.length > 0 && <HorseRacingBody cards={cards} />}

      <p className="text-center text-[11px] text-muted-foreground">
        Race data via FormFav. AI analysis powered by Claude via EdgeHunter.
      </p>
    </div>
  );
}