
- Admin grant actions (grant admin / grant beta tester) run only via the admin-grant edge function with service role; DB functions take _caller_id and re-check admin. Why: no direct RPC access for anon/authenticated.
- grade-picks has no lookback limit; picks older than 3 days are scored from ESPN's free scoreboard, because the Odds API scores endpoint only covers 3 days.
- Horse racing: fetch-horse-racing serves same-day cards from horse_racing_cache (30-min fresh window) and a pg_cron job refreshes it every 30 min during US racing hours; the cron authenticates with the horse_racing_refresh row in internal_cron_secrets. Why: cards appear with zero active visitors and FormFav calls stay bounded.
- FormFav is queried at date+1 (FORMFAV_DAY_OFFSET) for date D cards, and every race is still date-checked == D, in both fetch-horse-racing and analyze-market; mismatches log an [offset] WARNING and are withheld. Why: FormFav serves one day behind.
- Cron jobs authenticate with their own row in internal_cron_secrets (grade_picks, horse_racing_refresh, scan_wallet_signals). Why: a missing row sends a null header and every run gets rejected.
