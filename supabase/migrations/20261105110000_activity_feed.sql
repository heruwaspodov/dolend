create table public.activities (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  body text not null check (length(trim(body)) between 1 and 2000),
  visibility text not null default 'followers' check (visibility in ('public','followers','community','private')),
  community_id uuid references public.communities(id) on delete restrict,
  source_event_id uuid references public.events(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (author_profile_id,idempotency_key),
  check ((visibility='community') = (community_id is not null))
);
create index activities_feed_cursor_idx on public.activities(created_at desc,id desc) where deleted_at is null;
create index activities_author_cursor_idx on public.activities(author_profile_id,created_at desc,id desc) where deleted_at is null;
create index activities_community_cursor_idx on public.activities(community_id,created_at desc,id desc) where deleted_at is null and community_id is not null;
alter table public.activities enable row level security;
revoke all on public.activities from public,anon,authenticated;
grant all on public.activities to service_role;

create table public.activity_reports (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  reporter_profile_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (reason in ('spam','harassment','unsafe','other')),
  details text not null default '' check (length(details)<=500),
  created_at timestamptz not null default now(),
  unique(activity_id,reporter_profile_id)
);
alter table public.activity_reports enable row level security;
revoke all on public.activity_reports from public,anon,authenticated;
grant all on public.activity_reports to service_role;

create or replace function public.get_activity_feed(p_actor uuid,p_before_created_at timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',a.id,'author_profile_id',a.author_profile_id,'author_name',u.display_name,'author_avatar_path',p.avatar_path,
    'body',a.body,'visibility',a.visibility,'community_id',c.id,'community_name',c.name,
    'source_event_id',e.id,'source_event_title',e.title,'created_at',a.created_at,'updated_at',a.updated_at,
    'is_own',a.author_profile_id=p_actor
  )
  from public.activities a
  join public.profiles p on p.id=a.author_profile_id
  join public.users u on u.id=p.user_id
  left join public.communities c on c.id=a.community_id
  left join public.events e on e.id=a.source_event_id and e.visibility='public' and e.status in ('published','completed')
  where a.deleted_at is null
    and (p_before_created_at is null or (a.created_at,a.id)<(p_before_created_at,p_before_id))
    and not exists(select 1 from public.social_blocks b where
      (b.blocker_profile_id=p_actor and b.blocked_profile_id=a.author_profile_id) or
      (b.blocker_profile_id=a.author_profile_id and b.blocked_profile_id=p_actor))
    and (
      a.author_profile_id=p_actor
      or (a.visibility='public' and not p.is_private)
      or (a.visibility in ('public','followers') and exists(select 1 from public.social_follows f where f.follower_profile_id=p_actor and f.followed_profile_id=a.author_profile_id and f.status='accepted'))
      or (a.visibility='community' and exists(select 1 from public.community_members m where m.community_id=a.community_id and m.profile_id=p_actor and m.status='active'))
    )
    and (a.visibility<>'community' or (c.visibility='public' or exists(select 1 from public.community_members m where m.community_id=c.id and m.profile_id=p_actor and m.status='active')))
  order by a.created_at desc,a.id desc limit least(greatest(p_limit,1),50);
$$;

create or replace function public.publish_activity(p_actor uuid,p_key text,p_body text,p_visibility text,p_community uuid default null,p_source_event uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_activity public.activities;
begin
  if length(trim(p_body)) not between 1 and 2000 or p_visibility not in ('public','followers','community','private') then raise exception 'INVALID_ACTIVITY'; end if;
  if (p_visibility='community') <> (p_community is not null) then raise exception 'INVALID_ACTIVITY'; end if;
  if p_community is not null and not exists(select 1 from public.community_members m where m.community_id=p_community and m.profile_id=p_actor and m.status='active') then raise exception 'COMMUNITY_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if p_source_event is not null and not exists(select 1 from public.events e where e.id=p_source_event and (e.organizer_profile_id=p_actor or (e.visibility='public' and e.status in ('published','completed')))) then raise exception 'EVENT_SOURCE_UNAVAILABLE'; end if;
  insert into public.activities(author_profile_id,idempotency_key,body,visibility,community_id,source_event_id)
  values(p_actor,p_key,trim(p_body),p_visibility,p_community,p_source_event)
  on conflict(author_profile_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into v_activity;
  return jsonb_build_object('id',v_activity.id,'author_profile_id',v_activity.author_profile_id,'body',v_activity.body,'visibility',v_activity.visibility,'community_id',v_activity.community_id,'source_event_id',v_activity.source_event_id,'created_at',v_activity.created_at,'updated_at',v_activity.updated_at,'deleted_at',v_activity.deleted_at);
end; $$;

create or replace function public.edit_activity(p_actor uuid,p_activity uuid,p_body text,p_visibility text,p_community uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_activity public.activities;
begin
  if length(trim(p_body)) not between 1 and 2000 or p_visibility not in ('public','followers','community','private') or ((p_visibility='community') <> (p_community is not null)) then raise exception 'INVALID_ACTIVITY'; end if;
  if p_community is not null and not exists(select 1 from public.community_members m where m.community_id=p_community and m.profile_id=p_actor and m.status='active') then raise exception 'COMMUNITY_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  update public.activities set body=trim(p_body),visibility=p_visibility,community_id=p_community,updated_at=now()
  where id=p_activity and author_profile_id=p_actor and deleted_at is null returning * into v_activity;
  if not found then return null; end if;
  return jsonb_build_object('id',v_activity.id,'author_profile_id',v_activity.author_profile_id,'body',v_activity.body,'visibility',v_activity.visibility,'community_id',v_activity.community_id,'source_event_id',v_activity.source_event_id,'created_at',v_activity.created_at,'updated_at',v_activity.updated_at,'deleted_at',v_activity.deleted_at);
end; $$;

create or replace function public.delete_activity(p_actor uuid,p_activity uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.activities set deleted_at=coalesce(deleted_at,now()),updated_at=now()
  where id=p_activity and author_profile_id=p_actor;
  return found;
end; $$;

create or replace function public.report_activity(p_actor uuid,p_activity uuid,p_reason text,p_details text default '')
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_reason not in ('spam','harassment','unsafe','other') or length(p_details)>500 then raise exception 'INVALID_REPORT'; end if;
  if not exists(select 1 from public.activities a where a.id=p_activity and a.deleted_at is null) then return false; end if;
  insert into public.activity_reports(activity_id,reporter_profile_id,reason,details)
  values(p_activity,p_actor,p_reason,trim(p_details)) on conflict(activity_id,reporter_profile_id) do nothing;
  return true;
end; $$;

revoke all on function public.get_activity_feed(uuid,timestamptz,uuid,integer),public.publish_activity(uuid,text,text,text,uuid,uuid),public.edit_activity(uuid,uuid,text,text,uuid),public.delete_activity(uuid,uuid),public.report_activity(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.get_activity_feed(uuid,timestamptz,uuid,integer),public.publish_activity(uuid,text,text,text,uuid,uuid),public.edit_activity(uuid,uuid,text,text,uuid),public.delete_activity(uuid,uuid),public.report_activity(uuid,uuid,text,text) to service_role;
