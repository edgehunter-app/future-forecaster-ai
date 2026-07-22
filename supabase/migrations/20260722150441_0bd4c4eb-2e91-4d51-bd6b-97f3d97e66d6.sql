
CREATE TABLE IF NOT EXISTS public.beta_tester_allowlist (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.beta_tester_allowlist TO authenticated;
GRANT ALL ON public.beta_tester_allowlist TO service_role;

ALTER TABLE public.beta_tester_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage beta allowlist"
  ON public.beta_tester_allowlist
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.beta_tester_allowlist (email) VALUES
  ('bry9477@msn.com'),
  ('cameronjdownie@gmail.com'),
  ('dbaldrica@bargreen.com'),
  ('devonjdownie@gmail.com'),
  ('ephilp@msn.com'),
  ('idalowe1079@gmail.com'),
  ('jbdownie@gmail.com'),
  ('roniw@lakeviewfinancial.net'),
  ('roniwheaton@gmail.com'),
  ('ryanfuger416@gmail.com'),
  ('teresa_gallegos@rocketmail.com'),
  ('tomaswheaton@gmail.com'),
  ('tonyg@lakeviewfinancial.net')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _protected boolean := _email IN (
    'demo@edgehunter.net',
    'mattg@lakeviewfinancial.net',
    'cgall1501@gmail.com',
    'rickg@lakeviewfinancial.net'
  );
  _allowlisted boolean := EXISTS (
    SELECT 1 FROM public.beta_tester_allowlist
    WHERE lower(email) = _email
  );
BEGIN
  IF _protected THEN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  ELSIF _allowlisted THEN
    INSERT INTO public.profiles (
      id, subscription_tier, subscription_status,
      is_beta_tester, is_trial, trial_started_at, trial_ends_at,
      subscription_ends_at
    )
    VALUES (
      NEW.id, 'elite', 'active',
      true, false, NULL, NULL, NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      subscription_tier = 'elite',
      subscription_status = 'active',
      is_beta_tester = true,
      is_trial = false,
      trial_started_at = NULL,
      trial_ends_at = NULL,
      subscription_ends_at = NULL,
      updated_at = now();
  ELSE
    INSERT INTO public.profiles (
      id, subscription_tier, subscription_status,
      is_trial, trial_started_at, trial_ends_at
    )
    VALUES (
      NEW.id, 'free', 'inactive',
      false, NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Upgrade any of these emails that already signed up
UPDATE public.profiles p
   SET is_beta_tester = true,
       subscription_tier = 'elite',
       subscription_status = 'active',
       is_trial = false,
       trial_started_at = NULL,
       trial_ends_at = NULL,
       subscription_ends_at = NULL,
       updated_at = now()
  FROM auth.users u
  JOIN public.beta_tester_allowlist a
    ON lower(a.email) = lower(u.email)
 WHERE p.id = u.id;
