create function public.run_payment_maintenance(p_limit integer default 100)
returns table(events_processed integer,participants_expired integer)
language plpgsql security definer set search_path='' as $$
declare event_id uuid; event_count integer:=0; participant_count integer:=0;
begin
  if p_limit<1 or p_limit>500 then raise exception 'INVALID_BATCH_LIMIT'; end if;
  for event_id in
    select e.id from public.events e where exists(
      select 1 from public.event_participants p where p.event_id=e.id and p.status='held' and p.hold_expires_at<=clock_timestamp()
    ) or exists(
      select 1 from public.payment_attempts a join public.invoices i on i.id=a.invoice_id join public.event_participants p on p.id=i.participant_id
      where p.event_id=e.id and ((a.status in ('created','pending') and a.expires_at<=clock_timestamp()) or (a.status='pending_review' and a.review_deadline<=clock_timestamp()))
    ) order by e.id limit p_limit
  loop
    event_count:=event_count+1;
    participant_count:=participant_count+public.expire_holds(event_id);
  end loop;
  return query select event_count,participant_count;
end;
$$;
revoke all on function public.run_payment_maintenance(integer) from public,anon,authenticated;
grant execute on function public.run_payment_maintenance(integer) to service_role;
