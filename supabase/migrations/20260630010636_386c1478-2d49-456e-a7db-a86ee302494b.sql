DO $$
DECLARE
  v_id uuid;
  v_confirmed timestamptz;
BEGIN
  SELECT id, email_confirmed_at INTO v_id, v_confirmed
  FROM auth.users
  WHERE lower(email) = lower('cgall1501@gmail.com')
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'No user found for cgall1501@gmail.com';
  ELSIF v_confirmed IS NOT NULL THEN
    RAISE NOTICE 'User % already confirmed at %', v_id, v_confirmed;
  ELSE
    UPDATE auth.users
    SET email_confirmed_at = now(),
        confirmed_at = COALESCE(confirmed_at, now())
    WHERE id = v_id;
    RAISE NOTICE 'Confirmed user %', v_id;
  END IF;
END $$;