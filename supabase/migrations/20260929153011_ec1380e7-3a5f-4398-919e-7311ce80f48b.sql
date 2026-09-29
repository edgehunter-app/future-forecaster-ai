CREATE TABLE public.top5_cache (
  sport_key text NOT NULL,
  period_key text NOT NULL,
  payload jsonb NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sport_key, period_key)
);
GRANT SELECT, INSERT, UPDATE ON public.top5_cache TO authenticated;
GRANT ALL ON public.top5_cache TO service_role;
ALTER TABLE public.top5_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read top5" ON public.top5_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users write own top5" ON public.top5_cache FOR INSERT TO authenticated WITH CHECK (scanned_by = auth.uid());
CREATE POLICY "Signed-in users refresh top5" ON public.top5_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (scanned_by = auth.uid());
CREATE TRIGGER top5_cache_updated_at BEFORE UPDATE ON public.top5_cache FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();