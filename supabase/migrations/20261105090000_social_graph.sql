alter table public.profiles
  add column is_private boolean not null default false;

create table public.social_follows (
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  check (follower_profile_id <> followed_profile_id)
);
create index social_follows_followed_status_idx on public.social_follows(followed_profile_id,status,follower_profile_id);
create index social_follows_follower_status_idx on public.social_follows(follower_profile_id,status,followed_profile_id);
alter table public.social_follows enable row level security;
revoke all on public.social_follows from public, anon, authenticated;
grant all on public.social_follows to service_role;

create table public.social_blocks (
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id,blocked_profile_id),
  check (blocker_profile_id <> blocked_profile_id)
);
create index social_blocks_blocked_idx on public.social_blocks(blocked_profile_id,blocker_profile_id);
alter table public.social_blocks enable row level security;
revoke all on public.social_blocks from public, anon, authenticated;
grant all on public.social_blocks to service_role;

create table public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reported_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','impersonation','unsafe','other')),
  details text not null default '' check (length(details)<=1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_profile_id <> reported_profile_id)
);
create index social_reports_review_idx on public.social_reports(status,created_at);
create index social_reports_reporter_created_idx on public.social_reports(reporter_profile_id,created_at desc);
create index social_reports_reported_created_idx on public.social_reports(reported_profile_id,created_at desc);
alter table public.social_reports enable row level security;
revoke all on public.social_reports from public, anon, authenticated;
grant all on public.social_reports to service_role;

create function public.social_set_privacy(p_actor uuid,p_private boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set is_private=p_private where id=p_actor;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not p_private then
    update public.social_follows set status='accepted',updated_at=now()
      where followed_profile_id=p_actor and status='pending';
  end if;
  return p_private;
end;
$$;

create function public.social_follow(p_actor uuid,p_target uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_private boolean;
begin
  if p_actor=p_target then raise exception 'SELF_FOLLOW'; end if;
  if exists(select 1 from public.social_blocks where (blocker_profile_id=p_actor and blocked_profile_id=p_target) or (blocker_profile_id=p_target and blocked_profile_id=p_actor)) then raise exception 'SOCIAL_BLOCKED'; end if;
  select pr.is_private into v_private from public.profiles pr join public.users u on u.id=pr.user_id where pr.id=p_target and u.state='active';
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not exists(select 1 from public.profiles where id=p_actor) then raise exception 'PROFILE_NOT_FOUND'; end if;
  insert into public.social_follows(follower_profile_id,followed_profile_id,status)
    values(p_actor,p_target,case when v_private then 'pending' else 'accepted' end)
    on conflict(follower_profile_id,followed_profile_id) do nothing;
  return (select status from public.social_follows where follower_profile_id=p_actor and followed_profile_id=p_target);
end;
$$;

create function public.social_unfollow(p_actor uuid,p_target uuid)
returns boolean language sql security definer set search_path='' as $$
  with removed as (delete from public.social_follows where follower_profile_id=p_actor and followed_profile_id=p_target returning 1)
  select exists(select 1 from removed);
$$;

create function public.social_respond_request(p_actor uuid,p_follower uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.social_follows set status=case when p_accept then 'accepted' else 'pending' end,updated_at=now()
    where follower_profile_id=p_follower and followed_profile_id=p_actor and status='pending'
      and (p_accept or not exists(select 1 from public.social_blocks where (blocker_profile_id=p_actor and blocked_profile_id=p_follower) or (blocker_profile_id=p_follower and blocked_profile_id=p_actor)));
  if not p_accept then
    delete from public.social_follows where follower_profile_id=p_follower and followed_profile_id=p_actor and status='pending';
    return true;
  end if;
  return found;
end;
$$;

create function public.social_block(p_actor uuid,p_target uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_actor=p_target then raise exception 'SELF_BLOCK'; end if;
  if not exists(select 1 from public.profiles where id=p_actor) or not exists(select 1 from public.profiles where id=p_target) then raise exception 'PROFILE_NOT_FOUND'; end if;
  insert into public.social_blocks(blocker_profile_id,blocked_profile_id) values(p_actor,p_target) on conflict do nothing;
  delete from public.social_follows where (follower_profile_id=p_actor and followed_profile_id=p_target) or (follower_profile_id=p_target and followed_profile_id=p_actor);
  return true;
end;
$$;

create function public.social_unblock(p_actor uuid,p_target uuid)
returns boolean language sql security definer set search_path='' as $$
  with removed as (delete from public.social_blocks where blocker_profile_id=p_actor and blocked_profile_id=p_target returning 1)
  select exists(select 1 from removed);
$$;

create function public.social_report(p_actor uuid,p_target uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_actor=p_target then raise exception 'SELF_REPORT'; end if;
  if p_reason not in ('spam','harassment','impersonation','unsafe','other') or length(coalesce(p_details,''))>1000 then raise exception 'INVALID_REPORT'; end if;
  if not exists(select 1 from public.profiles where id=p_actor) or not exists(select 1 from public.profiles where id=p_target) then raise exception 'PROFILE_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  if (select count(*) from public.social_reports where reporter_profile_id=p_actor and created_at>now()-interval '1 day')>=5 then raise exception 'REPORT_RATE_LIMITED'; end if;
  insert into public.social_reports(reporter_profile_id,reported_profile_id,reason,details) values(p_actor,p_target,p_reason,coalesce(p_details,'')) returning id into v_id;
  return v_id;
end;
$$;

create function public.social_profile(p_actor uuid,p_target uuid)
returns table(profile_id uuid,display_name text,bio text,avatar_path text,is_private boolean,follow_status text)
language plpgsql stable security definer set search_path='' as $$
declare v_follow text;
begin
  if exists(select 1 from public.social_blocks where (blocker_profile_id=p_actor and blocked_profile_id=p_target) or (blocker_profile_id=p_target and blocked_profile_id=p_actor)) then return; end if;
  select sf.status into v_follow from public.social_follows sf where sf.follower_profile_id=p_actor and sf.followed_profile_id=p_target;
  return query select pr.id,u.display_name,pr.bio,pr.avatar_path,pr.is_private,v_follow
    from public.profiles pr join public.users u on u.id=pr.user_id
    where pr.id=p_target and u.state='active' and (not pr.is_private or v_follow='accepted' or p_actor=p_target);
end;
$$;

create function public.social_list(p_actor uuid,p_kind text,p_limit integer default 20,p_before uuid default null)
returns table(profile_id uuid,display_name text,bio text,avatar_path text,created_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_kind not in ('followers','following','requests','blocks') then raise exception 'INVALID_SOCIAL_LIST'; end if;
  if p_limit<1 or p_limit>50 then raise exception 'INVALID_SOCIAL_LIMIT'; end if;
  if p_kind='blocks' then
    return query select pr.id,u.display_name,pr.bio,pr.avatar_path,sb.created_at,'blocked'::text from public.social_blocks sb join public.profiles pr on pr.id=sb.blocked_profile_id join public.users u on u.id=pr.user_id where sb.blocker_profile_id=p_actor and (p_before is null or pr.id<p_before) order by pr.id desc limit p_limit;
  elsif p_kind='requests' then
    return query select pr.id,u.display_name,pr.bio,pr.avatar_path,sf.created_at,sf.status from public.social_follows sf join public.profiles pr on pr.id=sf.follower_profile_id join public.users u on u.id=pr.user_id where sf.followed_profile_id=p_actor and sf.status='pending' and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=p_actor and b.blocked_profile_id=pr.id) or (b.blocker_profile_id=pr.id and b.blocked_profile_id=p_actor)) and (p_before is null or pr.id<p_before) order by pr.id desc limit p_limit;
  elsif p_kind='followers' then
    return query select pr.id,u.display_name,pr.bio,pr.avatar_path,sf.created_at,sf.status from public.social_follows sf join public.profiles pr on pr.id=sf.follower_profile_id join public.users u on u.id=pr.user_id where sf.followed_profile_id=p_actor and sf.status='accepted' and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=p_actor and b.blocked_profile_id=pr.id) or (b.blocker_profile_id=pr.id and b.blocked_profile_id=p_actor)) and (p_before is null or pr.id<p_before) order by pr.id desc limit p_limit;
  else
    return query select pr.id,u.display_name,pr.bio,pr.avatar_path,sf.created_at,sf.status from public.social_follows sf join public.profiles pr on pr.id=sf.followed_profile_id join public.users u on u.id=pr.user_id where sf.follower_profile_id=p_actor and sf.status='accepted' and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=p_actor and b.blocked_profile_id=pr.id) or (b.blocker_profile_id=pr.id and b.blocked_profile_id=p_actor)) and (p_before is null or pr.id<p_before) order by pr.id desc limit p_limit;
  end if;
end;
$$;

revoke all on function public.social_set_privacy(uuid,boolean),public.social_follow(uuid,uuid),public.social_unfollow(uuid,uuid),public.social_respond_request(uuid,uuid,boolean),public.social_block(uuid,uuid),public.social_unblock(uuid,uuid),public.social_report(uuid,uuid,text,text),public.social_profile(uuid,uuid),public.social_list(uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.social_set_privacy(uuid,boolean),public.social_follow(uuid,uuid),public.social_unfollow(uuid,uuid),public.social_respond_request(uuid,uuid,boolean),public.social_block(uuid,uuid),public.social_unblock(uuid,uuid),public.social_report(uuid,uuid,text,text),public.social_profile(uuid,uuid),public.social_list(uuid,text,integer,uuid) to service_role;
