create or replace function public.cancel_dynamic_participant(p_participant uuid,p_actor uuid,p_guest_hash text,p_policy text,p_reason text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; c public.participant_charges; total bigint;
begin
  select e0.* into strict e from public.events e0 join public.event_participants p0 on p0.event_id=e0.id where p0.id=p_participant for update of e0;
  select * into strict p from public.event_participants where id=p_participant;
  if e.contribution_mode<>'dynamic' then raise exception 'INVALID_EVENT_STATE'; end if;
  if e.contributions_locked_at is not null or (p_actor is not null and dolend_private.can_organize_event(e.id,p_actor)) then
    perform dolend_private.assert_organizer(e.id,p_actor);
  else
    perform dolend_private.assert_user(p.user_id,e.id,p_actor,p_guest_hash);
  end if;
  if p.status='cancelled' then return; end if;
  if e.status in ('completed','cancelled') then raise exception 'INVALID_EVENT_STATE'; end if;
  if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'REASON_REQUIRED'; end if;
  if e.contributions_locked_at is not null then
    if p_policy not in ('retain','waive') then raise exception 'EXPLICIT_CANCEL_POLICY_REQUIRED'; end if;
    select * into c from public.participant_charges where participant_id=p.id;
    if p_policy='waive' and c.id is not null then
      select c.amount+coalesce(sum(amount) filter(where entry_type='adjustment'),0) into total from public.contribution_ledger where charge_id=c.id;
      if total<>0 then perform public.adjust_contribution(c.id,p_actor,'adjustment',-total,p_reason,p_key); end if;
    end if;
  end if;
  update public.event_participants set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=p_reason where id=p.id;
  perform dolend_private.audit(p_actor,'participant.cancel','participant',p.id);
end; $$;

create function public.cancel_dynamic_event(
  p_event uuid,
  p_actor uuid,
  p_policy text,
  p_reason text,
  p_key text
) returns void
language plpgsql security definer set search_path='' as $$
declare
  e public.events;
  participant record;
begin
  select * into strict e from public.events where id=p_event for update;
  perform dolend_private.assert_organizer(e.id,p_actor);
  if e.contribution_mode<>'dynamic' then raise exception 'INVALID_EVENT_STATE'; end if;
  if e.status='cancelled' then return; end if;
  if e.status='completed' then raise exception 'EVENT_ALREADY_COMPLETED'; end if;
  if p_policy not in ('retain','waive') then raise exception 'EXPLICIT_CANCEL_POLICY_REQUIRED'; end if;
  if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'REASON_REQUIRED'; end if;
  if length(trim(coalesce(p_key,''))) not between 1 and 120 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  for participant in
    select id from public.event_participants
    where event_id=e.id and status in ('held','confirmed','expired')
    order by id
  loop
    perform public.cancel_dynamic_participant(
      participant.id,
      p_actor,
      null,
      p_policy,
      p_reason,
      p_key||':'||participant.id::text
    );
  end loop;

  update public.events set status='cancelled' where id=e.id;
  perform dolend_private.audit(p_actor,'event.cancel','event',e.id);
end; $$;

revoke all on function public.cancel_dynamic_event(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cancel_dynamic_event(uuid,uuid,text,text,text) to service_role;
