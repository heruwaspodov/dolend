create table public.client_navigation_flags (
  flag_key text primary key check (flag_key in (
    'phase2Network',
    'phase3Recommendations',
    'phase3Challenges',
    'phase3Stats'
  )),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.client_navigation_flags is
  'Public allowlisted flags for workspace menu visibility only; never an authorization boundary.';

insert into public.client_navigation_flags(flag_key, enabled) values
  ('phase2Network', false),
  ('phase3Recommendations', false),
  ('phase3Challenges', false),
  ('phase3Stats', false);

alter table public.client_navigation_flags enable row level security;
revoke all on public.client_navigation_flags from public, anon, authenticated;
grant select on public.client_navigation_flags to anon, authenticated;

create policy client_navigation_flags_read
  on public.client_navigation_flags
  for select
  to anon, authenticated
  using (true);
