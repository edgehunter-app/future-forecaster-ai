// fetch-golf-data — Live Golf Data (RapidAPI) integration.
// Exposes two operations the client uses:
//   { type: "current" }  → finds current/next tournament + leaderboard
//   { type: "schedule" } → returns full schedule for the requested year
// Always returns 200 JSON with { ok, ... } so the client never blows up.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOLF_HOST = "live-golf-data.p.rapidapi.com";
const GOLF_BASE = `https://${GOLF_HOST}`;
const TIMEOUT_MS = 9_000;

// ---- Mongo Extended JSON unwrappers ----
function num(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v === "object") {
    if ("$numberInt" in v) return Number(v.$numberInt) || 0;
    if ("$numberLong" in v) return Number(v.$numberLong) || 0;
    if ("$numberDouble" in v) return Number(v.$numberDouble) || 0;
  }
  return 0;
}
function mongoDate(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(new Date(v)) || 0;
  if (typeof v === "object") {
    if (v.$date) {
      if (typeof v.$date === "object" && "$numberLong" in v.$date) {
        return Number(v.$date.$numberLong) || 0;
      }
      if (typeof v.$date === "string") return Number(new Date(v.$date)) || 0;
      if (typeof v.$date === "number") return v.$date;
    }
    if ("$numberLong" in v) return Number(v.$numberLong) || 0;
  }
  return 0;
}

function golfHeaders(key: string) {
  return {
    "x-rapidapi-host": GOLF_HOST,
    "x-rapidapi-key": key,
  };
}

async function getJson(url: string, key: string): Promise<any> {
  const res = await fetch(url, {
    headers: golfHeaders(key),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

function normalizeTournament(t: any) {
  const start = mongoDate(t?.date?.start);
  const end = mongoDate(t?.date?.end);
  return {
    tournId: String(t?.tournId ?? ""),
    name: String(t?.name ?? ""),
    format: t?.format ?? null,
    purse: num(t?.purse),
    winnersShare: num(t?.winnersShare),
    fedexCupPoints: num(t?.fedexCupPoints),
    startMs: start,
    endMs: end,
    startIso: start ? new Date(start).toISOString() : null,
    endIso: end ? new Date(end).toISOString() : null,
  };
}

function normalizeLeaderboardRow(r: any) {
  return {
    position: r?.position ?? "",
    firstName: r?.firstName ?? "",
    lastName: r?.lastName ?? "",
    playerId: r?.playerId ?? "",
    status: r?.status ?? "",
    isAmateur: !!r?.isAmateur,
    total: r?.total ?? "",
    currentRoundScore: r?.currentRoundScore ?? "",
    totalStrokesFromCompletedRounds: num(r?.totalStrokesFromCompletedRounds),
    courseId: r?.courseId ?? "",
    rounds: Array.isArray(r?.rounds)
      ? r.rounds.map((rd: any) => ({
          roundId: num(rd?.roundId),
          strokes: num(rd?.strokes),
          scoreToPar: rd?.scoreToPar ?? "",
          courseName: rd?.courseName ?? "",
          courseId: rd?.courseId ?? "",
        }))
      : [],
  };
}

async function fetchSchedule(key: string, year: string) {
  const json = await getJson(
    `${GOLF_BASE}/schedule?year=${encodeURIComponent(year)}`,
    key,
  );
  const raw = Array.isArray(json) ? json : (json?.schedule ?? json?.tournaments ?? []);
  const tournaments = (Array.isArray(raw) ? raw : []).map(normalizeTournament);
  // Sort by startMs ascending so callers can rely on chronological order.
  tournaments.sort((a, b) => a.startMs - b.startMs);
  return tournaments;
}

function findCurrentOrNext(tournaments: ReturnType<typeof normalizeTournament>[], now: number) {
  const current = tournaments.find(
    (t) => t.startMs > 0 && t.endMs > 0 && t.startMs <= now && t.endMs >= now,
  );
  if (current) return { tournament: current, isLive: true };
  const upcoming = tournaments.find((t) => t.startMs > now);
  if (upcoming) return { tournament: upcoming, isLive: false };
  return { tournament: null as any, isLive: false };
}

async function fetchLeaderboard(key: string, year: string, tournId: string) {
  const json = await getJson(
    `${GOLF_BASE}/leaderboard?year=${encodeURIComponent(year)}&tournId=${encodeURIComponent(tournId)}`,
    key,
  );
  const top = Array.isArray(json) ? json[0] : json;
  const rows = Array.isArray(top?.leaderboardRows) ? top.leaderboardRows : [];
  const cutLines = Array.isArray(top?.cutLines) ? top.cutLines.map((c: any) => ({
    cutCount: num(c?.cutCount),
    cutScore: c?.cutScore ?? "",
  })) : [];
  return {
    status: top?.status ?? "",
    roundId: num(top?.roundId),
    rows: rows.map(normalizeLeaderboardRow),
    cutLines,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("LIVE_GOLF_API_KEY");
  if (!apiKey) {
    return jsonResponse({ ok: false, error: "LIVE_GOLF_API_KEY not configured" });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const type: string = body?.type ?? "current";
  const year: string = String(body?.year ?? new Date().getFullYear());

  try {
    if (type === "schedule") {
      const schedule = await fetchSchedule(apiKey, year);
      return jsonResponse({ ok: true, year, schedule });
    }

    // type === "current" (default)
    const schedule = await fetchSchedule(apiKey, year);
    const now = Date.now();
    const { tournament, isLive } = findCurrentOrNext(schedule, now);

    if (!tournament) {
      return jsonResponse({
        ok: true,
        year,
        tournament: null,
        leaderboard: null,
        isLive: false,
        scheduleCount: schedule.length,
      });
    }

    let leaderboard: Awaited<ReturnType<typeof fetchLeaderboard>> | null = null;
    if (isLive) {
      try {
        leaderboard = await fetchLeaderboard(apiKey, year, tournament.tournId);
      } catch (err) {
        console.warn("[fetch-golf-data] leaderboard error:", String(err));
      }
    }

    return jsonResponse({
      ok: true,
      year,
      tournament,
      leaderboard,
      isLive,
      scheduleCount: schedule.length,
    });
  } catch (err) {
    console.error("[fetch-golf-data] error:", err);
    return jsonResponse({
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      tournament: null,
      leaderboard: null,
      isLive: false,
    });
  }
});