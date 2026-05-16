create table if not exists public.outcomes_log (
  id uuid primary key default gen_random_uuid(),
  fetched_at timestamptz not null default now(),
  event_key text not null,
  event_name text,
  league text,
  market_key text not null,
  market_type text not null,
  outcome_type text not null,
  participant_key text,
  participant_name text,
  modifier numeric,
  source text not null,
  category text not null,
  bookmaker text not null,
  payout numeric not null,
  american integer not null,
  implied numeric not null,
  start_time timestamptz
);

create index if not exists outcomes_log_event_market_source_idx
  on public.outcomes_log (event_key, market_key, source, fetched_at desc);

create index if not exists outcomes_log_fetched_at_idx
  on public.outcomes_log (fetched_at);

create index if not exists outcomes_log_league_fetched_idx
  on public.outcomes_log (league, fetched_at desc);

alter table public.outcomes_log enable row level security;

create policy "admins read outcomes_log"
  on public.outcomes_log
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
