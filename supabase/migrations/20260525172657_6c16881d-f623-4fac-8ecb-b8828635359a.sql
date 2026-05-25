
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "own profile delete" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "own bets select" ON public.bets;
DROP POLICY IF EXISTS "own bets insert" ON public.bets;
DROP POLICY IF EXISTS "own bets update" ON public.bets;
DROP POLICY IF EXISTS "own bets delete" ON public.bets;
CREATE POLICY "own bets select" ON public.bets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bets insert" ON public.bets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bets update" ON public.bets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bets delete" ON public.bets FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own suggestions select" ON public.suggestions;
DROP POLICY IF EXISTS "own suggestions insert" ON public.suggestions;
DROP POLICY IF EXISTS "own suggestions update" ON public.suggestions;
DROP POLICY IF EXISTS "own suggestions delete" ON public.suggestions;
CREATE POLICY "own suggestions select" ON public.suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own suggestions insert" ON public.suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own suggestions update" ON public.suggestions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own suggestions delete" ON public.suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own alerts select" ON public.alerts_log;
DROP POLICY IF EXISTS "own alerts insert" ON public.alerts_log;
CREATE POLICY "own alerts select" ON public.alerts_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own alerts insert" ON public.alerts_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own wallets select" ON public.tracked_wallets;
DROP POLICY IF EXISTS "own wallets insert" ON public.tracked_wallets;
DROP POLICY IF EXISTS "own wallets update" ON public.tracked_wallets;
DROP POLICY IF EXISTS "own wallets delete" ON public.tracked_wallets;
CREATE POLICY "own wallets select" ON public.tracked_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own wallets insert" ON public.tracked_wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wallets update" ON public.tracked_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own wallets delete" ON public.tracked_wallets FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
