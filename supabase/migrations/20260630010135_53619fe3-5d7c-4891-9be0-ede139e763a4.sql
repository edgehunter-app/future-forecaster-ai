ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS opening_odds INTEGER,
  ADD COLUMN IF NOT EXISTS current_odds INTEGER,
  ADD COLUMN IF NOT EXISTS opening_line NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS current_line NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS line_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_line_check TIMESTAMPTZ;

-- Backfill opening_odds for existing pending bets
UPDATE public.bets SET opening_odds = odds WHERE opening_odds IS NULL;
UPDATE public.bets SET current_odds = odds WHERE current_odds IS NULL;