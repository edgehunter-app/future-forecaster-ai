create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  used_at date not null default current_date,
  request_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, used_at)
);

alter table public.api_usage enable row level security;

create policy "admins read api_usage"
  on public.api_usage for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger api_usage_set_updated_at
  before update on public.api_usage
  for each row execute function public.set_updated_at();