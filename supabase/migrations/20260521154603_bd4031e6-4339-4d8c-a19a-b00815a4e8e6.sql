CREATE TABLE IF NOT EXISTS public.bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'General',
  bet_type TEXT NOT NULL DEFAULT 'moneyline',
  pick TEXT NOT NULL,
  odds INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  sportsbook TEXT DEFAULT 'Other',
  suggestion_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'push', 'void')),
  profit_loss NUMERIC(10,2) DEFAULT 0,
  game_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bets select" ON public.bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own bets insert" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bets update" ON public.bets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own bets delete" ON public.bets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bets_user_id_idx ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS bets_status_idx ON public.bets(status);
CREATE INDEX IF NOT EXISTS bets_created_at_idx ON public.bets(created_at DESC);

CREATE TRIGGER bets_updated_at
  BEFORE UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();