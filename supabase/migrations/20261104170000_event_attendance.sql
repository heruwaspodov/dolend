create function public.record_event_attendance(
  p_participant uuid,
  p_actor uuid,
  p_status text
) returns public.event_participants
language plpgsql security definer set search_path='' as $$
declare
  event_row public.events;
  participant_row public.event_participants;
begin
  if p_status not in ('attended','no_show') then
    raise exception 'INVALID_ATTENDANCE_STATUS';
  end if;

  select e.* into strict event_row
  from public.events e
  join public.event_participants p on p.event_id=e.id
  where p.id=p_participant
  for update of e;
  perform dolend_private.assert_organizer(event_row.id,p_actor);

  select * into strict participant_row
  from public.event_participants where id=p_participant for update;
  if participant_row.status=p_status then return participant_row; end if;
  if participant_row.status not in ('confirmed','attended','no_show') then
    raise exception 'INVALID_ATTENDANCE_STATE';
  end if;

  update public.event_participants
  set status=p_status,attendance_at=clock_timestamp()
  where id=p_participant returning * into participant_row;
  perform dolend_private.audit(p_actor,'participant.attendance','participant',participant_row.id,jsonb_build_object('status',p_status));
  return participant_row;
end;
$$;

revoke all on function public.record_event_attendance(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_event_attendance(uuid,uuid,text) to service_role;
