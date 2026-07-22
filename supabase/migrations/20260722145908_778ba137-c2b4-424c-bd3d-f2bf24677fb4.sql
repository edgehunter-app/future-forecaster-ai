CREATE OR REPLACE FUNCTION public.grant_beta_tester_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_id uuid;
  _already boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins may grant beta tester access';
  END IF;

  SELECT id INTO _target_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;

  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'email', _email, 'error', 'User not found');
  END IF;

  SELECT is_beta_tester AND subscription_tier = 'elite' AND subscription_status = 'active'
    INTO _already
    FROM public.profiles
    WHERE id = _target_id;

  UPDATE public.profiles
     SET is_beta_tester = true,
         subscription_tier = 'elite',
         subscription_status = 'active',
         subscription_ends_at = NULL,
         is_trial = false,
         trial_started_at = NULL,
         trial_ends_at = NULL,
         updated_at = now()
   WHERE id = _target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'email', _email,
    'user_id', _target_id,
    'already', coalesce(_already, false)
  );
END;
$$;