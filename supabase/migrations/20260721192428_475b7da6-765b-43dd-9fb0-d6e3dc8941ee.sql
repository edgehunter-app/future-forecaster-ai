
-- Origin column on suggestions to distinguish auto-generated wallet signals from manual saves
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';
ALTER TABLE public.suggestions
  DROP CONSTRAINT IF EXISTS suggestions_origin_check;
ALTER TABLE public.suggestions
  ADD CONSTRAINT suggestions_origin_check CHECK (origin IN ('manual','wallet_auto'));
CREATE INDEX IF NOT EXISTS suggestions_user_origin_idx ON public.suggestions(user_id, origin);

-- Dedupe cursor: latest processed activity per (user, wallet)
CREATE TABLE IF NOT EXISTS public.wallet_signal_cursors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  last_processed_trade_id text,
  last_processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, wallet_address)
);
GRANT SELECT ON public.wallet_signal_cursors TO authenticated;
GRANT ALL ON public.wallet_signal_cursors TO service_role;
ALTER TABLE public.wallet_signal_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own cursors select" ON public.wallet_signal_cursors;
CREATE POLICY "own cursors select" ON public.wallet_signal_cursors
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Log of each scan cycle
CREATE TABLE IF NOT EXISTS public.wallet_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  users_scanned int NOT NULL DEFAULT 0,
  trades_seen int NOT NULL DEFAULT 0,
  signals_created int NOT NULL DEFAULT 0,
  claude_calls int NOT NULL DEFAULT 0,
  cap_hit boolean NOT NULL DEFAULT false,
  notes text
);
GRANT SELECT ON public.wallet_scan_runs TO authenticated;
GRANT ALL ON public.wallet_scan_runs TO service_role;
ALTER TABLE public.wallet_scan_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan runs readable" ON public.wallet_scan_runs;
CREATE POLICY "scan runs readable" ON public.wallet_scan_runs
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS wallet_scan_runs_ran_at_idx ON public.wallet_scan_runs(ran_at DESC);
