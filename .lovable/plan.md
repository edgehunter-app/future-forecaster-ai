# Migrate sports + cross-market pipeline to Sportsbook API (RapidAPI)

## Context

The Odds API (both `ODDS_API_KEY` and `ODDS_API_KEY_2`) is exhausted until June 1. Switch the sports/odds pipeline to **Sportsbook API by apidojo on RapidAPI**, which covers NFL/NBA/MLB/NHL/EPL/MLS and uniquely returns Kalshi, Polymarket, and Prophet X alongside DK/FD/MGM. One `/v0/advantages/?type=ARBITRAGE` call yields both the sports board and cross-market gaps.

Frontend pages (`Sports`, `CrossMarket`) and the `useSportsStore` / `useAppStore` shapes must keep working unchanged — the edge function adapts its output to existing types.

## Scope

- Replace `supabase/functions/fetch-sports-odds/index.ts` wholesale.
- Add `RAPID_API_KEY` secret.
- Add `api_usage` table + hard 150/day backend cap.
- Update Admin page budget card.
- Keep `fetch-kalshi-markets` and `analyze-market` untouched.
- Keep `ODDS_API_KEY*` secrets in place (greyed out in admin) as a future fallback.

Out of scope: refactoring frontend stores, deleting `fetch-kalshi-markets`, additional RapidAPI endpoints, changes to `analyze-market`.

## Step 1 — Secret

Add backend secret `RAPID_API_KEY`. Prompt user for value.

## Step 2 — `api_usage` table (migration)

```sql
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  used_at date not null default current_date,
  request_count int not null default 0,
  unique(provider, used_at)
);
alter table public.api_usage enable row level security;
-- admins read; service role writes (no public policy needed for edge fn since it uses service role)
create policy "admins read api_usage" on public.api_usage
  for select to authenticated using (has_role(auth.uid(), 'admin'));
```

## Step 3 — Rewrite `fetch-sports-odds`

Base URL `https://sportsbook-api2.p.rapidapi.com`, headers `x-rapidapi-key` + `x-rapidapi-host: sportsbook-api2.p.rapidapi.com`.

Call `/v0/advantages/?type=ARBITRAGE` once per refresh.

### Source normalization map

```ts
const SOURCE_MAP: Record<string, { bookmaker: string; category: "vegas" | "prediction_market" | "synthetic" }> = {
  DRAFT_KINGS:  { bookmaker: "draftkings",  category: "vegas" },
  FAN_DUEL:     { bookmaker: "fanduel",     category: "vegas" },
  BET_MGM:      { bookmaker: "betmgm",      category: "vegas" },
  BET_PARX:     { bookmaker: "betparx",     category: "vegas" },
  BET_RIVERS:   { bookmaker: "betrivers",   category: "vegas" },
  BOVADA:       { bookmaker: "bovada",      category: "vegas" },
  ESPN_BET:     { bookmaker: "espnbet",     category: "vegas" },
  FANATICS:     { bookmaker: "fanatics",    category: "vegas" },
  KALSHI:       { bookmaker: "kalshi",      category: "prediction_market" },
  POLYMARKET:   { bookmaker: "polymarket",  category: "prediction_market" },
  PROPHET_X:    { bookmaker: "prophetx",    category: "prediction_market" },
  KUTT:         { bookmaker: "kutt",        category: "synthetic" },
};
```
Unknown source → `{ bookmaker: source.toLowerCase(), category: "vegas" }` and `console.log("unknown source:", source)`.

### KUTT handling
- Tag KUTT outcomes `isSynthetic: true` in `FullGame` output.
- Exclude KUTT entirely from cross-market gap detection.

### Helpers
```ts
const toAmerican = (p: number) => p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
const toImplied  = (p: number) => 1 / p;
```

### League filter
Query param `sport ∈ {nfl,nba,mlb,nhl,epl,mls}` → filter on `market.event.competitionInstance.competition.shortName`. EPL matches "EPL" or "Premier League". No param = all leagues.

### Game reconstruction
Group advantages by `market.event.key` (stable). Build one `FullGame` per event preserving the shape `useSportsStore` consumes today. Collect unique outcomes across all advantages in that event, de-dup by `(market.key, source, type, participantKey, modifier)`, attach `{bookmaker, category, american, implied, isSynthetic}`.

### Cross-market gap detection
1. Flatten outcomes across all advantages.
2. Drop KUTT.
3. Group by `(event.key, market.key, market.type, outcome.type, participantKey, modifier)` — `participantKey` is null for POINT_TOTAL, that's expected.
4. Per group split by `category` (vegas vs prediction_market). Emit gap only if both non-empty.
5. Vegas side: single highest-payout outcome.
6. Prediction side: array of all, sorted by payout desc.
7. `edgePct = (vegasBest.implied - predictionMarkets[0].implied) * 100`.
8. Sort final list by `Math.abs(edgePct)` desc.

```ts
type CrossMarketGap = {
  id: string; // `${event.key}:${market.key}:${outcomeType}:${participantKey ?? "total"}:${modifier}`
  eventKey: string;
  eventName: string;
  league: string;
  marketType: "MONEYLINE" | "POINT_SPREAD" | "POINT_TOTAL";
  outcomeType: "WIN" | "OVER" | "UNDER";
  participant: string | null;
  modifier: number | null;
  predictionMarkets: Array<{ source: string; payout: number; american: number; implied: number }>;
  vegasBest:           { source: string; payout: number; american: number; implied: number };
  edgePct: number;
  startTime: string;
};
```

If existing frontend `CrossMarketOpp` shape differs, the edge function adapts to whatever the page consumes; the type above is the ideal target. Existing `useCrossMarket` reads `crossMarketOpps` from the store, so the edge fn output also flows into that store in a compatible adapter.

### Response shape
```ts
{
  games: FullGame[],
  crossMarketGaps: CrossMarketGap[],
  meta: {
    source: "sportsbook-api",
    fetchedAt: string,
    requestsUsedToday: number,
    dailyLimit: 150,
    uniqueEventsReturned: number,
  }
}
```
Log `uniqueEventsReturned` every call.

### Backend daily cap
- Pre-call: read `api_usage` for `provider='rapidapi-sportsbook'` + today. If `request_count >= 150` → return 429 `{ error, resetsAt }`.
- Post-call success: upsert-increment counter.
- Log every RapidAPI response status to console.

## Step 4 — Admin page

Update `/admin` budget card:
- New row: "Sportsbook API (RapidAPI)" — used today / 150, threshold-colored bar (<60% green, 60–85% amber, >85% red), "Resets at 00:00 UTC".
- Grey out existing The Odds API rows with note "Exhausted — resets June 1".
- Add configurable "Refresh interval" setting (default 10 min, options 5/10/15/30 min). Stored in `useAppStore.settings` (or extension of profile if needed). At 10 min = ~144 calls/day max.

## Step 5 — Sanity checks
- Sports page renders games without frontend changes.
- Cross-market shows ~10–20 gaps (not 300+).
- Each gap pairs ≥1 Kalshi/Polymarket/Prophet X price vs ≥1 Vegas book.
- No KUTT in gaps.
- POINT_TOTAL gaps render with `participant: null` and no team name.
- Demo mode still bypasses live calls.
- `useIsAdmin()` gating untouched.

## Not doing
- No refactor of `useSportsStore` or frontend stores.
- No changes to `analyze-market`.
- No deletion of `fetch-kalshi-markets`.
- No additional RapidAPI endpoints (`/v0/odds/`, `/v0/games/`) — follow-up.
- No hardcoded keys anywhere.

## Risks / notes
- Existing `OddsGame`/`FullGame` types in `src/lib/oddsApi.ts` shape the contract — I'll read them precisely before writing the adapter and adjust the edge fn to match field-for-field rather than touch frontend.
- `CrossMarketGap` shape differs from current `CrossMarketOpp` (which references `polymarket`/`kalshi` `Market` objects). I'll bridge in the edge fn by either (a) producing both shapes or (b) producing the new shape and patching `useCrossMarket`'s reducer minimally to consume it — the lighter option chosen after reading the page.
- 150/day hard cap means several quick manual refreshes can lock the day; that's the user's stated intent.
