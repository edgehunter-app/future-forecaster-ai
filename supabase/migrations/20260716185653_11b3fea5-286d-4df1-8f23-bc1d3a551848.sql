DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'money200065@yahoo.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    DELETE FROM public.bets WHERE user_id = _uid;
    DELETE FROM public.user_roles WHERE user_id = _uid;
    DELETE FROM public.suggestions WHERE user_id = _uid;
    DELETE FROM public.tracked_wallets WHERE user_id = _uid;
    DELETE FROM public.profiles WHERE id = _uid;
    DELETE FROM auth.users WHERE id = _uid;
  END IF;
END $$;