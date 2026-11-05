create table public.stats_metric_definitions (
  metric_key text not null,
  rule_version integer not null check (rule_version > 0),
  label text not null,
  source_kind text not null check (source_kind in ('verified','self_reported')),
  source_table text not null,
  created_at timestamptz not null default now(),
  primary key (metric_key, rule_version)
);
alter table public.stats_metric_definitions enable row level security;
revoke all on public.stats_metric_definitions from public, anon, authenticated;
grant select on public.stats_metric_definitions to service_role;

insert into public.stats_metric_definitions(metric_key,rule_version,label,source_kind,source_table) values
  ('events_attended',1,'Event dihadiri','verified','event_participants'),
  ('activities_shared',1,'Aktivitas dibagikan','self_reported','activities');

create table public.profile_stats (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  metric_key text not null,
  rule_version integer not null,
  period_start date not null,
  period_days integer not null check (period_days between 1 and 366),
  timezone text not null,
  metric_value bigint not null check (metric_value >= 0),
  computed_at timestamptz not null default now(),
  primary key(profile_id,metric_key,rule_version,period_start,period_days),
  foreign key(metric_key,rule_version) references public.stats_metric_definitions(metric_key,rule_version) on delete restrict
);
create index profile_stats_period_idx on public.profile_stats(profile_id,period_start desc,metric_key);
alter table public.profile_stats enable row level security;
revoke all on public.profile_stats from public, anon, authenticated;
grant all on public.profile_stats to service_role;

create function public.rebuild_profile_stats(p_profile uuid,p_period_start date,p_period_days integer default 7)
returns void language plpgsql security definer set search_path='' as $$
declare v_timezone text; v_start timestamptz; v_end timestamptz;
begin
  if p_period_days not between 1 and 366 then raise exception 'INVALID_STATS_PERIOD'; end if;
  select default_timezone into strict v_timezone from public.profiles where id=p_profile;
  v_start := p_period_start::timestamp at time zone v_timezone;
  v_end := (p_period_start+p_period_days)::timestamp at time zone v_timezone;

  insert into public.profile_stats(profile_id,metric_key,rule_version,period_start,period_days,timezone,metric_value,computed_at)
  select p_profile,'events_attended',1,p_period_start,p_period_days,v_timezone,count(*)::bigint,clock_timestamp()
  from public.event_participants ep
  join public.events e on e.id=ep.event_id and e.status='completed'
  join public.profiles pr on pr.user_id=ep.user_id and pr.id=p_profile
  where ep.status='attended' and ep.attendance_at>=v_start and ep.attendance_at<v_end
  on conflict(profile_id,metric_key,rule_version,period_start,period_days)
  do update set timezone=excluded.timezone,metric_value=excluded.metric_value,computed_at=excluded.computed_at;

  insert into public.profile_stats(profile_id,metric_key,rule_version,period_start,period_days,timezone,metric_value,computed_at)
  select p_profile,'activities_shared',1,p_period_start,p_period_days,v_timezone,count(*)::bigint,clock_timestamp()
  from public.activities a
  where a.author_profile_id=p_profile and a.deleted_at is null and a.created_at>=v_start and a.created_at<v_end
  on conflict(profile_id,metric_key,rule_version,period_start,period_days)
  do update set timezone=excluded.timezone,metric_value=excluded.metric_value,computed_at=excluded.computed_at;
end; $$;

create function public.get_profile_stats(p_profile uuid,p_period_start date,p_period_days integer default 7)
returns table(metric_key text,rule_version integer,label text,source_kind text,metric_value bigint,period_start date,period_days integer,timezone text,computed_at timestamptz)
language sql stable security definer set search_path='' as $$
  select s.metric_key,s.rule_version,d.label,d.source_kind,s.metric_value,s.period_start,s.period_days,s.timezone,s.computed_at
  from public.profile_stats s
  join public.stats_metric_definitions d using(metric_key,rule_version)
  where s.profile_id=p_profile and s.period_start=p_period_start and s.period_days=p_period_days
  order by s.metric_key;
$$;

revoke all on function public.rebuild_profile_stats(uuid,date,integer),public.get_profile_stats(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.rebuild_profile_stats(uuid,date,integer),public.get_profile_stats(uuid,date,integer) to service_role;
