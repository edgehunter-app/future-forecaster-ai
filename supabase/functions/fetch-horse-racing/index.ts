// Discovers today's US horse racing cards by probing FormFav for known
// tracks and race numbers. FormFav has no index/schedule endpoint — the
// only way to enumerate is to ask for (date, track, race#) tuples and
// stop when we hit a 404. Window is limited to ±7 days from today.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const FORMFAV_KEY = Deno.env.get("FORMFAV_API_KEY");
const FORMFAV_BASE = "https://api.formfav.com/v1";
const headers = {
  "X-API-Key": FORMFAV_KEY ?? "",
  "Content-Type": "application/json",
};

const US_TRACKS = [
  "churchill-downs",
  "saratoga",
  "belmont-park",
  "aqueduct",
  "santa-anita",
  "gulfstream-park",
  "keeneland",
  "oaklawn-park",
  "ellis-park",
  "monmouth-park",
  "pimlico",
  "laurel-park",
  "colonial-downs",
  "prairie-meadows",
  "woodbine",
  "finger-lakes",
  "parx-racing",
  "charles-town",
  "fair-grounds",
  "tampa-bay-downs",
  "golden-gate-fields",
  "los-alamitos",
  "delta-downs",
  "remington-park",
  "presque-isle-downs",
  "indiana-grand",
  "thistledown",
  "mountaineer",
  "penn-national",
  "turfway-park",
  "canterbury-park",
  "hawthorne",
  "lone-star-park",
  "sam-houston",
  "will-rogers-downs",
  "horseshoe-indianapolis",
  "louisiana-downs",
  "evangeline-downs",
];

function formatTrackName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface ScanResult {
  date: string;
  meetings: Array<{
    track: string;
    trackName: string;
    date: string;
    races: Array<{ race: number; data: unknown }>;
    raceCount: number;
  }>;
  meetingCount: number;
  source: "formfav";
  shapeSample?: { track: string; race: number; keys: string[]; runnerKeys?: string[] };
}

async function scanDate(date: string): Promise<ScanResult> {
  console.log("[horse-racing] scanning:", date);
  console.log("[horse-racing] tracks:", US_TRACKS.length);

  const meetings: ScanResult["meetings"] = [];
  let shapeSample: ScanResult["shapeSample"];

  // FormFav has a low burst limit — hammering 500 concurrent requests
  // returns 429 "Too many requests (burst)". Strategy:
  //   1. Probe race=1 for every track (throttled to CONCURRENCY at a time,
  //      with retry on 429). Tracks whose race=1 404s have no card today.
  //   2. For tracks with a race=1, probe races 2..12 (also throttled).
  const CONCURRENCY = 3;
  const BURST_RETRIES = 4;

  async function probe(track: string, race: number): Promise<{ race: number; data: unknown } | null> {
    const url = `${FORMFAV_BASE}/form?date=${date}&track=${track}&race=${race}&country=us`;
    for (let attempt = 0; attempt <= BURST_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
        if (res.ok) return { race, data: await res.json() };
        if (res.status === 429) {
          await res.body?.cancel();
          // Exponential backoff with jitter for burst-limit recovery.
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1) + Math.random() * 200));
          continue;
        }
        if (race === 1 && res.status !== 404) {
          const body = await res.text();
          console.log(`[horse-racing] ${track} race=1 status=${res.status} body=${body.slice(0, 160)}`);
          return null;
        }
        await res.body?.cancel();
        return null;
      } catch {
        return null;
      }
    }
    console.log(`[horse-racing] ${track} race=${race} gave up after 429 retries`);
    return null;
  }

  async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let idx = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  // Phase 1: race=1 for every track.
  const firstRaces = await runPool(US_TRACKS, (t) => probe(t, 1));
  const activeTracks = US_TRACKS
    .map((t, i) => ({ track: t, first: firstRaces[i] }))
    .filter((x): x is { track: string; first: { race: number; data: unknown } } => !!x.first);
  console.log(`[horse-racing] active tracks after race=1 probe: ${activeTracks.length}`);

  // Phase 2: races 2..12 for the tracks that have a card.
  const extraJobs: Array<{ track: string; race: number }> = [];
  for (const { track } of activeTracks) {
    for (let r = 2; r <= 12; r++) extraJobs.push({ track, race: r });
  }
  const extraResults = await runPool(extraJobs, ({ track, race }) => probe(track, race));
  const extraByTrack = new Map<string, Array<{ race: number; data: unknown }>>();
  extraJobs.forEach((job, i) => {
    const r = extraResults[i];
    if (!r) return;
    const arr = extraByTrack.get(job.track) ?? [];
    arr.push(r);
    extraByTrack.set(job.track, arr);
  });

  const trackResults = activeTracks.map(({ track, first }) => {
    const races = [first, ...(extraByTrack.get(track) ?? [])];
      // FormFav sometimes returns the most recent card even when the date
      // param is future — filter races whose payload `date` doesn't match
      // what we requested so we never surface yesterday's races as today's.
    const returnedDate = (first.data as Record<string, unknown>)?.date;
    if (typeof returnedDate === "string" && returnedDate !== date) {
      console.log(`[horse-racing] ${track}: FormFav returned card for ${returnedDate}, wanted ${date} — dropping`);
    }
      const trackRaces = races
        .filter(({ data }) => {
          const d = (data as Record<string, unknown>)?.date;
          return typeof d !== "string" || d === date;
        });
      return { track, trackRaces };
  });

  for (const { track, trackRaces } of trackResults) {
    if (trackRaces.length === 0) continue;
    trackRaces.sort((a, b) => a.race - b.race);
    if (!shapeSample) {
      const first = trackRaces[0].data as Record<string, unknown>;
      shapeSample = { track, race: trackRaces[0].race, keys: Object.keys(first) };
    }
    meetings.push({
      track,
      trackName: formatTrackName(track),
      date,
      races: trackRaces,
      raceCount: trackRaces.length,
    });
    console.log(`[horse-racing] ${track}: ${trackRaces.length} races`);
  }

  console.log("[horse-racing] meetings found:", meetings.length);
  console.log("[horse-racing] tracks with races:", meetings.map((m) => m.track));

  return { date, meetings, meetingCount: meetings.length, source: "formfav", shapeSample };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const url = new URL(req.url);
    console.log("[horse-racing] req.url:", req.url, "search:", url.search);
    let requested = url.searchParams.get("date");
    if (!requested && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        if (body && typeof body.date === "string") requested = body.date;
      } catch { /* ignore */ }
    }
    const alsoScanSaturday = url.searchParams.get("probeSaturday") === "1";
    const probeUK = url.searchParams.get("probeUK") === "1";
    const probeAuth = url.searchParams.get("probeAuth") === "1";
    const probeSlugs = url.searchParams.get("probeSlugs") === "1";

    if (probeSlugs) {
      const testDate = url.searchParams.get("date") ?? "2026-07-17";
      const out: Record<string, unknown> = { testDate };

      // 1) /tracks?country=us
      try {
        const r = await fetch(`${FORMFAV_BASE}/tracks?country=us`, { headers, signal: AbortSignal.timeout(8000) });
        const body = r.ok ? await r.json() : (await r.text()).slice(0, 1500);
        out.tracks_endpoint = { status: r.status, body };
        console.log(`[slugs] /tracks?country=us status=${r.status}`);
      } catch (e) {
        out.tracks_endpoint = { error: String(e) };
      }
      await new Promise((r) => setTimeout(r, 400));

      const testSlug = async (slug: string) => {
        const u = `${FORMFAV_BASE}/form?date=${testDate}&track=${slug}&race=1&country=us`;
        try {
          const r = await fetch(u, { headers, signal: AbortSignal.timeout(8000) });
          const body = r.ok ? await r.json() : (await r.text()).slice(0, 200);
          const returnedDate = r.ok ? (body as Record<string, unknown>)?.date : undefined;
          console.log(`[slugs] ${slug}: ${r.status}${returnedDate ? ` returnedDate=${returnedDate}` : ""}`);
          return { status: r.status, returnedDate, body };
        } catch (e) {
          return { error: String(e) };
        }
      };

      const delMar = ["del-mar", "delmar", "del_mar", "dmr", "del-mar-thoroughbred-club", "del-mar-racetrack", "san-diego"];
      const saratoga = ["saratoga", "saratoga-race-course", "sar", "saratoga-springs", "nyra-saratoga"];

      const delMarResults: Record<string, unknown> = {};
      for (const s of delMar) {
        delMarResults[s] = await testSlug(s);
        await new Promise((r) => setTimeout(r, 400));
      }
      out.del_mar = delMarResults;

      const saratogaResults: Record<string, unknown> = {};
      for (const s of saratoga) {
        saratogaResults[s] = await testSlug(s);
        await new Promise((r) => setTimeout(r, 400));
      }
      out.saratoga = saratogaResults;

      return new Response(JSON.stringify(out, null, 2), { headers: CORS_HEADERS });
    }

    if (probeAuth) {
      const results: Record<string, unknown> = { key_present: !!FORMFAV_KEY };
      const testDate = url.searchParams.get("date") ?? "2026-07-17";
      const tracks = ["del-mar", "delmar", "del_mar", "saratoga", "saratoga-race-course"];
      for (const track of tracks) {
        const base = `${FORMFAV_BASE}/form?date=${testDate}&track=${track}&race=1&country=us`;
        const attempts = [
          { label: "X-API-Key", url: base, headers: { "X-API-Key": FORMFAV_KEY ?? "" } },
          { label: "Bearer", url: base, headers: { Authorization: `Bearer ${FORMFAV_KEY ?? ""}` } },
          { label: "apikey-param", url: `${base}&apikey=${FORMFAV_KEY ?? ""}`, headers: {} as Record<string, string> },
        ];
        const perTrack: Record<string, unknown> = {};
        for (const a of attempts) {
          try {
            const r = await fetch(a.url, { headers: a.headers, signal: AbortSignal.timeout(8000) });
            const remaining = r.headers.get("x-ratelimit-requests-remaining");
            const body = r.ok ? await r.json() : (await r.text()).slice(0, 300);
            console.log(`[auth-probe] ${track} ${a.label}: ${r.status} remaining=${remaining}`);
            perTrack[a.label] = { status: r.status, remaining, body };
          } catch (e) {
            perTrack[a.label] = { error: String(e) };
          }
          await new Promise((res) => setTimeout(res, 250));
        }
        results[track] = perTrack;
      }
      return new Response(JSON.stringify({ probeAuth: true, testDate, results }, null, 2), { headers: CORS_HEADERS });
    }

    if (probeUK) {
      // Diagnostic 1: fetch /form with NO args to see full list of required
      // params (server returns a FastAPI 422 detail array).
      const noArgs = await fetch(`${FORMFAV_BASE}/form`, { headers });
      const noArgsBody = await noArgs.text();
      console.log(`[uk-probe] /form no-args status=${noArgs.status} body=${noArgsBody}`);

      // Diagnostic 2: try one UK track with country=gb / country=uk / no country.
      const variants = [
        `/form?date=2026-07-08&track=ascot&race=1&country=gb`,
        `/form?date=2026-07-08&track=ascot&race=1&country=uk`,
        `/form?date=2026-07-08&track=ascot&race=1`,
        `/form?date=2026-07-08&track=ascot&race=1&race_code=gallops`,
        `/form?date=2026-07-08&track=ascot&race=1&country=gb&race_code=gallops`,
      ];
      for (const v of variants) {
        const r = await fetch(`${FORMFAV_BASE}${v}`, { headers });
        const body = (await r.text()).slice(0, 400);
        console.log(`[uk-probe] variant ${v} → ${r.status} ${body}`);
        await new Promise((res) => setTimeout(res, 150));
      }

      const results: Record<string, unknown> = {};
      const tracks = ["ascot", "newmarket", "goodwood", "york", "sandown-park", "kempton-park", "chelmsford-city"];
      const dates = ["2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"];
      for (const t of tracks) {
        for (const d of dates) {
          const u = `${FORMFAV_BASE}/form?date=${d}&track=${t}&race=1`;
          const res = await fetch(u, { headers, signal: AbortSignal.timeout(5000) });
          const body = res.ok ? await res.json() : (await res.text()).slice(0, 160);
          results[`${t}@${d}`] = { status: res.status, body };
          console.log(`[uk-probe] ${t} ${d}: ${res.status}`);
          if (res.ok) {
            console.log(`[uk-probe] FIRST SUCCESS full payload:`, JSON.stringify(body).slice(0, 3000));
            return new Response(JSON.stringify({ probeUK: true, results }, null, 2), { headers: CORS_HEADERS });
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      return new Response(JSON.stringify({ probeUK: true, results }, null, 2), { headers: CORS_HEADERS });
    }

    // US horse racing uses Eastern time — a card scheduled for "today"
    // in Kentucky is still "yesterday" in UTC until early morning ET.
    const easternToday = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const utcToday = new Date().toISOString().split("T")[0];
    console.log("[horse-racing] date ET:", easternToday, "UTC:", utcToday);
    const primaryDate = requested ?? easternToday;

    const primary = await scanDate(primaryDate);

    let saturday: ScanResult | undefined;
    if (alsoScanSaturday && primary.meetingCount === 0) {
      // Nearest Saturday within the ±7d window.
      const d = new Date(primaryDate + "T00:00:00Z");
      const daysToSat = (6 - d.getUTCDay() + 7) % 7 || 7;
      const sat = new Date(d);
      sat.setUTCDate(d.getUTCDate() + Math.min(daysToSat, 7));
      const satDate = sat.toISOString().split("T")[0];
      console.log("[horse-racing] fallback probing saturday:", satDate);
      saturday = await scanDate(satDate);
    }

    return new Response(
      JSON.stringify({ ...primary, saturdayFallback: saturday }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[horse-racing] fatal:", err);
    return new Response(
      JSON.stringify({ meetings: [], error: String(err) }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
});