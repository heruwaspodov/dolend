-- A WhatsApp number linked to a member profile cannot be reused as guest proof.
-- This replaces the latest dynamic-event implementation without changing stored rows.
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
  if event_row.status not in ('published','recruiting','confirmed')
    or event_row.registration_closes_at<=clock_timestamp()
    or event_row.starts_at<=clock_timestamp() then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into public.users(display_name,phone_normalized)
  values(trim(p_display_name),p_phone_normalized)
  on conflict(phone_normalized) do nothing;

  select * into strict domain_user from public.users
  where phone_normalized=p_phone_normalized for update;
  if domain_user.state<>'active' then raise exception 'GUEST_NOT_ACTIVE' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where user_id=domain_user.id) then
    raise exception 'GUEST_ACCOUNT_REQUIRED' using errcode='42501';
  end if;
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

revoke all on function public.create_guest_booking(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_guest_booking(uuid,text,text,text) to service_role;
