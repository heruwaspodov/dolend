-- Lost guest links are recovered by a verified event organizer, never by phone lookup.
create or replace function public.rotate_guest_booking_token(
  p_participant uuid,
  p_actor uuid,
  p_token_hash text
) returns public.event_participants
language plpgsql security definer set search_path='' as $$
declare
  participant public.event_participants;
  event_row public.events;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_GUEST_TOKEN'; end if;

  select * into strict participant from public.event_participants
  where id=p_participant for update;
  perform dolend_private.assert_organizer(participant.event_id,p_actor);
  if participant.joined_as<>'guest' or participant.status not in ('held','confirmed') then
    raise exception 'GUEST_RECOVERY_UNAVAILABLE';
  end if;
  select * into strict event_row from public.events where id=participant.event_id;

  update public.guest_sessions
  set revoked_at=clock_timestamp()
  where user_id=participant.user_id
    and scope_event_id=participant.event_id
    and revoked_at is null;
  insert into public.guest_sessions(user_id,scope_event_id,token_hash,expires_at)
  values(participant.user_id,participant.event_id,p_token_hash,greatest(event_row.ends_at+interval '30 days',clock_timestamp()+interval '24 hours'));
  perform dolend_private.audit(p_actor,'guest.booking_token_rotate','event_participant',participant.id);
  return participant;
end;
$$;

revoke all on function public.rotate_guest_booking_token(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rotate_guest_booking_token(uuid,uuid,text) to service_role;
