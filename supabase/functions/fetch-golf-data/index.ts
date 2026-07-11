// fetch-golf-data — Golf Leaderboard Data (RapidAPI) integration.
// Combines PGA Tour (id=2) and European Tour (id=1) fixtures, finds the
// current/next tournament by date, and returns the live leaderboard.
// Response shape is preserved so the existing UI keeps rendering:
//   { ok, tournament: {tournId,name,purse,startMs,endMs,startIso,endIso,...},
//     leaderboard: { status, roundId, rows: GolfLeaderboardRow[], cutLines },
//     isLive }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOLF_HOST = "golf-leaderboard-data.p.rapidapi.com";
const GOLF_BASE = `https://${GOLF_HOST}`;
const TIMEOUT_MS = 9_000;
const PROVIDER = "rapidapi-golf-leaderboard";
const DAILY_LIMIT = 250;

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

function golfHeaders(key: string) {
  return {
    "x-rapidapi-host": GOLF_HOST,
    "x-rapidapi-key": key,
    "Content-Type": "application/json",
  };
}

function toMs(d: any): number {
  if (!d) return 0;
  const s = typeof d === "string" ? d.replace(" ", "T") : d;
  const ms = Number(new Date(s));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeTournament(t: any) {
  const startMs = toMs(t?.start_date);
  const endMs = toMs(t?.end_date);
  const courseName = typeof t?.course === "string"
    ? t.course
    : t?.course?.name ?? t?.venue ?? "";
  return {
    tournamentId: t?.id ?? t?.tournament_id ?? null,
    tournId: String(t?.id ?? t?.tournament_id ?? ""),
    name: String(t?.name ?? ""),
    format: t?.type ?? null,
    purse: num(t?.prize_fund),
    winnersShare: 0,
    fedexCupPoints: 0,
    course: courseName,
    country: t?.country ?? "",
    status: t?.status ?? "",
    startMs,
    endMs,
    startIso: startMs ? new Date(startMs).toISOString() : null,
    endIso: endMs ? new Date(endMs).toISOString() : null,
  };
}

function normalizeRow(p: any, tournamentStatus: string) {
  const rounds = Array.isArray(p?.rounds) ? p.rounds : [];
  return {
    position: String(p?.position ?? "--"),
    firstName: String(p?.first_name ?? ""),
    lastName: String(p?.last_name ?? ""),
    playerId: String(p?.player_id ?? p?.id ?? ""),
    status: String(p?.status ?? tournamentStatus ?? ""),
    isAmateur: !!p?.is_amateur,
    total: String(p?.total_to_par ?? p?.total ?? "E"),
    currentRoundScore: String(p?.round_score ?? p?.today ?? "-"),
    totalStrokesFromCompletedRounds: num(p?.total_strokes),
    courseId: "",
    rounds: rounds.map((r: any) => ({
      roundId: num(r?.round_number ?? r?.round),
      strokes: num(r?.strokes ?? r?.total_to_par),
      scoreToPar: String(r?.score_to_par ?? r?.total_to_par ?? "E"),
      courseName: "",
      courseId: "",
    })),
  };
}

async function golfFetch(path: string, key: string): Promise<{ res: Response; json: any | null }> {
  const url = `${GOLF_BASE}${path}`;
  const res = await fetch(url, {
    headers: golfHeaders(key),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  console.log(
    "[golf-lb]", path,
    "status=", res.status,
    "remaining=", res.headers.get("x-ratelimit-requests-remaining"),
    "limit=", res.headers.get("x-ratelimit-requests-limit"),
  );
  let json: any = null;
  if (res.ok) {
    try { json = await res.json(); } catch { json = null; }
  } else {
    const body = await res.text().catch(() => "");
    console.warn("[golf-lb]", path, "error body:", body.slice(0, 200));
  }
  return { res, json };
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
}

async function trackUsage(callsMade: number, remaining: number | null) {
  const client = getServiceClient();
  if (!client) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await client.from("api_usage").select("request_count")
      .eq("provider", PROVIDER).eq("used_at", today).maybeSingle();
    const current = data?.request_count ?? 0;
    await client.from("api_usage").upsert(
      { provider: PROVIDER, used_at: today, request_count: current + callsMade },
      { onConflict: "provider,used_at" },
    );
    if (remaining !== null && Number.isFinite(remaining)) {
      await client.from("api_usage").upsert(
        { provider: PROVIDER, used_at: "9999-12-31", request_count: remaining },
        { onConflict: "provider,used_at" },
      );
    }
  } catch (err) {
    console.warn("[golf-lb] usage tracking failed:", String(err));
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("GOLF_LEADERBOARD_API_KEY");
  if (!apiKey) {
    console.warn("[fetch-golf-data] GOLF_LEADERBOARD_API_KEY missing");
    return jsonResponse({ ok: false, error: "GOLF_LEADERBOARD_API_KEY not configured" });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const type: string = body?.type ?? "current";
  const year: string = String(body?.year ?? new Date().getFullYear());
  console.log("[fetch-golf-data] called", JSON.stringify({ type, year }));

  let callsMade = 0;
  let latestRemaining: number | null = null;

  try {
    // Step 1 — fetch fixtures for both tours in parallel.
    const [pga, euro] = await Promise.all([
      golfFetch(`/fixtures/2/${year}`, apiKey),
      golfFetch(`/fixtures/1/${year}`, apiKey),
    ]);
    callsMade += 2;
    const remHeader = pga.res.headers.get("x-ratelimit-requests-remaining")
      ?? euro.res.headers.get("x-ratelimit-requests-remaining");
    if (remHeader) latestRemaining = Number(remHeader);

    const pgaTs = Array.isArray(pga.json?.results) ? pga.json.results : [];
    const euroTs = Array.isArray(euro.json?.results) ? euro.json.results : [];
    const allRaw = [...pgaTs, ...euroTs];
    const schedule = allRaw
      .map(normalizeTournament)
      .filter((t) => t.startMs > 0 && t.status !== "can");
    schedule.sort((a, b) => a.startMs - b.startMs);
    console.log("[fetch-golf-data] fixtures total:", schedule.length,
      "pga:", pgaTs.length, "euro:", euroTs.length);

    if (type === "schedule") {
      await trackUsage(callsMade, latestRemaining);
      return jsonResponse({ ok: true, year, schedule });
    }

    // Step 2 — find current tournament (start<=today<=end+1d) or next upcoming.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const current = schedule.find((t) => {
      const endBuffer = t.endMs + 86_400_000;
      return t.startMs <= todayMs && todayMs <= endBuffer;
    });
    const upcoming = schedule.find((t) => t.startMs > todayMs);
    const active = current ?? upcoming ?? null;
    console.log("[fetch-golf-data] current:", current?.name ?? "NONE",
      "upcoming:", upcoming?.name ?? "NONE",
      "active:", active?.name ?? "NONE", active?.tournId);

    if (!active) {
      await trackUsage(callsMade, latestRemaining);
      return jsonResponse({
        ok: true, year, tournament: null, leaderboard: null,
        isLive: false, scheduleCount: schedule.length,
      });
    }

    // Step 3 — fetch leaderboard for the active tournament.
    const { res: lbRes, json: lbJson } = await golfFetch(
      `/leaderboard/${active.tournId}`, apiKey,
    );
    callsMade += 1;
    const lbRem = lbRes.headers.get("x-ratelimit-requests-remaining");
    if (lbRem) latestRemaining = Number(lbRem);

    const liveDetails = lbJson?.results?.tournament?.live_details ?? {};
    const liveStatus: string = liveDetails?.status ?? active.status ?? "pre";
    const currentRound = num(liveDetails?.current_round);
    const isLive = liveStatus === "inprogress" || liveStatus === "endofday";

    const playersRaw = Array.isArray(lbJson?.results?.leaderboard)
      ? lbJson.results.leaderboard
      : [];
    const rows = playersRaw.slice(0, 80).map((p: any) => normalizeRow(p, liveStatus));
    console.log("[fetch-golf-data] leaderboard rows:", rows.length,
      "liveStatus:", liveStatus, "round:", currentRound);

    // Merge any richer tournament meta the leaderboard call returned.
    const lbTourn = lbJson?.results?.tournament ?? {};
    const tournament = {
      ...active,
      purse: num(lbTourn?.prize_fund) || active.purse,
      course: (typeof lbTourn?.course === "string" ? lbTourn.course : lbTourn?.course?.name)
        ?? active.course,
      liveStatus,
    };

    await trackUsage(callsMade, latestRemaining);

    return jsonResponse({
      ok: true,
      year,
      tournament,
      leaderboard: {
        status: liveStatus,
        roundId: currentRound,
        rows,
        cutLines: [],
      },
      isLive,
      scheduleCount: schedule.length,
      source: "golf-leaderboard-data",
      quotaRemaining: latestRemaining,
    });
  } catch (err) {
    console.error("[fetch-golf-data] error:", err);
    await trackUsage(callsMade, latestRemaining);
    return jsonResponse({
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      tournament: null,
      leaderboard: null,
      isLive: false,
    });
  }
});