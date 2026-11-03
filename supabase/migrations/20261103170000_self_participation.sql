create function public.cancel_own_dynamic_participation(
  p_event uuid,
  p_actor uuid,
  p_guest_hash text,
  p_reason text
) returns public.event_participants
language plpgsql security definer set search_path=''
as $$
declare
  event_row public.events;
  participant_row public.event_participants;
begin
  select * into strict event_row from public.events where id=p_event for update;
  if event_row.contribution_mode<>'dynamic' then raise exception 'INVALID_EVENT_STATE'; end if;

  if p_actor is not null then
    select participant.* into participant_row
    from public.profiles profile
    join public.event_participants participant on participant.user_id=profile.user_id
    where profile.id=p_actor and participant.event_id=event_row.id
    for update of participant;
  elsif p_guest_hash is not null then
    select participant.* into participant_row
    from public.guest_sessions session
    join public.event_participants participant
      on participant.event_id=session.scope_event_id and participant.user_id=session.user_id
    where session.scope_event_id=event_row.id
      and session.token_hash=p_guest_hash
      and session.revoked_at is null
      and session.expires_at>clock_timestamp()
    for update of participant;
  end if;

  if participant_row.id is null then
    raise exception 'PARTICIPATION_NOT_FOUND' using errcode='42501';
  end if;
  perform dolend_private.assert_user(participant_row.user_id,event_row.id,p_actor,p_guest_hash);
  if participant_row.status='cancelled' then return participant_row; end if;
  if participant_row.status in ('attended','no_show') then raise exception 'ATTENDANCE_RECORDED'; end if;
  if event_row.status in ('completed','cancelled') then raise exception 'INVALID_EVENT_STATE'; end if;
  if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'REASON_REQUIRED'; end if;

  update public.event_participants
  set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=trim(p_reason)
  where id=participant_row.id
  returning * into participant_row;
  perform dolend_private.audit(p_actor,'participant.self_cancel','participant',participant_row.id,
    jsonb_build_object('event_id',event_row.id,'charge_policy','retain'));
  return participant_row;
end;
$$;

revoke all on function public.cancel_own_dynamic_participation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_own_dynamic_participation(uuid,uuid,text,text) to service_role;
