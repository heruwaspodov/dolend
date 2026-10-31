-- Google is the login identity for organizers. Guest bookings use an event-scoped bearer token.
alter table public.users alter column phone_normalized drop not null;
alter table public.users drop constraint users_phone_normalized_check;
alter table public.users add constraint users_phone_normalized_check
  check (phone_normalized is null or phone_normalized ~ '^62[1-9][0-9]{6,12}$');

alter table public.profiles add column auth_provider text not null default 'legacy_phone'
  check (auth_provider in ('google','legacy_phone'));

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant all on public.workspaces to service_role;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner','organizer','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon, authenticated;
grant all on public.workspace_members to service_role;

create table public.event_organizers (
  event_id uuid not null references public.events(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner','organizer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_organizers enable row level security;
revoke all on public.event_organizers from anon, authenticated;
grant all on public.event_organizers to service_role;

create trigger touch_updated_at before update on public.workspaces
  for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.workspace_members
  for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.event_organizers
  for each row execute function dolend_private.touch_updated_at();

create index workspaces_created_by_profile_id_idx on public.workspaces(created_by_profile_id);
create index workspace_members_profile_id_idx on public.workspace_members(profile_id);
create index event_organizers_profile_id_idx on public.event_organizers(profile_id);

alter table public.events add column workspace_id uuid references public.workspaces(id) on delete restrict;
create index events_workspace_id_idx on public.events(workspace_id);

insert into public.workspaces(name,created_by_profile_id)
select left('Ruang ' || u.display_name,120), p.id
from public.profiles p
join public.users u on u.id=p.user_id
group by p.id,u.display_name;

insert into public.workspace_members(workspace_id,profile_id,role)
select w.id,w.created_by_profile_id,'owner' from public.workspaces w;

update public.events e set workspace_id=w.id
from public.workspaces w where w.created_by_profile_id=e.organizer_profile_id;

insert into public.event_organizers(event_id,profile_id,role)
select id,organizer_profile_id,'owner' from public.events;

alter table public.events alter column workspace_id set not null;

create or replace function dolend_private.is_google_auth_user(p_auth_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from auth.users u
    where u.id=p_auth_user
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<now())
      and (
        u.raw_app_meta_data->>'provider'='google'
        or exists(
          select 1 from jsonb_array_elements_text(
            case when jsonb_typeof(u.raw_app_meta_data->'providers')='array'
              then u.raw_app_meta_data->'providers' else '[]'::jsonb end
          ) provider
          where provider='google'
        )
      )
  );
$$;

create or replace function dolend_private.can_organize_workspace(p_workspace uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.workspace_members m
    where m.workspace_id=p_workspace and m.profile_id=p_profile and m.role in ('owner','organizer')
  );
$$;

create or replace function dolend_private.can_organize_event(p_event uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.events e
    where e.id=p_event and (
      exists(
        select 1 from public.event_organizers eo
        where eo.event_id=e.id and eo.profile_id=p_profile and eo.role in ('owner','organizer')
      )
      or dolend_private.can_organize_workspace(e.workspace_id,p_profile)
    )
  );
$$;

create or replace function dolend_private.owns_event(p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select dolend_private.can_organize_event(p_event,(select auth.uid()));
$$;

create or replace function dolend_private.assert_profile(p_profile uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid;
begin
  select u.id into v_user
  from public.profiles p
  join public.users u on u.id=p.user_id
  where p.id=p_profile and u.state='active' and dolend_private.is_google_auth_user(p.id);
  if v_user is null then
    raise exception 'GOOGLE_ACCOUNT_REQUIRED' using errcode='42501';
  end if;
  return v_user;
end;
$$;

create or replace function dolend_private.assert_user(p_user uuid,p_event uuid,p_profile uuid,p_guest_hash text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if p_profile is not null then
    if dolend_private.assert_profile(p_profile)<>p_user then
      raise exception 'ACTOR_MISMATCH' using errcode='42501';
    end if;
  elsif not exists(
    select 1 from public.guest_sessions s
    join public.users u on u.id=s.user_id
    where s.user_id=p_user and s.scope_event_id=p_event and s.token_hash=p_guest_hash
      and s.expires_at>now() and s.revoked_at is null and u.state='active'
  ) then
    raise exception 'GUEST_BOOKING_TOKEN_REQUIRED' using errcode='42501';
  end if;
end;
$$;

create or replace function dolend_private.assert_organizer(p_event uuid,p_profile uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform dolend_private.assert_profile(p_profile);
  if not dolend_private.can_organize_event(p_event,p_profile) then
    raise exception 'ORGANIZER_REQUIRED' using errcode='42501';
  end if;
end;
$$;

create or replace function public.bootstrap_google_profile() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare
  auth_user auth.users;
  domain_user public.users;
  profile public.profiles;
  display_name text;
begin
  if auth.uid() is null or not dolend_private.is_google_auth_user(auth.uid()) then
    raise exception 'GOOGLE_ACCOUNT_REQUIRED' using errcode='42501';
  end if;

  select * into strict auth_user from auth.users where id=auth.uid();
  display_name=left(trim(coalesce(
    nullif(auth_user.raw_user_meta_data->>'full_name',''),
    nullif(auth_user.raw_user_meta_data->>'name',''),
    nullif(split_part(auth_user.email,'@',1),''),
    'Pengguna Dolend'
  )),120);

  select * into profile from public.profiles where id=auth_user.id;
  if found then
    update public.profiles set auth_provider='google' where id=auth_user.id;
    select * into strict profile from public.profiles where id=auth_user.id;
    select * into strict domain_user from public.users where id=profile.user_id;
  else
    insert into public.users(display_name,phone_normalized)
    values(display_name,null) returning * into domain_user;
    insert into public.profiles(id,user_id,auth_provider)
    values(auth_user.id,domain_user.id,'google') returning * into profile;
    perform dolend_private.audit(auth_user.id,'profile.bootstrap_google','user',domain_user.id);
  end if;

  insert into public.workspaces(name,created_by_profile_id)
  select left('Ruang ' || domain_user.display_name,120),profile.id
  where not exists(select 1 from public.workspaces where created_by_profile_id=profile.id);
  insert into public.workspace_members(workspace_id,profile_id,role)
  select w.id,profile.id,'owner' from public.workspaces w
  where w.created_by_profile_id=profile.id
  on conflict(workspace_id,profile_id) do nothing;
  return profile;
end;
$$;

create or replace function public.create_guest_booking(
  p_event uuid,
  p_display_name text,
  p_phone_normalized text,
  p_token_hash text
) returns public.event_participants
language plpgsql security definer set search_path='' as $$
declare
  event_row public.events;
  domain_user public.users;
  participant public.event_participants;
begin
  if length(trim(p_display_name)) not between 1 and 120 then raise exception 'INVALID_GUEST_NAME'; end if;
  if p_phone_normalized !~ '^62[1-9][0-9]{6,12}$' then raise exception 'INVALID_GUEST_PHONE'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_GUEST_TOKEN'; end if;

  select * into strict event_row from public.events where id=p_event for update;
  if event_row.status<>'published' or event_row.registration_closes_at<=clock_timestamp() then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into public.users(display_name,phone_normalized)
  values(trim(p_display_name),p_phone_normalized)
  on conflict(phone_normalized) do nothing;

  select * into strict domain_user from public.users
  where phone_normalized=p_phone_normalized for update;
  if domain_user.state<>'active' then raise exception 'GUEST_NOT_ACTIVE' using errcode='42501'; end if;
  if exists(select 1 from public.event_participants where event_id=p_event and user_id=domain_user.id) then
    raise exception 'BOOKING_ALREADY_EXISTS' using errcode='23505';
  end if;

  insert into public.guest_sessions(user_id,scope_event_id,token_hash,expires_at)
  values(domain_user.id,p_event,p_token_hash,greatest(event_row.ends_at+interval '30 days',clock_timestamp()+interval '24 hours'));
  participant=public.join_event(p_event,domain_user.id,null,p_token_hash);
  perform dolend_private.audit(null,'guest.booking_create','event_participant',participant.id);
  return participant;
end;
$$;

create or replace function public.get_guest_booking(p_event uuid,p_token_hash text)
returns table(participant_id uuid,status text,hold_expires_at timestamptz,confirmed_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select p.id,p.status,p.hold_expires_at,p.confirmed_at,p.updated_at
  from public.guest_sessions s
  join public.event_participants p on p.event_id=s.scope_event_id and p.user_id=s.user_id
  where s.scope_event_id=p_event and s.token_hash=p_token_hash
    and s.expires_at>now() and s.revoked_at is null;
$$;

grant select on public.workspaces,public.workspace_members,public.event_organizers to authenticated;
create policy related_workspace on public.workspaces for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=workspaces.id and m.profile_id=(select auth.uid()))
);
create policy related_workspace_member on public.workspace_members for select to authenticated using (
  workspace_members.profile_id=(select auth.uid())
  or dolend_private.can_organize_workspace(workspace_members.workspace_id,(select auth.uid()))
);
create policy related_event_organizer on public.event_organizers for select to authenticated using (
  event_organizers.profile_id=(select auth.uid())
  or dolend_private.can_organize_event(event_organizers.event_id,(select auth.uid()))
);

revoke all on function public.bootstrap_google_profile() from public,anon,service_role;
grant execute on function public.bootstrap_google_profile() to authenticated;
revoke all on function public.create_guest_booking(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_guest_booking(uuid,text,text,text) to service_role;
revoke all on function public.get_guest_booking(uuid,text) from public,anon,authenticated;
grant execute on function public.get_guest_booking(uuid,text) to service_role;

revoke all on function dolend_private.is_google_auth_user(uuid),
  dolend_private.can_organize_workspace(uuid,uuid),dolend_private.can_organize_event(uuid,uuid)
  from public,anon,authenticated;
grant execute on function dolend_private.can_organize_workspace(uuid,uuid),
  dolend_private.can_organize_event(uuid,uuid) to authenticated;
grant execute on function dolend_private.is_google_auth_user(uuid),
  dolend_private.can_organize_workspace(uuid,uuid),dolend_private.can_organize_event(uuid,uuid)
  to service_role;
