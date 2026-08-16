CREATE TABLE public.pick_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'sports_analysis',
  -- event identity
  event_key text NOT NULL,
  sport_key text NOT NULL DEFAULT '',
  league text NOT NULL DEFAULT '',
  event_name text NOT NULL DEFAULT '',
  home_team text NOT NULL DEFAULT '',
  away_team text NOT NULL DEFAULT '',
  commence_time timestamptz,
  -- the pick
  bet_type text NOT NULL DEFAULT 'moneyline',
  selection text NOT NULL DEFAULT '',
  selection_side text NOT NULL DEFAULT '',
  line numeric,
  odds_at_pick integer,
  implied_at_pick numeric,
  book_at_pick text NOT NULL DEFAULT '',
  confidence integer,
  confidence_tier text NOT NULL DEFAULT '',
  edge numeric,
  model text NOT NULL DEFAULT '',
  -- grading / backfill
  closing_odds integer,
  closing_implied numeric,
  closing_line numeric,
  closing_book text,
  closing_captured_at timestamptz,
  result text,
  final_home_score integer,
  final_away_score integer,
  payout_flat_100 numeric,
  clv numeric,
  graded_at timestamptz,
  grade_notes text NOT NULL DEFAULT ''
);

CREATE INDEX pick_log_event_idx ON public.pick_log (event_key);
CREATE INDEX pick_log_pending_idx ON public.pick_log (commence_time) WHERE result IS NULL;
CREATE INDEX pick_log_picked_at_idx ON public.pick_log (picked_at DESC);

GRANT SELECT, INSERT ON public.pick_log TO authenticated;
GRANT ALL ON public.pick_log TO service_role;

ALTER TABLE public.pick_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own picks insert" ON public.pick_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own picks select" ON public.pick_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all picks" ON public.pick_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update picks" ON public.pick_log
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));