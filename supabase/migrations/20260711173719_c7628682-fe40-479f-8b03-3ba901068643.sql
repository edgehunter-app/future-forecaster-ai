
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET subscription_tier = 'elite',
    subscription_status = 'active',
    subscription_ends_at = NULL,
    is_beta_tester = true,
    stripe_subscription_id = NULL
WHERE id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'mattg@lakeviewfinancial.net',
    'cgall1501@gmail.com',
    'rickg@lakeviewfinancial.net'
  )
);
