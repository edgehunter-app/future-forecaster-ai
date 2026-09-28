ALTER TABLE public.beta_tester_allowlist ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _protected boolean := _email IN ('demo@edgehunter.net','mattg@lakeviewfinancial.net','cgall1501@gmail.com','rickg@lakeviewfinancial.net');
  _allowlisted boolean := EXISTS (
    SELECT 1 FROM public.beta_tester_allowlist
    WHERE lower(email) = _email AND (expires_at IS NULL OR expires_at > now())
  );
BEGIN
  IF _protected THEN
    INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  ELSIF _allowlisted THEN
    INSERT INTO public.profiles (id, subscription_tier, subscription_status, is_beta_tester, is_trial, trial_started_at, trial_ends_at, subscription_ends_at)
    VALUES (NEW.id, 'elite', 'active', true, false, NULL, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET subscription_tier='elite', subscription_status='active', is_beta_tester=true,
      is_trial=false, trial_started_at=NULL, trial_ends_at=NULL, subscription_ends_at=NULL, updated_at=now();
  ELSE
    INSERT INTO public.profiles (id, subscription_tier, subscription_status, is_trial, trial_started_at, trial_ends_at)
    VALUES (NEW.id, 'free', 'inactive', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Revoke Elite bypass for users whose allowlist entry has expired (skips anyone with a real Stripe subscription).
CREATE OR REPLACE FUNCTION public.expire_beta_testers()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  UPDATE public.profiles p
     SET is_beta_tester = false, subscription_tier = 'free', subscription_status = 'inactive', updated_at = now()
    FROM auth.users u, public.beta_tester_allowlist a
   WHERE u.id = p.id AND lower(a.email) = lower(u.email)
     AND a.expires_at IS NOT NULL AND a.expires_at <= now()
     AND p.is_beta_tester = true AND p.stripe_subscription_id IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.expire_beta_testers() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('expire-beta-testers', '0 * * * *', 'SELECT public.expire_beta_testers()');