
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bankroll numeric NOT NULL DEFAULT 5000,
  kelly_multiplier numeric NOT NULL DEFAULT 0.25,
  max_position numeric NOT NULL DEFAULT 5,
  min_confidence integer NOT NULL DEFAULT 65,
  alert_threshold integer NOT NULL DEFAULT 70,
  scan_interval text NOT NULL DEFAULT '15min',
  show_position_details boolean NOT NULL DEFAULT true,
  show_wallet_addresses boolean NOT NULL DEFAULT true,
  compact_cards boolean NOT NULL DEFAULT false,
  favorite_categories text[] NOT NULL DEFAULT '{}',
  dark_mode boolean NOT NULL DEFAULT true,
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text NOT NULL DEFAULT '',
  discord_enabled boolean NOT NULL DEFAULT false,
  discord_webhook text NOT NULL DEFAULT '',
  email_enabled boolean NOT NULL DEFAULT false,
  alert_email text NOT NULL DEFAULT '',
  email_frequency text NOT NULL DEFAULT 'every'
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tracked_wallets
CREATE TABLE public.tracked_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  address text NOT NULL,
  label text NOT NULL DEFAULT '',
  win_rate numeric NOT NULL DEFAULT 0,
  sharpe numeric NOT NULL DEFAULT 0,
  roi_30d numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  recent_trades integer NOT NULL DEFAULT 0,
  consistency numeric NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'B',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  is_auto_discovered boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, address)
);
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallets select" ON public.tracked_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own wallets insert" ON public.tracked_wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wallets update" ON public.tracked_wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own wallets delete" ON public.tracked_wallets FOR DELETE USING (auth.uid() = user_id);

-- suggestions
CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  market_id text NOT NULL,
  question text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('YES','NO')),
  current_odds numeric,
  suggested_amount numeric,
  confidence integer,
  edge numeric,
  category text NOT NULL DEFAULT 'General',
  reasoning text NOT NULL DEFAULT '',
  wallet_signals text[] NOT NULL DEFAULT '{}',
  key_signals text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','won','lost','dismissed')),
  source text NOT NULL DEFAULT 'polymarket' CHECK (source IN ('polymarket','kalshi','cross-market')),
  cross_market_edge text NOT NULL DEFAULT ''
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suggestions select" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own suggestions insert" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own suggestions update" ON public.suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own suggestions delete" ON public.suggestions FOR DELETE USING (auth.uid() = user_id);

-- markets_cache
CREATE TABLE public.markets_cache (
  id text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now(),
  question text,
  category text NOT NULL DEFAULT 'General',
  yes_price numeric,
  no_price numeric,
  volume_24h numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  end_date text NOT NULL DEFAULT '',
  trend text NOT NULL DEFAULT 'up',
  change_24h numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'polymarket'
);
ALTER TABLE public.markets_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read markets" ON public.markets_cache FOR SELECT TO authenticated USING (true);

-- alerts_log
CREATE TABLE public.alerts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES public.suggestions(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('telegram','discord','email')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  error_message text NOT NULL DEFAULT ''
);
ALTER TABLE public.alerts_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts select" ON public.alerts_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own alerts insert" ON public.alerts_log FOR INSERT WITH CHECK (auth.uid() = user_id);
