select cron.schedule(
  'grade-picks-every-3h',
  '20 */3 * * *',
  $$
  select net.http_post(
    url := 'https://zgdcnuamxvziqpnqkiab.supabase.co/functions/v1/grade-picks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_cron_secrets where name = 'CRON_SECRET')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);