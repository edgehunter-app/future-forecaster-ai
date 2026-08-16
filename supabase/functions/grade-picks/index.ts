// Outcome-tracking backfill: captures closing odds and grades resolved picks.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function impliedFromAmerican(american: number): number {
  if (!Number.isFinite(american) || american === 0) return 0;
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

function payoutFlat100(american: number, result: string): number {
  if (result === "push" || result === "void") return 0;
  if (result === "loss") return -100;
  if (!Number.isFinite(american) || american === 0) return 0;
  return american > 0 ? american : (100 / Math.abs(american)) * 100;
}

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Best available American price for a pick's selection across Vegas books. */
function bestPriceForPick(game: any, pick: any): { odds: number; line: number | null; book: string } | null {
  const books: any[] = Array.isArray(game?.bookmakers) ? game.bookmakers : [];
  const wantHome = pick.selection_side === "HOME";
  const wantName = wantHome ? game.home_team : game.away_team;
  let best: { odds: number; line: number | null; book: string } | null = null;

  for (const b of books) {
    if (b?.category === "prediction_market") continue;
    for (const m of b?.markets ?? []) {
      if (pick.bet_type === "moneyline" && m.key !== "h2h") continue;
      if (pick.bet_type === "spread" && m.key !== "spreads") continue;
      if (pick.bet_type === "total" && m.key !== "totals") continue;
      for (const o of m?.outcomes ?? []) {
        const isMatch =
          pick.bet_type === "total"
            ? norm(o.name) === norm(pick.selection_side)
            : norm(o.name) === norm(wantName) || norm(o.name) === norm(pick.selection);
        if (!isMatch) continue;
        const odds = Number(o.price);
        if (!Number.isFinite(odds) || odds === 0) continue;
        // "Best" = lowest implied probability (best price for the bettor).
        if (!best || impliedFromAmerican(odds) < impliedFromAmerican(best.odds)) {
          best = { odds, line: o.point === undefined || o.point === null ? null : Number(o.point), book: String(b.key ?? "") };
        }
      }
    }
  }
  return best;
}

function matchGame(games: any[], pick: any): any | null {
  const byId = games.find((g) => String(g.id) === String(pick.event_key));
  if (byId) return byId;
  return (
    games.find(
      (g) =>
        norm(g.home_team) === norm(pick.home_team) &&
        norm(g.away_team) === norm(pick.away_team),
    ) ?? null
  );
}

async function fetchAllOdds(): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-sports-odds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ trigger: "grade-picks", markets: "h2h,spreads,totals", oddsFormat: "american" }),
  });
  if (!res.ok) {
    console.error("fetch-sports-odds failed", res.status);
    return [];
  }
  const json = await res.json().catch(() => null);
  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchScores(sportKey: string): Promise<any[]> {
  if (!ODDS_API_KEY || !sportKey) return [];
  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/scores/?daysFrom=3&apiKey=${ODDS_API_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    console.warn("scores fetch failed", sportKey, res.status);
    return [];
  }
  const json = await res.json().catch(() => null);
  return Array.isArray(json) ? json : [];
}

function scoreOf(ev: any, team: string): number | null {
  const entry = (ev?.scores ?? []).find((s: any) => norm(s.name) === norm(team));
  const n = Number(entry?.score);
  return Number.isFinite(n) ? n : null;
}

function gradePick(pick: any, home: number, away: number): string {
  const isHome = pick.selection_side === "HOME";
  if (pick.bet_type === "total") {
    const total = home + away;
    const line = Number(pick.line);
    if (!Number.isFinite(line)) return "void";
    if (total === line) return "push";
    return (pick.selection_side === "OVER") === (total > line) ? "win" : "loss";
  }
  if (pick.bet_type === "spread") {
    const line = Number(pick.line);
    if (!Number.isFinite(line)) return "void";
    const margin = isHome ? home - away : away - home;
    const adj = margin + line;
    if (adj === 0) return "push";
    return adj > 0 ? "win" : "loss";
  }
  if (home === away) return "push";
  return isHome === home > away ? "win" : "loss";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: cron secret header, or an admin user's JWT.
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  let authorized = CRON_SECRET.length > 0 && cronHeader === CRON_SECRET;
  if (!authorized) {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (token) {
      const { data: userData } = await admin.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin");
        authorized = (roles?.length ?? 0) > 0;
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = { closingCaptured: 0, graded: 0, pendingClosing: 0, pendingGrade: 0, errors: [] as string[] };

  try {
    const now = Date.now();

    // ---- Pass A: capture closing odds for events starting soon / just started.
    const { data: closingCandidates } = await admin
      .from("pick_log")
      .select("*")
      .is("closing_odds", null)
      .is("result", null)
      .gte("commence_time", new Date(now - 6 * 3600_000).toISOString())
      .lte("commence_time", new Date(now + 60 * 60_000).toISOString())
      .limit(200);

    summary.pendingClosing = closingCandidates?.length ?? 0;

    if (summary.pendingClosing > 0) {
      const games = await fetchAllOdds();
      for (const pick of closingCandidates ?? []) {
        const game = matchGame(games, pick);
        if (!game) continue;
        const best = bestPriceForPick(game, pick);
        if (!best) continue;
        const { error } = await admin
          .from("pick_log")
          .update({
            closing_odds: Math.round(best.odds),
            closing_implied: Number(impliedFromAmerican(best.odds).toFixed(6)),
            closing_line: best.line,
            closing_book: best.book,
            closing_captured_at: new Date().toISOString(),
          })
          .eq("id", pick.id);
        if (error) summary.errors.push(`closing ${pick.id}: ${error.message}`);
        else summary.closingCaptured++;
      }
    }

    // ---- Pass B: grade picks whose event has finished.
    const { data: gradeCandidates } = await admin
      .from("pick_log")
      .select("*")
      .is("result", null)
      .not("commence_time", "is", null)
      .lte("commence_time", new Date(now - 2 * 3600_000).toISOString())
      .gte("commence_time", new Date(now - 4 * 24 * 3600_000).toISOString())
      .limit(300);

    summary.pendingGrade = gradeCandidates?.length ?? 0;

    if (summary.pendingGrade > 0) {
      const sports = Array.from(new Set((gradeCandidates ?? []).map((p: any) => p.sport_key).filter(Boolean)));
      const scoresBySport: Record<string, any[]> = {};
      for (const s of sports) scoresBySport[s] = await fetchScores(s);

      for (const pick of gradeCandidates ?? []) {
        const events = scoresBySport[pick.sport_key] ?? [];
        const ev = events.find(
          (e: any) =>
            String(e.id) === String(pick.event_key) ||
            (norm(e.home_team) === norm(pick.home_team) && norm(e.away_team) === norm(pick.away_team)),
        );
        if (!ev || ev.completed !== true) continue;
        const home = scoreOf(ev, ev.home_team);
        const away = scoreOf(ev, ev.away_team);
        if (home === null || away === null) continue;

        const result = gradePick(pick, home, away);
        const odds = Number(pick.odds_at_pick);
        const impliedPick = Number(pick.implied_at_pick) || impliedFromAmerican(odds);
        const impliedClose = pick.closing_implied === null || pick.closing_implied === undefined
          ? null
          : Number(pick.closing_implied);
        // CLV in percentage points: how much the market moved toward our side
        // after we took the price. Positive = we beat the close.
        const clv = impliedClose === null ? null : Number(((impliedClose - impliedPick) * 100).toFixed(4));

        const { error } = await admin
          .from("pick_log")
          .update({
            result,
            final_home_score: home,
            final_away_score: away,
            payout_flat_100: Number(payoutFlat100(odds, result).toFixed(2)),
            clv,
            graded_at: new Date().toISOString(),
            grade_notes: impliedClose === null ? "graded without closing odds" : "",
          })
          .eq("id", pick.id);
        if (error) summary.errors.push(`grade ${pick.id}: ${error.message}`);
        else summary.graded++;
      }
    }

    console.log("grade-picks summary", JSON.stringify(summary));
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-picks fatal", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
