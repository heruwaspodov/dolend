-- Restore the latest cancellation behavior after the identity routine refresh.
create or replace function public.cancel_event(p_event_id uuid,p_actor_profile_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events; participant record;
begin
 select * into strict e from public.events where id=p_event_id for update;
 perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 if e.status='cancelled' then return; end if;
 if e.status='completed' then raise exception 'EVENT_ALREADY_COMPLETED'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 for participant in select id from public.event_participants where event_id=e.id and status in ('held','confirmed','expired') order by id loop
  perform public.cancel_participation(participant.id,p_reason,p_actor_profile_id);
 end loop;
 update public.events set status='cancelled' where id=e.id;
 update public.invoices i set status='void' from public.event_participants p where p.id=i.participant_id and p.event_id=e.id and i.status='open';
 insert into public.outbox_jobs(kind,aggregate_id,dedupe_key)
 select 'refund_review',i.id,'refund-review:'||i.id::text from public.invoices i join public.event_participants p on p.id=i.participant_id
 where p.event_id=e.id and (select coalesce(sum(case l.entry_type when 'receipt' then l.amount when 'refund' then -l.amount else 0 end),0) from public.payment_ledger l where l.invoice_id=i.id)>0
 on conflict(dedupe_key) do nothing;
 perform dolend_private.audit(p_actor_profile_id,'event.cancel','event',e.id);
end; $$;

revoke all on function public.cancel_event(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_event(uuid,uuid,text) to service_role;
