# Scan for Signals — Daily Wallet Auto-Signals

## Approach

A scheduled Supabase edge function runs once every 24h via `pg_cron` + `pg_net`. It scans every distinct Elite user's tracked wallets, pulls new Polymarket activity, dedupes against a new table, and asks Claude to convert qualifying trades into rows in the existing `suggestions` table. Elite-only visibility is enforced on the Signals page by filtering the auto-generated rows for non-Elite users.

## Data model changes (migration)

1. New table `public.wallet_signal_cursors`
   - `user_id uuid` (FK to auth.users)
   - `wallet_address text`
   - `last_processed_trade_id text` — dedupe token from Polymarket activity
   - `last_processed_at timestamptz`
   - PK: `(user_id, wallet_address)`
   - RLS: user can select own; service_role full.

2. New table `public.wallet_scan_runs`
   - `id uuid pk`, `ran_at timestamptz default now()`
   - `users_scanned int`, `trades_seen int`, `signals_created int`, `claude_calls int`, `cap_hit bool`, `notes text`
   - RLS: authenticated can select (used for "Last wallet scan: X ago"); service_role writes.

3. Extend `public.suggestions` with `source text default 'manual'` (values: `manual` | `wallet_auto`) so the Signals page can filter/label. Backfill existing rows to `'manual'`.

Grants + RLS as usual. No changes to existing suggestion policies beyond adding source column.

## Edge function: `scan-wallet-signals`

- `verify_jwt = false`, invoked by cron with a shared secret header (`X-Cron-Secret`) validated inside the function.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
- Steps:
  1. Load distinct `(user_id, wallet_address)` from `tracked_wallets` where `user_id` has Elite entitlement — join `profiles` and filter `subscription_tier = 'elite' AND subscription_status = 'active'` OR `is_beta_tester = true`. Skips free/Pro/trial users entirely (no cost for them).
  2. For each wallet, call existing `fetch-wallet-activity` logic (reuse Polymarket data-api). Fetch last ~25 trades.
  3. Read cursor from `wallet_signal_cursors`; keep only trades newer than `last_processed_trade_id` / `last_processed_at`.
  4. Group new trades by market so we don't re-analyze the same market multiple times per cycle; aggregate wallet labels per market for `walletSignals`.
  5. Global cap: `MAX_CLAUDE_CALLS_PER_RUN = 20`. Prioritize markets touched by more/higher-tier wallets. If more remain, set `cap_hit = true` and log; leave cursor un-advanced for skipped trades so they get picked up next cycle.
  6. For each selected market, call `analyze-market` (existing function) with wallet context. Threshold: `confidence >= 60 AND edge >= 0.03`. Insert into `suggestions` with `source='wallet_auto'`, 48h `expires_at`, `status='active'`, `wallet_signals` populated.
  7. Advance cursor to newest processed trade per wallet.
  8. Insert one row into `wallet_scan_runs` summarizing the cycle.

## Scheduling

Enable `pg_cron` + `pg_net`. Register a job via `supabase--insert` (not migration, per knowledge) that hits `scan-wallet-signals` daily at 12:00 UTC with the cron secret header. Add `CRON_SECRET` via `generate_secret`.

## Frontend

- `src/pages/Suggestions.tsx`
  - New hook/query for latest `wallet_scan_runs.ran_at`; render "Last wallet scan: X ago" chip (Elite only; hidden for free/Pro).
  - For non-Elite users: filter query to `source = 'manual'` so auto rows never appear. Elite users see both.
  - Optional badge on cards where `source = 'wallet_auto'` ("Smart wallet signal").
- No manual trigger button (per spec).
- `src/hooks/useSuggestionsDB.ts` extended to accept/return `source` and to gate by tier via `useSubscription().isElite`.

## Cost & safety guardrails

- Elite-only user set keeps blast radius small.
- Hard `MAX_CLAUDE_CALLS_PER_RUN = 20` per cycle across all users; overflow deferred.
- Cursor-based dedupe means a trade is never re-analyzed.
- Suggestion insert deduped by `(user_id, market_id, direction, source)` upsert to guard against replays.
- Runs logged in `wallet_scan_runs` including `cap_hit` for observability; admin panel can surface later if needed (not in this change).

## Files touched

- Migration: cursors table, runs table, `suggestions.source` column + grants/RLS.
- New edge function: `supabase/functions/scan-wallet-signals/index.ts`.
- Cron job insert via `supabase--insert`.
- Secret: `CRON_SECRET` via `generate_secret`.
- `src/pages/Suggestions.tsx`, `src/hooks/useSuggestionsDB.ts` — tier gate + last-scan chip + source label.

## Out of scope

- Manual "Scan now" button.
- Admin UI for `wallet_scan_runs` (data is queryable; UI later if needed).
- Changing existing manual save flow or scoring formulas.

Confirm and I'll build it.
