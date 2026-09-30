// Morning pre-population of Top 5 Bets. Called by pg_cron (one call per sport)
// with x-cron-secret from internal_cron_secrets row "scheduled_top5". Uses the
// same scoring as Best Bet Today: confidence*0.6 + edge*100*0.4, x0.6 for
// odds shorter than -350, NO_EDGE dropped. Dates are computed in US Eastern.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MAX_ANALYZED = 10;
const CONCURRENCY = 5;
const DAILY = new Set(["baseball_mlb", "basketball_nba", "icehockey_nhl", "soccer_epl", "soccer_usa_mls", "mma_mixed_martial_arts"]);
const WEEK = new Set(["americanfootball_nfl", "americanfootball_ncaaf"]);
const ALLOWED = new Set([...DAILY, ...WEEK]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function isCron(req: Request) {
  const h = req.headers.get("x-cron-secret");
  if (!h) return false;
  const { data } = await db.from("internal_cron_secrets").select("value").eq("name", "scheduled_top5").maybeSingle();
  return !!data?.value && data.value === h;
}

// ---- Eastern-time date helpers -------------------------------------------
function etKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function etDow(d: Date) {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
}
function addDaysKey(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- Odds mapping (mirrors src/lib/oddsApi.ts fetchFullOdds, non-outright) -
const valid = (o: unknown): o is number => typeof o === "number" && Number.isFinite(o) && o !== 0 && Math.abs(o) <= 10000;
const san = (o: unknown) => (valid(o) ? o : 0);
const imp = (o: number) => (o > 0 ? 100 / (o + 100) : -o / (-o + 100));
const devig = (h: number, a: number) => { const t = h + a; return t ? { home: h / t, away: a / t } : { home: 0, away: 0 }; };
const median = (n: number[]) => { if (!n.length) return 0; const s = [...n].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// deno-lint-ignore no-explicit-any
function mapGame(g: any) {
  const home = g.home_team ?? "Home";
  const away = g.away_team ?? "Away";
  // deno-lint-ignore no-explicit-any
  const books = (g.bookmakers ?? []).map((b: any) => {
    // deno-lint-ignore no-explicit-any
    const m = (k: string) => b.markets?.find((x: any) => x.key === k);
    // deno-lint-ignore no-explicit-any
    const o = (mk: any, n: string) => mk?.outcomes?.find((x: any) => x.name === n);
    const h2h = m("h2h"), sp = m("spreads"), tot = m("totals");
    return {
      name: b.title ?? b.key, key: b.key, category: b.category ?? "vegas", regulatoryNote: b.regulatoryNote ?? null,
      homeMoneyline: san(o(h2h, home)?.price), awayMoneyline: san(o(h2h, away)?.price),
      homeSpread: o(sp, home)?.point ?? 0, spreadHomeOdds: san(o(sp, home)?.price), spreadAwayOdds: san(o(sp, away)?.price),
      totalLine: o(tot, "Over")?.point ?? 0, overOdds: san(o(tot, "Over")?.price), underOdds: san(o(tot, "Under")?.price),
    };
  });
  // deno-lint-ignore no-explicit-any
  const sb = books.filter((b: any) => b.category !== "prediction_market");
  // deno-lint-ignore no-explicit-any
  const best = (f: (b: any) => number) => sb.filter((b: any) => valid(f(b))).reduce((a: any, b: any) => (f(b) > a.odds ? { odds: f(b), book: b.name } : a), { odds: -Infinity, book: "" });
  const hb = best((b) => b.homeMoneyline), ab = best((b) => b.awayMoneyline);
  // deno-lint-ignore no-explicit-any
  const ml = sb.filter((b: any) => valid(b.homeMoneyline) && valid(b.awayMoneyline));
  // deno-lint-ignore no-explicit-any
  const cons = ml.length ? devig(ml.reduce((s: number, b: any) => s + imp(b.homeMoneyline), 0) / ml.length, ml.reduce((s: number, b: any) => s + imp(b.awayMoneyline), 0) / ml.length) : { home: 0, away: 0 };
  // deno-lint-ignore no-explicit-any
  const vb = books.filter((b: any) => b.category === "vegas" && valid(b.homeMoneyline) && valid(b.awayMoneyline));
  let vegasConsensus = null;
  if (vb.length) {
    // deno-lint-ignore no-explicit-any
    const dv = devig(vb.reduce((s: number, b: any) => s + imp(b.homeMoneyline), 0) / vb.length, vb.reduce((s: number, b: any) => s + imp(b.awayMoneyline), 0) / vb.length);
    const toAm = (p: number) => (p <= 0 || p >= 1 ? 0 : p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100));
    vegasConsensus = { home: toAm(dv.home), away: toAm(dv.away), homeImplied: dv.home, awayImplied: dv.away };
  }
  // deno-lint-ignore no-explicit-any
  const spB = books.filter((b: any) => b.homeSpread !== 0 || b.spreadHomeOdds !== 0);
  // deno-lint-ignore no-explicit-any
  const totB = books.filter((b: any) => b.totalLine !== 0);
  const headline = vb[0] ?? ml[0] ?? null;
  const bestHomeOdds = valid(hb.odds) ? hb.odds : 0, bestAwayOdds = valid(ab.odds) ? ab.odds : 0;
  return {
    id: g.id, sport: g.sport_key, league: g.sport_title ?? g.sport_key, homeTeam: home, awayTeam: away,
    commenceTime: g.commence_time ?? "", isLive: false,
    moneyline: { home: headline?.homeMoneyline ?? 0, away: headline?.awayMoneyline ?? 0, homeImplied: cons.home, awayImplied: cons.away,
      bestHomeBook: bestHomeOdds ? hb.book : "", bestAwayBook: bestAwayOdds ? ab.book : "", bestHomeOdds, bestAwayOdds },
    // deno-lint-ignore no-explicit-any
    spread: spB.length ? { homeSpread: median(spB.map((b: any) => b.homeSpread)), awaySpread: -median(spB.map((b: any) => b.homeSpread)), homeOdds: median(spB.map((b: any) => b.spreadHomeOdds)), awayOdds: median(spB.map((b: any) => b.spreadAwayOdds)), bestBook: spB[0]?.name ?? "" } : null,
    // deno-lint-ignore no-explicit-any
    total: totB.length ? { line: median(totB.map((b: any) => b.totalLine)), overOdds: median(totB.map((b: any) => b.overOdds)), underOdds: median(totB.map((b: any) => b.underOdds)), bestBook: totB[0]?.name ?? "" } : null,
    bookmakers: books, vegasConsensus, polymarketMatch: null, polymarketImplied: null, mispricingGap: null,
  };
}
type Game = ReturnType<typeof mapGame>;

// Same request body the app sends (src/hooks/useBestBet.ts scanSportsGames).
function analyzeBody(game: Game) {
  // deno-lint-ignore no-explicit-any
  const v = game.bookmakers.filter((b: any) => b.category !== "prediction_market");
  // deno-lint-ignore no-explicit-any
  const bestBy = (ok: (b: any) => boolean, f: (b: any) => number) => v.filter(ok).reduce((a: any, b: any) => (f(b) > a.odds ? { odds: f(b), book: b.name } : a), { odds: -99999, book: "" });
  const bo = bestBy((b) => b.totalLine && b.overOdds !== 0, (b) => b.overOdds);
  const bu = bestBy((b) => b.totalLine && b.underOdds !== 0, (b) => b.underOdds);
  const spOk = (b: { spreadHomeOdds: number; spreadAwayOdds: number }) => b.spreadHomeOdds !== 0 && b.spreadAwayOdds !== 0;
  const bh = bestBy(spOk, (b) => b.spreadHomeOdds), ba = bestBy(spOk, (b) => b.spreadAwayOdds);
  return {
    type: "sports", homeTeam: game.homeTeam, awayTeam: game.awayTeam, league: game.league, gameTime: game.commenceTime,
    homeImplied: game.moneyline.homeImplied, awayImplied: game.moneyline.awayImplied,
    bestHomeOdds: game.moneyline.bestHomeOdds || game.moneyline.home, bestAwayOdds: game.moneyline.bestAwayOdds || game.moneyline.away,
    bestHomeBook: game.moneyline.bestHomeBook, bestAwayBook: game.moneyline.bestAwayBook,
    spread: game.spread?.homeSpread ?? null, spreadLine: game.spread?.homeSpread ?? null,
    bestHomeSpread: bh.book ? bh.odds : null, bestHomeSpreadBook: bh.book || null,
    bestAwaySpread: ba.book ? ba.odds : null, bestAwaySpreadBook: ba.book || null,
    total: game.total?.line ?? null,
    bestOverOdds: bo.book ? bo.odds : null, bestOverBook: bo.book || null,
    bestUnderOdds: bu.book ? bu.odds : null, bestUnderBook: bu.book || null,
    // deno-lint-ignore no-explicit-any
    bookmakers: game.bookmakers.map((b: any) => ({
      name: b.name, key: b.key, category: b.category, regulatoryNote: b.regulatoryNote,
      moneyline: { home: b.homeMoneyline, away: b.awayMoneyline },
      spread: b.homeSpread ? { line: b.homeSpread, homeOdds: b.spreadHomeOdds, awayOdds: b.spreadAwayOdds } : null,
      total: b.totalLine ? { line: b.totalLine, over: b.overOdds, under: b.underOdds, overOdds: b.overOdds, underOdds: b.underOdds } : null,
    })),
    vegasConsensus: game.vegasConsensus, wallets: [], bankroll: 1000, kellyMultiplier: 0.25, maxPositionPct: 5,
  };
}

async function callFn(name: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  return await r.json();
}

async function runSport(sport: string, force: boolean) {
  const now = new Date();
  const today = etKey(now);
  const isWeek = WEEK.has(sport);
  const weekStart = addDaysKey(today, [-3, -4, 2, 1, 0, -1, -2][etDow(now)]);
  const weekEnd = addDaysKey(weekStart, 4); // Monday
  const periodKey = isWeek ? `wk-${weekStart}` : today;

  const resp = await callFn("fetch-sports-odds", { regions: "us", markets: "h2h,spreads,totals", oddsFormat: "american", trigger: "scheduled-top5", onDemandSport: sport });
  // deno-lint-ignore no-explicit-any
  const all: Game[] = (Array.isArray(resp?.data) ? resp.data : []).filter((g: any) => g.sport_key === sport && !g.isOutright).map(mapGame);
  const cutoff = Date.now() - 3 * 3600000;
  const inPeriod = all
    .filter((g) => {
      const t = new Date(g.commenceTime);
      if (!Number.isFinite(t.getTime()) || t.getTime() < cutoff) return false;
      const k = etKey(t);
      return isWeek ? k >= weekStart && k <= weekEnd : k === today;
    })
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());
  const hasGameToday = inPeriod.some((g) => etKey(new Date(g.commenceTime)) === today);
  if (!hasGameToday && !force) {
    console.log(`[top5] ${sport} skip — no games today (${today}); period ${periodKey} has ${inPeriod.length}`);
    return { sport, skipped: "no games today", periodKey, gamesInPeriod: inPeriod.length };
  }
  const candidates = inPeriod.slice(0, MAX_ANALYZED);
  if (!candidates.length) return { sport, skipped: "no games in period", periodKey };

  // deno-lint-ignore no-explicit-any
  const scored: any[] = [];
  let aiCalls = 0;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    await Promise.all(candidates.slice(i, i + CONCURRENCY).map(async (game) => {
      try {
        aiCalls++;
        const a = await callFn("analyze-market", analyzeBody(game));
        if (!a || a.code || typeof a.recommendation !== "string" || a.recommendation === "NO_EDGE") return;
        const confidence = Math.max(0, Math.min(100, Math.round(a.confidence ?? 0)));
        const edge = a.edge ?? 0;
        const base = confidence * 0.6 + edge * 100 * 0.4;
        scored.push({ score: (a.odds ?? 0) < -350 ? base * 0.6 : base, confidence, edge, game, analysis: { ...a, confidence } });
      } catch (e) {
        console.warn(`[top5] ${sport} analyze failed ${game.awayTeam} @ ${game.homeTeam}:`, (e as Error).message);
      }
    }));
  }
  const entries = scored.sort((a, b) => b.score - a.score).slice(0, 5);
  const at = new Date().toISOString();
  const payload = { entries, analyzed: candidates.length, at, scheduled: true };
  const { error: upErr } = await db.from("top5_cache").upsert({ sport_key: sport, period_key: periodKey, payload, scanned_at: at, scanned_by: null });
  if (upErr) throw new Error(`cache save failed: ${upErr.message}`);

  if (entries.length) {
    const rows = entries.map((e, i) => {
      const a = e.analysis, g = e.game as Game;
      const side = String(a.recommendation).toUpperCase();
      const odds = Number(a.odds);
      const line = a.betType === "spread" ? (a.spreadLine ?? null) : a.betType === "total" ? (g.total?.line ?? null) : null;
      return {
        user_id: null, origin: "top5", pick_rank: i + 1, event_key: String(g.id), sport_key: sport, league: g.league,
        event_name: `${g.awayTeam} @ ${g.homeTeam}`, home_team: g.homeTeam, away_team: g.awayTeam, commence_time: g.commenceTime || null,
        bet_type: a.betType ?? "moneyline",
        selection: side === "HOME" ? g.homeTeam : side === "AWAY" ? g.awayTeam : side === "OVER" ? "Over" : side === "UNDER" ? "Under" : side,
        selection_side: side, line: line === null ? null : Number(line),
        odds_at_pick: Number.isFinite(odds) ? Math.round(odds) : null,
        implied_at_pick: Number.isFinite(odds) && odds !== 0 ? Number(imp(odds).toFixed(6)) : null,
        book_at_pick: a.bestBook ?? "", confidence: a.confidence ?? null,
        confidence_tier: a.confidence >= 70 ? "high" : a.confidence >= 55 ? "medium" : "low",
        edge: a.edge ?? null, model: "claude",
      };
    });
    const { error: logErr } = await db.from("pick_log").insert(rows);
    if (logErr) console.warn(`[top5] ${sport} pick_log insert failed:`, logErr.message);
  }
  console.log(`[top5] ${sport} ok period=${periodKey} analyzed=${candidates.length} aiCalls=${aiCalls} top=${entries.length}`);
  return { sport, periodKey, analyzed: candidates.length, aiCalls, top: entries.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCron(req))) {
    console.warn("[top5] rejected: bad or missing x-cron-secret");
    return json({ error: "unauthorized" }, 401);
  }
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const sport = String(body?.sport ?? "");
  if (!ALLOWED.has(sport)) return json({ error: "sport must be one of " + [...ALLOWED].join(", ") }, 400);
  try {
    return json(await runSport(sport, body?.force === true));
  } catch (e) {
    console.error(`[top5] ${sport} failed:`, (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
