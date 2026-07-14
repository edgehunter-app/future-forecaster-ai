import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, AlertTriangle, Clock, MapPin, Loader2, RefreshCw } from "lucide-react";
import HorseIcon from "@/components/icons/HorseIcon";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// deno-lint-ignore no-explicit-any
type Any = any;
type Rating = "green" | "yellow" | "red";

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
  rating: Rating;
  ratingLabel: string;
  topPick: string;
  exacta: string;
  keyAngles?: Array<{ horse: string; angle: string }>;
  analysis: string;
}

interface RaceCardData {
  id: string;
  trackName: string;
  race: RaceData;
  meetingDate: string;
}

const RATING_STYLES: Record<Rating, { dot: string; chip: string; ring: string }> = {
  green: {
    dot: "bg-success shadow-[0_0_12px_hsl(var(--success))]",
    chip: "bg-success/15 text-success border-success/30",
    ring: "border-success/40",
  },
  yellow: {
    dot: "bg-warning shadow-[0_0_12px_hsl(var(--warning))]",
    chip: "bg-warning/15 text-warning border-warning/30",
    ring: "border-warning/40",
  },
  red: {
    dot: "bg-destructive shadow-[0_0_12px_hsl(var(--destructive))]",
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    ring: "border-destructive/40",
  },
};

function TrafficLight({ rating }: { rating: Rating }) {
  const dot = RATING_STYLES[rating].dot;
  return <span className={cn("inline-block h-4 w-4 rounded-full ring-2 ring-background", dot)} aria-label={`${rating} rating`} />;
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

function RaceCard({ card, state }: { card: RaceCardData; state: AnalysisState }) {
  const { race, trackName } = card;
  const analysis = state.data ?? null;
  const loading = state.status === "loading" || state.status === "pending";
  const error = state.status === "error" ? state.error ?? "error" : null;
  const style = analysis ? RATING_STYLES[analysis.rating] : RATING_STYLES.yellow;
  const liveRunners = race.runners.filter((r) => !r.scratched);
  const scratches = race.runners.filter((r) => r.scratched);
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
        {analysis ? (
          <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", style.chip)}>
            <TrafficLight rating={analysis.rating} />
            <span>{analysis.ratingLabel}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>{loading ? "Analyzing…" : error ? "Analysis error" : "Queued"}</span>
          </div>
        )}
      </header>

      {analysis && (
        <section className="mt-4 rounded-xl border border-info/30 bg-info/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-info">
            <Sparkles className="h-3.5 w-3.5" />
            Edge Analysis
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Top Pick</div>
              <div className="text-sm font-semibold text-foreground">{analysis.topPick}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Exacta</div>
              <div className="text-sm font-semibold text-foreground">{analysis.exacta}</div>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{analysis.analysis}</p>
          {analysis.keyAngles && analysis.keyAngles.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-info/20 pt-2 text-xs">
              {analysis.keyAngles.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold text-foreground">{a.horse}:</span>
                  <span className="text-muted-foreground">{a.angle}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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

function BestBetBanner({ cards, analyses }: { cards: RaceCardData[]; analyses: Record<string, AnalysisState> }) {
  const best = useMemo(() => {
    const withA = cards
      .map((c) => ({ card: c, a: analyses[c.id]?.data }))
      .filter((x): x is { card: RaceCardData; a: RaceAnalysis } => !!x.a);
    return (
      withA.find((x) => x.a.rating === "green") ??
      withA.find((x) => x.a.rating === "yellow") ??
      withA[0] ??
      null
    );
  }, [cards, analyses]);

  if (!best) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best Bet of the Day</div>
        <p className="mt-2 text-sm text-muted-foreground">Awaiting analysis on today's cards…</p>
      </section>
    );
  }

  const { card, a } = best;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-success/40 bg-gradient-to-br from-success/15 via-card to-card p-5">
      <div className="absolute right-4 top-4 opacity-20">
        <Trophy className="h-20 w-20 text-success" />
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-success">Best Bet of the Day</div>
      <h2 className="mt-1 text-xl font-bold text-foreground">
        {card.trackName} · Race {card.race.raceNumber}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDistance(card.race.distance)} {surfaceFromCondition(card.race.condition)} · {formatRaceDate(card.race.startTime, card.race.timezone, card.meetingDate)} · Post {formatPostTime(card.race.startTime, card.race.timezone)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-success/40 bg-success/15 px-3 py-1 text-xs font-semibold text-success">
          {a.topPick}
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
          Exacta {a.exacta}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-foreground/90">{a.analysis}</p>
    </section>
  );
}

function HorseRacingBody({ cards }: { cards: RaceCardData[] }) {
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});

  useEffect(() => {
    let cancelled = false;
    const initial: Record<string, AnalysisState> = {};
    cards.forEach((c) => (initial[c.id] = { status: "pending" }));
    setAnalyses(initial);
    (async () => {
      for (const card of cards) {
        if (cancelled) return;
        setAnalyses((prev) => ({ ...prev, [card.id]: { status: "loading" } }));
        try {
          const { data, error } = await supabase.functions.invoke("analyze-market", {
            body: { type: "horse-racing", trackName: card.trackName, race: card.race },
          });
          if (cancelled) return;
          if (error) {
            setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: error.message } }));
            continue;
          }
          const raw = data as Any;
          let parsed: RaceAnalysis | null = null;
          if (raw && typeof raw === "object" && raw.rating) {
            parsed = raw as RaceAnalysis;
          } else if (typeof raw?.raw === "string") {
            const m = raw.raw.match(/\{[\s\S]*\}/);
            if (m) parsed = JSON.parse(m[0]);
          }
          if (parsed) {
            setAnalyses((prev) => ({ ...prev, [card.id]: { status: "done", data: parsed! } }));
          } else {
            setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: raw?.error ?? "no analysis" } }));
          }
        } catch (e) {
          setAnalyses((prev) => ({ ...prev, [card.id]: { status: "error", error: (e as Error).message } }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  return (
    <>
      <BestBetBanner cards={cards} analyses={analyses} />
      <div className="space-y-4">
        {cards.map((card) => (
          <RaceCard key={card.id} card={card} state={analyses[card.id] ?? { status: "pending" }} />
        ))}
      </div>
    </>
  );
}

export default function HorseRacing() {
  const [data, setData] = useState<FetchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const today = todayLocalISO();
    supabase.functions
      .invoke("fetch-horse-racing", { body: { date: today } })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setData(data as FetchResponse);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const cards: RaceCardData[] = useMemo(() => {
    if (!data) return [];
    const out: RaceCardData[] = [];
    for (const m of data.meetings) {
      for (const { race, data: rd } of m.races) {
        out.push({
          id: `${m.track}-r${rd.raceNumber ?? race}`,
          trackName: m.trackName,
          race: rd,
          meetingDate: m.date,
        });
      }
    }
    return out;
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-24 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/15 text-info">
            <HorseIcon className="h-6 w-6" />
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

      {!loading && cards.length === 0 && !error && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No US racing found for today.
        </div>
      )}

      {cards.length > 0 && <HorseRacingBody cards={cards} />}

      <p className="text-center text-[11px] text-muted-foreground">
        Race data via FormFav. AI analysis powered by Claude via EdgeHunter.
      </p>
    </div>
  );
}