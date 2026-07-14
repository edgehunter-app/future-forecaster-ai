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
  "del-mar",
  "belmont-park",
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
  "arlington-park",
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

  for (const track of US_TRACKS) {
    const trackRaces: Array<{ race: number; data: unknown }> = [];

    for (let race = 1; race <= 10; race++) {
      const url = `${FORMFAV_BASE}/form?date=${date}&track=${track}&race=${race}&country=us`;
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const json = await res.json();
          trackRaces.push({ race, data: json });
          console.log(
            `[horse-racing] ${track} R${race}: FOUND`,
            JSON.stringify(json).slice(0, 200),
          );
          if (!shapeSample && json && typeof json === "object") {
            const obj = json as Record<string, unknown>;
            const keys = Object.keys(obj);
            // Try to identify a runners/entries list to log its keys too.
            const runnersKey = ["runners", "entries", "horses", "starters"].find((k) => Array.isArray(obj[k]));
            const runnerKeys = runnersKey
              ? Object.keys(((obj[runnersKey] as unknown[])[0] ?? {}) as Record<string, unknown>)
              : undefined;
            shapeSample = { track, race, keys, runnerKeys };
            console.log(`[horse-racing] shape sample keys:`, keys.join(","));
            if (runnerKeys) console.log(`[horse-racing] runner keys:`, runnerKeys.join(","));
            console.log(`[horse-racing] full first race payload:`, JSON.stringify(json).slice(0, 2000));
          }
        } else if (res.status === 404 || res.status === 400) {
          await res.body?.cancel();
          console.log(`[horse-racing] ${track} R${race}: not found, stopping track`);
          break;
        } else {
          const text = await res.text();
          console.log(`[horse-racing] ${track} R${race}: ${res.status}`, text.slice(0, 120));
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[horse-racing] ${track} R${race}: timeout/error`, msg);
        break;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    if (trackRaces.length > 0) {
      meetings.push({
        track,
        trackName: formatTrackName(track),
        date,
        races: trackRaces,
        raceCount: trackRaces.length,
      });
      console.log(`[horse-racing] ${track}: ${trackRaces.length} races found`);
    }
  }

  console.log("[horse-racing] meetings found:", meetings.length);
  console.log("[horse-racing] tracks with races:", meetings.map((m) => m.track));

  return { date, meetings, meetingCount: meetings.length, source: "formfav", shapeSample };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const url = new URL(req.url);
    let requested = url.searchParams.get("date");
    if (!requested && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        if (body && typeof body.date === "string") requested = body.date;
      } catch { /* ignore */ }
    }
    const alsoScanSaturday = url.searchParams.get("probeSaturday") === "1";
    const probeUK = url.searchParams.get("probeUK") === "1";

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

    const today = new Date().toISOString().split("T")[0];
    const primaryDate = requested ?? today;

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