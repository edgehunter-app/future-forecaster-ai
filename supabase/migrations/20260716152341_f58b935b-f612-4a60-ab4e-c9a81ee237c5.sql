
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _protected boolean := _email IN (
    'demo@edgehunter.net',
    'mattg@lakeviewfinancial.net',
    'cgall1501@gmail.com',
    'rickg@lakeviewfinancial.net'
  );
  _now timestamptz := now();
BEGIN
  IF _protected THEN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.profiles (
      id, subscription_tier, subscription_status,
      is_trial, trial_started_at, trial_ends_at
    )
    VALUES (
      NEW.id, 'pro', 'trial',
      true, _now, _now + interval '5 days'
    )
    ON CONFLICT (id) DO UPDATE SET
      subscription_tier = EXCLUDED.subscription_tier,
      subscription_status = EXCLUDED.subscription_status,
      is_trial = EXCLUDED.is_trial,
      trial_started_at = EXCLUDED.trial_started_at,
      trial_ends_at = EXCLUDED.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$$;
