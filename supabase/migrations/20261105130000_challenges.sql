create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check(length(trim(title)) between 1 and 120),
  description text not null default '' check(length(description)<=2000),
  status text not null default 'open' check(status in ('open','closed','cancelled')),
  metric text not null default 'attended_events' check(metric='attended_events'),
  target integer not null check(target between 1 and 10000),
  starts_on date not null,
  ends_on date not null,
  timezone text not null,
  eligibility jsonb not null default '{}'::jsonb check(jsonb_typeof(eligibility)='object'),
  rule_version integer not null default 1 check(rule_version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on>=starts_on),
  check(ends_on-starts_on<=365)
);
create index challenges_discovery_idx on public.challenges(status,starts_on,ends_on,id);

create table public.challenge_rule_versions (
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  version integer not null check(version>0),
  rules jsonb not null check(jsonb_typeof(rules)='object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(challenge_id,version)
);
create table public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'joined' check(status in ('joined','withdrawn')),
  progress integer not null default 0 check(progress>=0),
  completed_at timestamptz,
  joined_at timestamptz not null default now(),
  recalculated_at timestamptz,
  primary key(challenge_id,profile_id)
);
create index challenge_members_profile_idx on public.challenge_members(profile_id,challenge_id);
create index challenge_members_rebuild_idx on public.challenge_members(challenge_id,profile_id) where status='joined';
create table public.challenge_progress_jobs (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','processing','done')),
  attempts integer not null default 0 check(attempts>=0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  unique(challenge_id,profile_id)
);
create index challenge_progress_jobs_ready_idx on public.challenge_progress_jobs(status,available_at,id);
alter table public.challenges enable row level security;
alter table public.challenge_rule_versions enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_progress_jobs enable row level security;
revoke all on public.challenges,public.challenge_rule_versions,public.challenge_members,public.challenge_progress_jobs from public,anon,authenticated;
grant all on public.challenges,public.challenge_rule_versions,public.challenge_members,public.challenge_progress_jobs to service_role;

create function dolend_private.enqueue_challenge_progress(p_profile uuid,p_event uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  insert into public.challenge_progress_jobs(challenge_id,profile_id)
  select c.id,p_profile from public.challenges c join public.challenge_members m on m.challenge_id=c.id and m.profile_id=p_profile and m.status='joined'
  join public.events e on e.id=p_event
  where c.status='open' and e.starts_at>=(c.starts_on::timestamp at time zone c.timezone) and e.starts_at<((c.ends_on+1)::timestamp at time zone c.timezone)
  on conflict(challenge_id,profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

create function dolend_private.enqueue_challenge_participant_job()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_profile uuid;
begin
  select p.id into v_profile from public.profiles p where p.user_id=coalesce(new.user_id,old.user_id);
  if v_profile is not null then perform dolend_private.enqueue_challenge_progress(v_profile,coalesce(new.event_id,old.event_id)); end if;
  return coalesce(new,old);
end; $$;

create function dolend_private.enqueue_challenge_event_jobs()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  for r in select p.id profile_id from public.event_participants ep join public.profiles p on p.user_id=ep.user_id where ep.event_id=new.id and ep.status='attended' loop
    perform dolend_private.enqueue_challenge_progress(r.profile_id,new.id);
  end loop;
  return new;
end; $$;

create trigger challenge_progress_attendance_change after insert or update of status,attendance_at on public.event_participants
for each row execute function dolend_private.enqueue_challenge_participant_job();
create trigger challenge_progress_event_status_change after update of status on public.events
for each row when(old.status is distinct from new.status) execute function dolend_private.enqueue_challenge_event_jobs();

create function dolend_private.refresh_challenge_member(p_challenge uuid,p_profile uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges; v_progress integer;
begin
  select * into c from public.challenges where id=p_challenge;
  if not found then return; end if;
  select count(distinct e.id)::integer into v_progress
  from public.event_participants ep join public.profiles p on p.user_id=ep.user_id join public.events e on e.id=ep.event_id
  where p.id=p_profile and ep.status='attended' and ep.attendance_at is not null and e.status='completed'
    and e.starts_at>=(c.starts_on::timestamp at time zone c.timezone) and e.starts_at<((c.ends_on+1)::timestamp at time zone c.timezone);
  update public.challenge_members set progress=v_progress,
    completed_at=case when v_progress>=c.target then coalesce(completed_at,now()) else null end,
    recalculated_at=now()
  where challenge_id=c.id and profile_id=p_profile and status='joined';
end; $$;

create function public.create_challenge(p_actor uuid,p_title text,p_description text,p_target integer,p_starts_on date,p_ends_on date,p_timezone text,p_eligibility jsonb default '{}'::jsonb)
returns public.challenges language plpgsql security definer set search_path='' as $$
declare v_challenge public.challenges;
begin
  if p_title is null or length(trim(p_title)) not between 1 and 120 or length(coalesce(p_description,''))>2000
    or p_target not between 1 and 10000 or p_starts_on is null or p_ends_on is null
    or p_ends_on<p_starts_on or p_ends_on-p_starts_on>365
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone)
    or jsonb_typeof(coalesce(p_eligibility,'{}'::jsonb))<>'object'
    or (coalesce(p_eligibility,'{}'::jsonb)-'minimum_account_age_days')<>'{}'::jsonb
    or coalesce((p_eligibility->>'minimum_account_age_days')::integer,0) not between 0 and 3650 then
    raise exception 'INVALID_CHALLENGE_RULES';
  end if;
  insert into public.challenges(owner_profile_id,title,description,target,starts_on,ends_on,timezone,eligibility)
  values(p_actor,trim(p_title),coalesce(p_description,''),p_target,p_starts_on,p_ends_on,p_timezone,coalesce(p_eligibility,'{}'::jsonb)) returning * into v_challenge;
  insert into public.challenge_rule_versions(challenge_id,version,rules,created_by)
  values(v_challenge.id,v_challenge.rule_version,jsonb_build_object('title',v_challenge.title,'description',v_challenge.description,'metric',v_challenge.metric,'target',v_challenge.target,'starts_on',v_challenge.starts_on,'ends_on',v_challenge.ends_on,'timezone',v_challenge.timezone,'eligibility',v_challenge.eligibility),p_actor);
  return v_challenge;
end; $$;

create function public.update_challenge(p_actor uuid,p_challenge uuid,p_expected_version integer,p_title text,p_description text,p_target integer,p_starts_on date,p_ends_on date,p_timezone text,p_eligibility jsonb default '{}')
returns public.challenges language plpgsql security definer set search_path='' as $$
declare c public.challenges;
begin
  if p_title is null or length(trim(p_title)) not between 1 and 120 or length(coalesce(p_description,''))>2000
    or p_target not between 1 and 10000 or p_starts_on is null or p_ends_on is null
    or p_ends_on<p_starts_on or p_ends_on-p_starts_on>365
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone)
    or jsonb_typeof(coalesce(p_eligibility,'{}'::jsonb))<>'object'
    or (coalesce(p_eligibility,'{}'::jsonb)-'minimum_account_age_days')<>'{}'::jsonb
    or coalesce((p_eligibility->>'minimum_account_age_days')::integer,0) not between 0 and 3650 then
    raise exception 'INVALID_CHALLENGE_RULES';
  end if;
  select * into c from public.challenges where id=p_challenge for update;
  if not found then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  if c.owner_profile_id<>p_actor then raise exception 'CHALLENGE_OWNER_REQUIRED'; end if;
  if c.status<>'open' then raise exception 'CHALLENGE_CLOSED'; end if;
  if c.rule_version<>p_expected_version then raise exception 'CHALLENGE_VERSION_CONFLICT'; end if;
  update public.challenges set title=trim(p_title),description=coalesce(p_description,''),target=p_target,starts_on=p_starts_on,ends_on=p_ends_on,timezone=p_timezone,eligibility=coalesce(p_eligibility,'{}'::jsonb),rule_version=rule_version+1,updated_at=now()
  where id=p_challenge returning * into c;
  insert into public.challenge_rule_versions(challenge_id,version,rules,created_by)
  values(c.id,c.rule_version,jsonb_build_object('title',c.title,'description',c.description,'metric',c.metric,'target',c.target,'starts_on',c.starts_on,'ends_on',c.ends_on,'timezone',c.timezone,'eligibility',c.eligibility),p_actor);
  insert into public.challenge_progress_jobs(challenge_id,profile_id)
  select challenge_id,profile_id from public.challenge_members where challenge_id=c.id and status='joined'
  on conflict(challenge_id,profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
  return c;
end; $$;

create function public.get_challenges(p_actor uuid,p_limit integer default 20,p_before uuid default null)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'owner_profile_id',c.owner_profile_id,'title',c.title,'description',c.description,'status',c.status,'metric',c.metric,'target',c.target,'starts_on',c.starts_on,'ends_on',c.ends_on,'timezone',c.timezone,'rule_version',c.rule_version,'joined',m.status='joined','progress',case when m.status='joined' then m.progress else null end,'completed_at',case when m.status='joined' then m.completed_at else null end)
  from public.challenges c left join public.challenge_members m on m.challenge_id=c.id and m.profile_id=p_actor
  where c.status='open' and (p_before is null or c.id>p_before)
  order by c.id limit least(greatest(coalesce(p_limit,20),1),50);
$$;

create function public.join_challenge(p_actor uuid,p_challenge uuid)
returns public.challenge_members language plpgsql security definer set search_path='' as $$
declare c public.challenges; v_age integer;
begin
  select * into c from public.challenges where id=p_challenge for update;
  if not found or c.status<>'open' or ((c.ends_on+1)::timestamp at time zone c.timezone)<=now() then raise exception 'CHALLENGE_CLOSED'; end if;
  select floor(extract(epoch from (now()-p.created_at))/86400)::integer into v_age from public.profiles p where p.id=p_actor;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_age<coalesce((c.eligibility->>'minimum_account_age_days')::integer,0) then raise exception 'CHALLENGE_INELIGIBLE'; end if;
  insert into public.challenge_members(challenge_id,profile_id) values(c.id,p_actor) on conflict(challenge_id,profile_id) do update set status='joined',joined_at=coalesce(public.challenge_members.joined_at,now());
  insert into public.challenge_progress_jobs(challenge_id,profile_id) values(c.id,p_actor) on conflict(challenge_id,profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
  return (select m from public.challenge_members m where m.challenge_id=c.id and m.profile_id=p_actor);
end; $$;

create function public.leave_challenge(p_actor uuid,p_challenge uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.challenge_members set status='withdrawn' where challenge_id=p_challenge and profile_id=p_actor and status='joined';
  return found;
end; $$;

create function public.get_challenge_progress(p_actor uuid,p_challenge uuid)
returns public.challenge_members language sql stable security definer set search_path='' as $$
  select m from public.challenge_members m where m.challenge_id=p_challenge and m.profile_id=p_actor and m.status='joined';
$$;

create function public.rebuild_challenge_progress(p_challenge uuid,p_after_profile uuid default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.challenges; m record; v_start timestamptz; v_end timestamptz; v_progress integer; v_count integer:=0; v_last uuid;
begin
  if p_limit not between 1 and 200 then raise exception 'INVALID_BATCH_SIZE'; end if;
  select * into c from public.challenges where id=p_challenge;
  if not found then raise exception 'CHALLENGE_NOT_FOUND'; end if;
  v_start:=c.starts_on::timestamp at time zone c.timezone;
  v_end:=(c.ends_on+1)::timestamp at time zone c.timezone;
  for m in select profile_id from public.challenge_members where challenge_id=c.id and status='joined' and (p_after_profile is null or profile_id>p_after_profile) order by profile_id limit p_limit loop
    perform dolend_private.refresh_challenge_member(c.id,m.profile_id);
    v_count:=v_count+1; v_last:=m.profile_id;
  end loop;
  return jsonb_build_object('processed',v_count,'next_after',v_last,'done',v_count<p_limit);
end; $$;

create function public.close_expired_challenges(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_limit not between 1 and 200 then raise exception 'INVALID_BATCH_SIZE'; end if;
  with target as (select id from public.challenges where status='open' and ((ends_on+1)::timestamp at time zone timezone)<=now() order by ends_on,id limit p_limit for update skip locked)
  update public.challenges c set status='closed',updated_at=now() from target t where c.id=t.id;
  get diagnostics v_count=row_count; return v_count;
end; $$;

create function public.run_challenge_maintenance(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; v_processed integer:=0; v_closed integer;
begin
  if p_limit not between 1 and 200 then raise exception 'INVALID_BATCH_SIZE'; end if;
  for j in select id,challenge_id,profile_id from public.challenge_progress_jobs
    where status in ('pending','processing') and available_at<=now() and (locked_until is null or locked_until<=now())
    order by id limit p_limit for update skip locked
  loop
    update public.challenge_progress_jobs set status='processing',locked_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() where id=j.id;
    perform dolend_private.refresh_challenge_member(j.challenge_id,j.profile_id);
    update public.challenge_progress_jobs set status='done',locked_until=null,updated_at=now() where id=j.id;
    v_processed:=v_processed+1;
  end loop;
  v_closed:=public.close_expired_challenges(p_limit);
  return jsonb_build_object('processed',v_processed,'closed',v_closed);
end; $$;

revoke all on function public.create_challenge(uuid,text,text,integer,date,date,text,jsonb),public.update_challenge(uuid,uuid,integer,text,text,integer,date,date,text,jsonb),public.get_challenges(uuid,integer,uuid),public.join_challenge(uuid,uuid),public.leave_challenge(uuid,uuid),public.get_challenge_progress(uuid,uuid),public.rebuild_challenge_progress(uuid,uuid,integer),public.close_expired_challenges(integer),public.run_challenge_maintenance(integer),dolend_private.enqueue_challenge_progress(uuid,uuid),dolend_private.enqueue_challenge_participant_job(),dolend_private.enqueue_challenge_event_jobs(),dolend_private.refresh_challenge_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_challenge(uuid,text,text,integer,date,date,text,jsonb),public.update_challenge(uuid,uuid,integer,text,text,integer,date,date,text,jsonb),public.get_challenges(uuid,integer,uuid),public.join_challenge(uuid,uuid),public.leave_challenge(uuid,uuid),public.get_challenge_progress(uuid,uuid),public.rebuild_challenge_progress(uuid,uuid,integer),public.close_expired_challenges(integer),public.run_challenge_maintenance(integer) to service_role;
