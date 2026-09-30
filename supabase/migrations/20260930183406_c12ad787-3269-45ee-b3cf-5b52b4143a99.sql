CREATE TABLE public.horse_racing_cache (
  card_date date PRIMARY KEY,
  payload jsonb NOT NULL,
  meeting_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'visitor'
);
GRANT ALL ON public.horse_racing_cache TO service_role;
ALTER TABLE public.horse_racing_cache ENABLE ROW LEVEL SECURITY;