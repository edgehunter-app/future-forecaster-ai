
CREATE TABLE public.wallet_scan_run_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.wallet_scan_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  trades_seen INTEGER NOT NULL DEFAULT 0,
  buckets_generated INTEGER NOT NULL DEFAULT 0,
  buckets_selected INTEGER NOT NULL DEFAULT 0,
  signals_created INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_scan_run_users_run ON public.wallet_scan_run_users(run_id);
CREATE INDEX idx_wallet_scan_run_users_user ON public.wallet_scan_run_users(user_id);

GRANT SELECT ON public.wallet_scan_run_users TO authenticated;
GRANT ALL ON public.wallet_scan_run_users TO service_role;

ALTER TABLE public.wallet_scan_run_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all scan run user breakdowns"
  ON public.wallet_scan_run_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
