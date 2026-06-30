CREATE TABLE IF NOT EXISTS public._admin_lookup (
  key text PRIMARY KEY,
  value jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public._admin_lookup FROM anon, authenticated;

INSERT INTO public._admin_lookup(key, value, checked_at)
SELECT 'cgall1501@gmail.com',
       jsonb_build_object(
         'id', u.id,
         'email', u.email,
         'email_confirmed_at', u.email_confirmed_at,
         'confirmed_at', u.confirmed_at,
         'created_at', u.created_at,
         'last_sign_in_at', u.last_sign_in_at
       ),
       now()
FROM auth.users u
WHERE lower(u.email) = lower('cgall1501@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, checked_at = now();

-- Also record a 'not found' sentinel if no row matched
INSERT INTO public._admin_lookup(key, value, checked_at)
SELECT 'cgall1501@gmail.com', jsonb_build_object('found', false), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower('cgall1501@gmail.com'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, checked_at = now();