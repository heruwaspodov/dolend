create table public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[a-z][a-z0-9_]{2,59}$'),
  title text not null check(length(trim(title)) between 1 and 100),
  description text not null default '' check(length(description)<=500),
  metric text not null default 'attended_events' check(metric='attended_events'),
  threshold integer not null check(threshold between 1 and 100000),
  rule_version integer not null default 1 check(rule_version>0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.achievement_rule_versions (
  achievement_id uuid not null references public.achievement_definitions(id) on delete restrict,
  version integer not null check(version>0),
  rules jsonb not null check(jsonb_typeof(rules)='object'),
  created_at timestamptz not null default now(),
  primary key(achievement_id,version)
);
create table public.achievement_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  achievement_id uuid not null references public.achievement_definitions(id) on delete restrict,
  rule_version integer not null,
  status text not null check(status in ('awarded','revoked')),
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  evidence_event_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  foreign key(achievement_id,rule_version) references public.achievement_rule_versions(achievement_id,version) on delete restrict,
  unique(profile_id,achievement_id,rule_version),
  check((status='awarded' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create index achievement_awards_profile_idx on public.achievement_awards(profile_id,status,achievement_id);
create table public.achievement_rebuild_jobs (
  id bigint generated always as identity primary key,
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','processing','done')),
  attempts integer not null default 0 check(attempts>=0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create index achievement_rebuild_jobs_ready_idx on public.achievement_rebuild_jobs(status,available_at,id);
create table public.achievement_award_audit (
  id bigint generated always as identity primary key,
  award_id uuid not null references public.achievement_awards(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  achievement_id uuid not null references public.achievement_definitions(id) on delete restrict,
  rule_version integer not null,
  action text not null check(action in ('awarded','revoked','recalculated')),
  reason text not null,
  evidence_event_ids uuid[] not null default '{}',
  rebuild_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.achievement_definitions enable row level security;
alter table public.achievement_rule_versions enable row level security;
alter table public.achievement_awards enable row level security;
alter table public.achievement_award_audit enable row level security;
alter table public.achievement_rebuild_jobs enable row level security;
revoke all on public.achievement_definitions,public.achievement_rule_versions,public.achievement_awards,public.achievement_award_audit,public.achievement_rebuild_jobs from public,anon,authenticated;
grant all on public.achievement_definitions,public.achievement_rule_versions,public.achievement_awards,public.achievement_award_audit,public.achievement_rebuild_jobs to service_role;

create function public.create_achievement_definition(p_code text,p_title text,p_description text,p_threshold integer)
returns public.achievement_definitions language plpgsql security definer set search_path='' as $$
declare v public.achievement_definitions;
begin
  if p_code !~ '^[a-z][a-z0-9_]{2,59}$' or length(trim(p_title)) not between 1 and 100 or length(coalesce(p_description,''))>500 or p_threshold not between 1 and 100000 then raise exception 'INVALID_ACHIEVEMENT_RULE'; end if;
  insert into public.achievement_definitions(code,title,description,threshold) values(p_code,trim(p_title),coalesce(p_description,''),p_threshold) returning * into v;
  insert into public.achievement_rule_versions(achievement_id,version,rules) values(v.id,v.rule_version,jsonb_build_object('metric',v.metric,'threshold',v.threshold,'active',v.active));
  insert into public.achievement_rebuild_jobs(profile_id) select id from public.profiles on conflict(profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
  return v;
end; $$;

create function public.update_achievement_definition(p_code text,p_title text,p_description text,p_threshold integer,p_active boolean)
returns public.achievement_definitions language plpgsql security definer set search_path='' as $$
declare v public.achievement_definitions; v_next integer;
begin
  if length(trim(p_title)) not between 1 and 100 or length(coalesce(p_description,''))>500 or p_threshold not between 1 and 100000 then raise exception 'INVALID_ACHIEVEMENT_RULE'; end if;
  select * into v from public.achievement_definitions where code=p_code for update;
  if not found then raise exception 'ACHIEVEMENT_NOT_FOUND'; end if;
  v_next:=v.rule_version+1;
  update public.achievement_definitions set title=trim(p_title),description=coalesce(p_description,''),threshold=p_threshold,active=p_active,rule_version=v_next,updated_at=now() where id=v.id returning * into v;
  insert into public.achievement_rule_versions(achievement_id,version,rules) values(v.id,v.rule_version,jsonb_build_object('metric',v.metric,'threshold',v.threshold,'active',v.active));
  insert into public.achievement_rebuild_jobs(profile_id) select id from public.profiles on conflict(profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
  return v;
end; $$;

create function dolend_private.enqueue_achievement_rebuild(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.achievement_rebuild_jobs(profile_id)
  select id from public.profiles where user_id=p_user
  on conflict(profile_id) do update set status='pending',available_at=now(),locked_until=null,updated_at=now();
end; $$;

create function dolend_private.enqueue_achievement_participant_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform dolend_private.enqueue_achievement_rebuild(coalesce(new.user_id,old.user_id));
  return new;
end; $$;

create function dolend_private.enqueue_achievement_event_jobs()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  for r in select distinct ep.user_id from public.event_participants ep where ep.event_id=new.id and ep.status='attended' loop
    perform dolend_private.enqueue_achievement_rebuild(r.user_id);
  end loop;
  return new;
end; $$;

create trigger achievement_rebuild_attendance_change after insert or update of status,attendance_at on public.event_participants
for each row execute function dolend_private.enqueue_achievement_participant_job();
create trigger achievement_rebuild_event_status_change after update of status on public.events
for each row when(old.status is distinct from new.status) execute function dolend_private.enqueue_achievement_event_jobs();

create function public.rebuild_achievement_awards(p_profile_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid; v_def record; v_count integer; v_evidence uuid[]; v_award public.achievement_awards; v_old_award public.achievement_awards; v_rebuild uuid:=gen_random_uuid(); v_awarded integer:=0; v_revoked integer:=0; v_processed integer:=0;
begin
  if coalesce(cardinality(p_profile_ids),0)>200 then raise exception 'INVALID_BATCH_SIZE'; end if;
  foreach v_profile in array coalesce(p_profile_ids,'{}'::uuid[]) loop
    if not exists(select 1 from public.profiles where id=v_profile) then continue; end if;
    v_processed:=v_processed+1;
    for v_def in select * from public.achievement_definitions order by id loop
      select count(distinct e.id)::integer into v_count
      from public.event_participants ep join public.profiles p on p.user_id=ep.user_id join public.events e on e.id=ep.event_id
      where p.id=v_profile and ep.status='attended' and ep.attendance_at is not null and e.status='completed' and e.starts_at<=now();
      select coalesce(array_agg(x.id order by x.starts_at,x.id),'{}'::uuid[]) into v_evidence from (
        select distinct e.id,e.starts_at from public.event_participants ep join public.profiles p on p.user_id=ep.user_id join public.events e on e.id=ep.event_id
        where p.id=v_profile and ep.status='attended' and ep.attendance_at is not null and e.status='completed' and e.starts_at<=now()
        order by e.starts_at,e.id limit v_def.threshold
      ) x;
      select * into v_award from public.achievement_awards where profile_id=v_profile and achievement_id=v_def.id and rule_version=v_def.rule_version for update;
      if v_def.active and v_count>=v_def.threshold then
        if not found then
          insert into public.achievement_awards(profile_id,achievement_id,rule_version,status,evidence_event_ids)
          values(v_profile,v_def.id,v_def.rule_version,'awarded',v_evidence) returning * into v_award;
          insert into public.achievement_award_audit(award_id,profile_id,achievement_id,rule_version,action,reason,evidence_event_ids,rebuild_id)
          values(v_award.id,v_profile,v_def.id,v_def.rule_version,'awarded','threshold_met',v_evidence,v_rebuild);
          v_awarded:=v_awarded+1;
        elsif v_award.status='revoked' then
          update public.achievement_awards set status='awarded',awarded_at=now(),revoked_at=null,evidence_event_ids=v_evidence,updated_at=now() where id=v_award.id returning * into v_award;
          insert into public.achievement_award_audit(award_id,profile_id,achievement_id,rule_version,action,reason,evidence_event_ids,rebuild_id)
          values(v_award.id,v_profile,v_def.id,v_def.rule_version,'awarded','threshold_restored',v_evidence,v_rebuild);
          v_awarded:=v_awarded+1;
        elsif v_award.evidence_event_ids is distinct from v_evidence then
          update public.achievement_awards set evidence_event_ids=v_evidence,updated_at=now() where id=v_award.id;
          insert into public.achievement_award_audit(award_id,profile_id,achievement_id,rule_version,action,reason,evidence_event_ids,rebuild_id)
          values(v_award.id,v_profile,v_def.id,v_def.rule_version,'recalculated','evidence_corrected',v_evidence,v_rebuild);
        end if;
      elsif found and v_award.status='awarded' then
        update public.achievement_awards set status='revoked',revoked_at=now(),updated_at=now() where id=v_award.id returning * into v_award;
        insert into public.achievement_award_audit(award_id,profile_id,achievement_id,rule_version,action,reason,evidence_event_ids,rebuild_id)
        values(v_award.id,v_profile,v_def.id,v_def.rule_version,'revoked',case when v_def.active then 'threshold_no_longer_met' else 'definition_inactive' end,v_evidence,v_rebuild);
        v_revoked:=v_revoked+1;
      end if;
      if v_def.active then
        for v_old_award in update public.achievement_awards set status='revoked',revoked_at=now(),updated_at=now()
          where profile_id=v_profile and achievement_id=v_def.id and rule_version<>v_def.rule_version and status='awarded'
          returning * loop
          insert into public.achievement_award_audit(award_id,profile_id,achievement_id,rule_version,action,reason,evidence_event_ids,rebuild_id)
          values(v_old_award.id,v_profile,v_def.id,v_old_award.rule_version,'revoked','rule_version_superseded',v_old_award.evidence_event_ids,v_rebuild);
          v_revoked:=v_revoked+1;
        end loop;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('profiles_processed',v_processed,'awarded',v_awarded,'revoked',v_revoked,'rebuild_id',v_rebuild);
end; $$;

create function public.run_achievement_maintenance(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; v_processed integer:=0; v_awards integer:=0; v_revocations integer:=0; v_result jsonb;
begin
  if p_limit not between 1 and 200 then raise exception 'INVALID_BATCH_SIZE'; end if;
  for j in select id,profile_id from public.achievement_rebuild_jobs
    where status in ('pending','processing') and available_at<=now() and (locked_until is null or locked_until<=now())
    order by id limit p_limit for update skip locked
  loop
    update public.achievement_rebuild_jobs set status='processing',locked_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() where id=j.id;
    v_result:=public.rebuild_achievement_awards(array[j.profile_id]);
    v_awards:=v_awards+(v_result->>'awarded')::integer;
    v_revocations:=v_revocations+(v_result->>'revoked')::integer;
    update public.achievement_rebuild_jobs set status='done',locked_until=null,updated_at=now() where id=j.id;
    v_processed:=v_processed+1;
  end loop;
  return jsonb_build_object('processed',v_processed,'awarded',v_awards,'revoked',v_revocations);
end; $$;

create function public.get_profile_achievements(p_viewer uuid,p_target uuid)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('code',d.code,'title',d.title,'description',d.description,'rule_version',a.rule_version,'awarded_at',a.awarded_at)
  from public.achievement_awards a join public.achievement_definitions d on d.id=a.achievement_id and d.active
  join public.profiles target on target.id=a.profile_id
  where a.profile_id=p_target and a.status='awarded'
    and (p_viewer=p_target or (not target.is_private and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=p_viewer and b.blocked_profile_id=p_target) or (b.blocker_profile_id=p_target and b.blocked_profile_id=p_viewer)))
      or (exists(select 1 from public.social_follows f where f.follower_profile_id=p_viewer and f.followed_profile_id=p_target and f.status='accepted') and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=p_viewer and b.blocked_profile_id=p_target) or (b.blocker_profile_id=p_target and b.blocked_profile_id=p_viewer))))
  order by a.awarded_at desc,d.code;
$$;

select public.create_achievement_definition('first_attendance','Langkah pertama','Hadir pada satu event yang selesai dan diverifikasi organizer.',1);
select public.create_achievement_definition('five_attendances','Rutin hadir','Hadir pada lima event selesai yang diverifikasi organizer.',5);

revoke all on function public.create_achievement_definition(text,text,text,integer),public.update_achievement_definition(text,text,text,integer,boolean),public.rebuild_achievement_awards(uuid[]),public.run_achievement_maintenance(integer),public.get_profile_achievements(uuid,uuid),dolend_private.enqueue_achievement_rebuild(uuid),dolend_private.enqueue_achievement_participant_job(),dolend_private.enqueue_achievement_event_jobs() from public,anon,authenticated;
grant execute on function public.create_achievement_definition(text,text,text,integer),public.update_achievement_definition(text,text,text,integer,boolean),public.rebuild_achievement_awards(uuid[]),public.run_achievement_maintenance(integer),public.get_profile_achievements(uuid,uuid) to service_role;
