
- Admin grant actions (grant admin / grant beta tester) run only via the admin-grant edge function with service role; DB functions take _caller_id and re-check admin. Why: no direct RPC access for anon/authenticated.
- grade-picks has no lookback limit; picks older than 3 days are scored from ESPN's free scoreboard, because the Odds API scores endpoint only covers 3 days.
