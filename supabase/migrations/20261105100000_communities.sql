-- Community access is mediated by trusted domain RPCs. Browser roles never receive
-- raw membership rows, which keeps private membership and pending requests private.
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '' check (length(description) <= 2000),
  visibility text not null default 'public' check (visibility in ('public','private')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index communities_owner_profile_idx on public.communities(owner_profile_id);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'pending' check (status in ('pending','active','invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, profile_id),
  check (role <> 'owner' or status='active')
);
create index community_members_profile_idx on public.community_members(profile_id, status);
create index community_members_pending_idx on public.community_members(community_id, status) where status <> 'active';
create unique index community_single_active_owner_idx on public.community_members(community_id) where role='owner' and status='active';
create trigger touch_updated_at before update on public.communities for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.community_members for each row execute function dolend_private.touch_updated_at();

alter table public.events add column community_id uuid references public.communities(id) on delete restrict;
create index events_community_idx on public.events(community_id, starts_at desc) where community_id is not null;

create function dolend_private.guard_community_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.community_id is not null and coalesce(dolend_private.community_role(new.community_id,new.organizer_profile_id),'') not in ('owner','admin') then
  raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function dolend_private.guard_community_event() from public,anon,authenticated;
create trigger guard_community_event before insert or update of community_id,organizer_profile_id on public.events
for each row execute function dolend_private.guard_community_event();

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
revoke all on public.communities, public.community_members from anon, authenticated;
grant all on public.communities, public.community_members to service_role;
create or replace function dolend_private.community_is_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.social_blocks b where
   (b.blocker_profile_id=p_a and b.blocked_profile_id=p_b) or
   (b.blocker_profile_id=p_b and b.blocked_profile_id=p_a));
$$;
revoke all on function dolend_private.community_is_blocked(uuid,uuid) from public, anon, authenticated;
grant execute on function dolend_private.community_is_blocked(uuid,uuid) to service_role;

create or replace function dolend_private.community_role(p_community uuid,p_actor uuid)
returns text language sql stable security definer set search_path='' as $$
 select m.role from public.community_members m where m.community_id=p_community
 and m.profile_id=p_actor and m.status='active';
$$;
revoke all on function dolend_private.community_role(uuid,uuid) from public, anon, authenticated;
grant execute on function dolend_private.community_role(uuid,uuid) to service_role;

create or replace function public.create_community(p_actor uuid,p_slug text,p_name text,p_description text,p_visibility text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'PROFILE_REQUIRED' using errcode='42501'; end if;
 insert into public.communities(owner_profile_id,slug,name,description,visibility)
 values(p_actor,lower(trim(p_slug)),trim(p_name),coalesce(p_description,''),p_visibility) returning id into v_id;
 insert into public.community_members(community_id,profile_id,role,status) values(v_id,p_actor,'owner','active');
 return jsonb_build_object('id',v_id,'slug',lower(trim(p_slug)),'name',trim(p_name),'visibility',p_visibility);
end; $$;

create or replace function public.join_community(p_actor uuid,p_community uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_visibility text; v_owner uuid; v_state text;
begin
 select visibility,owner_profile_id into v_visibility,v_owner from public.communities where id=p_community for update;
 if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
 if p_actor=v_owner then return 'active'; end if;
 if dolend_private.community_is_blocked(v_owner,p_actor) then raise exception 'BLOCKED_RELATIONSHIP' using errcode='42501'; end if;
 v_state := case when v_visibility='public' then 'active' else 'pending' end;
 insert into public.community_members(community_id,profile_id,status) values(p_community,p_actor,v_state)
 on conflict (community_id,profile_id) do update set status=excluded.status,updated_at=now()
 where community_members.status='pending';
 return coalesce((select status from public.community_members where community_id=p_community and profile_id=p_actor),v_state);
end; $$;

create or replace function public.invite_community_member(p_actor uuid,p_community uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(dolend_private.community_role(p_community,p_actor),'') not in ('owner','admin') then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode='42501'; end if;
 if dolend_private.community_is_blocked(p_actor,p_target) then raise exception 'BLOCKED_RELATIONSHIP' using errcode='42501'; end if;
 insert into public.community_members(community_id,profile_id,role,status) values(p_community,p_target,'member','invited')
 on conflict (community_id,profile_id) do update set status='invited',role='member',updated_at=now()
 where community_members.status<>'active';
end; $$;

create or replace function public.respond_community_invite(p_actor uuid,p_community uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_accept then
  update public.community_members set status='active',updated_at=now()
  where community_id=p_community and profile_id=p_actor and status='invited';
 else
  delete from public.community_members where community_id=p_community and profile_id=p_actor and status='invited';
 end if;
 if not found then raise exception 'INVITE_NOT_FOUND' using errcode='P0002'; end if;
end; $$;

create or replace function public.review_community_request(p_actor uuid,p_community uuid,p_target uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(dolend_private.community_role(p_community,p_actor),'') not in ('owner','admin') then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode='42501'; end if;
 update public.community_members set status=case when p_approve then 'active' else 'pending' end,updated_at=now()
 where community_id=p_community and profile_id=p_target and status='pending';
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
 if not p_approve then delete from public.community_members where community_id=p_community and profile_id=p_target and status='pending'; end if;
end; $$;

create or replace function public.set_community_role(p_actor uuid,p_community uuid,p_target uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if dolend_private.community_role(p_community,p_actor) is distinct from 'owner' then raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode='42501'; end if;
 if p_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
 update public.community_members set role=p_role,updated_at=now()
 where community_id=p_community and profile_id=p_target and status='active' and role<>'owner';
 if not found then raise exception 'MEMBER_NOT_FOUND' using errcode='P0002'; end if;
end; $$;

create or replace function public.transfer_community_ownership(p_actor uuid,p_community uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.communities where id=p_community and owner_profile_id=p_actor for update;
 if not found then raise exception 'COMMUNITY_OWNER_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.community_members where community_id=p_community and profile_id=p_target and status='active') then raise exception 'ACTIVE_MEMBER_REQUIRED'; end if;
 update public.community_members set role='admin',updated_at=now() where community_id=p_community and profile_id=p_actor and role='owner';
 update public.community_members set role='owner',updated_at=now() where community_id=p_community and profile_id=p_target;
 update public.communities set owner_profile_id=p_target,updated_at=now() where id=p_community;
end; $$;

create or replace function public.leave_community(p_actor uuid,p_community uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.communities where id=p_community and owner_profile_id=p_actor for update;
 if found then raise exception 'TRANSFER_OWNERSHIP_REQUIRED' using errcode='42501'; end if;
 delete from public.community_members where community_id=p_community and profile_id=p_actor and role in ('admin','member');
 if not found then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function public.assert_community_event_creator(p_actor uuid,p_community uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(dolend_private.community_role(p_community,p_actor),'') not in ('owner','admin') then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function public.link_community_event(p_actor uuid,p_community uuid,p_event uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(dolend_private.community_role(p_community,p_actor),'') not in ('owner','admin') then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode='42501'; end if;
 update public.events set community_id=p_community,updated_at=now() where id=p_event and organizer_profile_id=p_actor and community_id is null;
 if not found then raise exception 'EVENT_LINK_FORBIDDEN_OR_ALREADY_LINKED' using errcode='42501'; end if;
end; $$;

create or replace function public.discover_communities(p_actor uuid default null)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name,'description',c.description,'visibility',c.visibility,
   'member_count',(select count(*) from public.community_members m where m.community_id=c.id and m.status='active'),
   'membership_status',(select m.status from public.community_members m where m.community_id=c.id and m.profile_id=p_actor))
 from public.communities c
 where c.visibility='public' and (p_actor is null or not dolend_private.community_is_blocked(c.owner_profile_id,p_actor))
 order by c.name,c.id;
$$;

create or replace function public.get_community(p_actor uuid,p_slug text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_c public.communities; v_role text; v_membership_status text;
begin
 select * into v_c from public.communities where slug=p_slug;
 if not found then return null; end if;
 v_role := dolend_private.community_role(v_c.id,p_actor);
 select m.status into v_membership_status from public.community_members m where m.community_id=v_c.id and m.profile_id=p_actor;
 if v_c.visibility='private' and v_role is null and coalesce(v_membership_status,'') not in ('pending','invited') then return null; end if;
 if p_actor is not null and dolend_private.community_is_blocked(v_c.owner_profile_id,p_actor) then return null; end if;
 return jsonb_build_object('id',v_c.id,'slug',v_c.slug,'name',v_c.name,'description',v_c.description,'visibility',v_c.visibility,
   'role',v_role,'membership_status',v_membership_status,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',case when v_role in ('owner','admin') or m.profile_id=p_actor then m.profile_id else null end,'role',m.role)), '[]'::jsonb) from public.community_members m where m.community_id=v_c.id and m.status='active' and (v_c.visibility='public' or v_role in ('owner','admin') or m.profile_id=p_actor) and (p_actor is null or not dolend_private.community_is_blocked(m.profile_id,p_actor))),
   'requests',(select coalesce(jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'status',m.status)), '[]'::jsonb) from public.community_members m where m.community_id=v_c.id and m.status in ('pending','invited') and v_role in ('owner','admin')),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'status',e.status)), '[]'::jsonb) from public.events e where e.community_id=v_c.id and (v_c.visibility='public' or v_role is not null) and (e.visibility='public' or v_role is not null) and e.status in ('published','completed') and (p_actor is null or not dolend_private.community_is_blocked(e.organizer_profile_id,p_actor))));
end; $$;

revoke all on function public.create_community(uuid,text,text,text,text),public.join_community(uuid,uuid),public.invite_community_member(uuid,uuid,uuid),public.respond_community_invite(uuid,uuid,boolean),public.review_community_request(uuid,uuid,uuid,boolean),public.set_community_role(uuid,uuid,uuid,text),public.transfer_community_ownership(uuid,uuid,uuid),public.leave_community(uuid,uuid),public.assert_community_event_creator(uuid,uuid),public.link_community_event(uuid,uuid,uuid),public.discover_communities(uuid),public.get_community(uuid,text) from public, anon, authenticated;
grant execute on function public.create_community(uuid,text,text,text,text),public.join_community(uuid,uuid),public.invite_community_member(uuid,uuid,uuid),public.respond_community_invite(uuid,uuid,boolean),public.review_community_request(uuid,uuid,uuid,boolean),public.set_community_role(uuid,uuid,uuid,text),public.transfer_community_ownership(uuid,uuid,uuid),public.leave_community(uuid,uuid),public.assert_community_event_creator(uuid,uuid),public.link_community_event(uuid,uuid,uuid),public.discover_communities(uuid),public.get_community(uuid,text) to service_role;
