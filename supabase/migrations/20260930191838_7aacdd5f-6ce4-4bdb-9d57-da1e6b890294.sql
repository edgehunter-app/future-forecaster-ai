DROP POLICY IF EXISTS "Signed-in users write own top5" ON public.top5_cache;
DROP POLICY IF EXISTS "Signed-in users refresh top5" ON public.top5_cache;
REVOKE INSERT, UPDATE ON public.top5_cache FROM authenticated;
INSERT INTO public.internal_cron_secrets (name, value)
VALUES ('scheduled_top5', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;