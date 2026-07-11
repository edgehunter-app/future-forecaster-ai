CREATE TABLE IF NOT EXISTS public.golf_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

GRANT ALL ON public.golf_cache TO service_role;

ALTER TABLE public.golf_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view golf cache"
ON public.golf_cache
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));