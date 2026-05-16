create or replace function public.outcomes_log_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'total_rows', (select count(*) from public.outcomes_log),
    'earliest', (select min(fetched_at) from public.outcomes_log),
    'latest', (select max(fetched_at) from public.outcomes_log),
    'unique_events_24h', (
      select count(distinct event_key)
      from public.outcomes_log
      where fetched_at > now() - interval '24 hours'
    ),
    'unique_sources_24h', (
      select count(distinct source)
      from public.outcomes_log
      where fetched_at > now() - interval '24 hours'
    ),
    'sources_24h', (
      select coalesce(jsonb_agg(distinct source order by source), '[]'::jsonb)
      from public.outcomes_log
      where fetched_at > now() - interval '24 hours'
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.outcomes_log_stats() from public, anon;
grant execute on function public.outcomes_log_stats() to authenticated;
