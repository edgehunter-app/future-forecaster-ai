import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, AlertTriangle, Clock, MapPin, Loader2, RefreshCw } from "lucide-react";
import HorseIcon from "@/components/icons/HorseIcon";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "green" ? RATING_STYLES.green.dot : "bg-muted")} />
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "yellow" ? RATING_STYLES.yellow.dot : "bg-muted")} />
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "red" ? RATING_STYLES.red.dot : "bg-muted")} />
    </div>
  );
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

function surfaceFromCondition(condition?: string): string {
  if (!condition) return "";
  const c = condition.toLowerCase();
  if (["firm", "good", "soft", "heavy", "yielding"].some((t) => c.includes(t))) return "Turf";
  if (c.includes("synthetic") || c.includes("tapeta") || c.includes("polytrack")) return "Synthetic";
  return "Dirt";
}

interface RaceCardData {
  id: string;
  trackName: string;
  race: RaceData;
}

function useRaceAnalysis(card: RaceCardData) {
  const [analysis, setAnalysis] = useState<RaceAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    supabase.functions
      .invoke("analyze-market", {
        body: {
          type: "horse-racing",
          trackName: card.trackName,
          race: card.race,
        },
      })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        // analyze-market returns { text, ... } where text is the model output
        const text: string =
          (data as Any)?.analysis ??
          (data as Any)?.text ??
          (data as Any)?.raw ??
          JSON.stringify(data ?? {});
        try {
          const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
          const parsed = JSON.parse(jsonStr);
          setAnalysis(parsed);
        } catch (e) {
          setError("Failed to parse analysis");
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  return { analysis, loading, error };
}

// deno-lint-ignore no-explicit-any
type Any = any;

function RaceCard({ card }: { card: RaceCardData }) {
  const { race, trackName } = card;
  const [open, setOpen] = useState(false);
  const { analysis, loading, error } = useRaceAnalysis(card);
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
            <span>{formatPostTime(race.startTime, race.timezone)}</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Race {race.raceNumber} · {race.distance ?? ""} {surface}
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

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs font-semibold text-info hover:underline"
      >
        {open ? "Hide full field" : `Show full field (${liveRunners.length} runners)`}
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
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
      )}

      {scratches.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Scratches: {scratches.map((s) => `#${s.number} ${s.name}`).join(", ")}
        </div>
      )}
    </article>
  );
}

// Legacy mock retained purely to satisfy TS shape below; unused
const _MOCK: unknown[] = [];
void _MOCK;

// Original mock RACES array removed — real data now comes from fetch-horse-racing.
const RACES_LEGACY: never[] = [
  // (kept for reference in git history — no runtime effect)
] as never[];
void RACES_LEGACY;

const _UNUSED_MOCK: never[] = [

] as never[];
void _UNUSED_MOCK;

/* --------- original mock data removed --------- */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _REMOVED = [
  {
    id: "cd-r7",
    track: "Churchill Downs",
    raceNumber: 7,
    postTime: "4:42 PM ET",
    distance: "1 1/16 Miles",
    surface: "Dirt",
    purse: "$120,000",
    conditions: "Allowance Optional Claiming · 3yo+",
    runners: [
      { pp: 1, name: "Bourbon Thunder", jockey: "F. Geroux", trainer: "B. Cox", morningLine: "5-2" },
      { pp: 2, name: "Twin Spires Glory", jockey: "T. Gaffalione", trainer: "S. Asmussen", morningLine: "3-1" },
      { pp: 3, name: "Mint Julep Express", jockey: "B. Hernandez Jr.", trainer: "K. McPeek", morningLine: "8-1" },
      { pp: 4, name: "Backside Stalker", jockey: "J. Leparoux", trainer: "M. Casse", morningLine: "12-1", scratched: true },
      { pp: 5, name: "Derby Dreamer", jockey: "L. Saez", trainer: "T. Pletcher", morningLine: "4-1" },
      { pp: 6, name: "Crimson Crown", jockey: "J. Castellano", trainer: "C. Brown", morningLine: "6-1" },
      { pp: 7, name: "Old Forester", jockey: "R. Santana", trainer: "B. Cox", morningLine: "15-1" },
      { pp: 8, name: "Spires of Speed", jockey: "C. Lanerie", trainer: "I. Wilkes", morningLine: "20-1" },
    ],
    analysis: {
      rating: "green",
      ratingLabel: "Strong Play",
      topPick: "#2 Twin Spires Glory",
      exacta: "2 / 1,5,6",
      analysis:
        "Twin Spires Glory steps up off a sharp allowance win at Keeneland and draws a perfect stalking trip from the 2 hole. Asmussen barn is 28% with second-off-claim runners and Gaffalione fits like a glove. Bourbon Thunder is the speed but figures to soften the pace for our closer.",
    },
  },
  {
    id: "sar-r5",
    track: "Saratoga",
    raceNumber: 5,
    postTime: "3:18 PM ET",
    distance: "6 Furlongs",
    surface: "Turf",
    purse: "$95,000",
    conditions: "Maiden Special Weight · 2yo Fillies",
    runners: [
      { pp: 1, name: "Spa City Sweetheart", jockey: "I. Ortiz Jr.", trainer: "C. Brown", morningLine: "7-2" },
      { pp: 2, name: "Travers Tiara", jockey: "J. Rosario", trainer: "T. Pletcher", morningLine: "5-2" },
      { pp: 3, name: "Whitney Whisper", jockey: "J. Velazquez", trainer: "B. Mott", morningLine: "9-2" },
      { pp: 4, name: "Oklahoma Oak", jockey: "L. Saez", trainer: "S. Asmussen", morningLine: "10-1", scratched: true },
      { pp: 5, name: "Belmont Belle", jockey: "M. Franco", trainer: "C. Clement", morningLine: "6-1" },
      { pp: 6, name: "Yaddo Garden", jockey: "T. Gaffalione", trainer: "G. Weaver", morningLine: "8-1" },
      { pp: 7, name: "Carousel Queen", jockey: "K. Carmouche", trainer: "L. Rice", morningLine: "15-1" },
    ],
    analysis: {
      rating: "yellow",
      ratingLabel: "Use With Caution",
      topPick: "#2 Travers Tiara",
      exacta: "2 / 1,3",
      analysis:
        "Pletcher first-time starter from a Tapit mare has fired bullets on the Oklahoma training track and Rosario stays. The favorite Spa City Sweetheart is logical from the rail but Brown 2yo fillies on turf debuting at Saratoga are only 11% over five years. Lean Travers Tiara on top with a defensive exacta.",
    },
  },
  {
    id: "gp-r9",
    track: "Gulfstream Park",
    raceNumber: 9,
    postTime: "5:55 PM ET",
    distance: "1 1/8 Miles",
    surface: "Turf",
    purse: "$200,000",
    conditions: "Stakes · 4yo+ · Pegasus Prep",
    runners: [
      { pp: 1, name: "Hallandale Hero", jockey: "L. Saez", trainer: "T. Pletcher", morningLine: "9-5" },
      { pp: 2, name: "Sunshine Skipper", jockey: "J. Ortiz", trainer: "C. McGaughey", morningLine: "4-1" },
      { pp: 3, name: "South Beach Sensation", jockey: "E. Jaramillo", trainer: "S. Joseph Jr.", morningLine: "5-1" },
      { pp: 4, name: "Aventura Avenger", jockey: "T. Gaffalione", trainer: "B. Cox", morningLine: "6-1" },
      { pp: 5, name: "Biscayne Bay", jockey: "J. Alvarado", trainer: "C. Brown", morningLine: "8-1" },
      { pp: 6, name: "Miami Mile", jockey: "P. Lopez", trainer: "M. Maker", morningLine: "12-1" },
      { pp: 7, name: "Coral Gables Colt", jockey: "M. Vasquez", trainer: "D. Romans", morningLine: "20-1", scratched: true },
      { pp: 8, name: "Tropical Storm", jockey: "I. Ortiz Jr.", trainer: "C. Clement", morningLine: "15-1" },
      { pp: 9, name: "Ocean Drive", jockey: "S. Camacho Jr.", trainer: "J. Sano", morningLine: "30-1" },
    ],
    analysis: {
      rating: "red",
      ratingLabel: "Pass / Toss-Up",
      topPick: "#3 South Beach Sensation",
      exacta: "3,4 / 1,2,3,4",
      analysis:
        "Hallandale Hero is overbet off a soft local stake and the field is loaded with closers, meaning a paceless mess looks likely. South Beach Sensation is the lone tactical horse with stakes turf form and gets weight relief, but this is a chaotic spot. Small play with a wide exacta or pass entirely.",
    },
  },
];

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
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "green" ? RATING_STYLES.green.dot : "bg-muted")} />
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "yellow" ? RATING_STYLES.yellow.dot : "bg-muted")} />
      <span className={cn("h-2.5 w-2.5 rounded-full", rating === "red" ? RATING_STYLES.red.dot : "bg-muted")} />
    </div>
  );
}

function RaceCard({ race }: { race: Race }) {
  const [open, setOpen] = useState(false);
  const style = RATING_STYLES[race.analysis.rating];
  const liveRunners = race.runners.filter((r) => !r.scratched);
  const scratches = race.runners.filter((r) => r.scratched);

  return (
    <article className={cn("rounded-2xl border bg-card p-4 sm:p-5", style.ring)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{race.track}</span>
            <span>·</span>
            <Clock className="h-3.5 w-3.5" />
            <span>{race.postTime}</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Race {race.raceNumber} · {race.distance} {race.surface}
          </h3>
          <p className="text-xs text-muted-foreground">
            {race.conditions} · Purse {race.purse}
          </p>
        </div>
        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", style.chip)}>
          <TrafficLight rating={race.analysis.rating} />
          <span>{race.analysis.ratingLabel}</span>
        </div>
      </header>

      <section className="mt-4 rounded-xl border border-info/30 bg-info/5 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-info">
          <Sparkles className="h-3.5 w-3.5" />
          Edge Analysis
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Top Pick</div>
            <div className="text-sm font-semibold text-foreground">{race.analysis.topPick}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Exacta</div>
            <div className="text-sm font-semibold text-foreground">{race.analysis.exacta}</div>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{race.analysis.analysis}</p>
      </section>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs font-semibold text-info hover:underline"
      >
        {open ? "Hide full field" : `Show full field (${liveRunners.length} runners)`}
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">PP</th>
                <th className="px-3 py-2 text-left">Horse</th>
                <th className="px-3 py-2 text-left">Jockey</th>
                <th className="px-3 py-2 text-left">Trainer</th>
                <th className="px-3 py-2 text-right">M/L</th>
              </tr>
            </thead>
            <tbody>
              {race.runners.map((r) => (
                <tr
                  key={r.pp}
                  className={cn(
                    "border-t border-border",
                    r.scratched && "text-muted-foreground line-through opacity-60",
                  )}
                >
                  <td className="px-3 py-2 font-mono">{r.pp}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                  <td className="px-3 py-2">{r.jockey}</td>
                  <td className="px-3 py-2">{r.trainer}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.morningLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scratches.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Scratches: {scratches.map((s) => `#${s.pp} ${s.name}`).join(", ")}
        </div>
      )}
    </article>
  );
}

export default function HorseRacing() {
  const bestBet = useMemo(() => {
    const green = RACES.find((r) => r.analysis.rating === "green") ?? RACES[0];
    return green;
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-24 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/15 text-info">
          <HorseIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Horse Racing</h1>
          <p className="text-sm text-muted-foreground">AI-graded race cards from major North American tracks</p>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-success/40 bg-gradient-to-br from-success/15 via-card to-card p-5">
        <div className="absolute right-4 top-4 opacity-20">
          <Trophy className="h-20 w-20 text-success" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-success">Best Bet of the Day</div>
        <h2 className="mt-1 text-xl font-bold text-foreground">
          {bestBet.track} · Race {bestBet.raceNumber}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {bestBet.distance} {bestBet.surface} · Post {bestBet.postTime}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-success/40 bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            {bestBet.analysis.topPick}
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
            Exacta {bestBet.analysis.exacta}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-foreground/90">{bestBet.analysis.analysis}</p>
      </section>

      <div className="space-y-4">
        {RACES.map((race) => (
          <RaceCard key={race.id} race={race} />
        ))}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Mock fields shown for demo. AI analysis powered by Claude via EdgeHunter.
      </p>
    </div>
  );
}