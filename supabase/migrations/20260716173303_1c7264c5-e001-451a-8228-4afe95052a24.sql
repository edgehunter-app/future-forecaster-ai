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
      NEW.id, 'free', 'inactive',
      false, NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;