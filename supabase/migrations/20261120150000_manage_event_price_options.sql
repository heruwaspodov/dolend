create function public.set_event_price_options(
 p_event uuid, p_actor uuid, p_expected_version integer, p_options jsonb
) returns public.events
language plpgsql security definer set search_path='' as $$
declare
 e public.events;
 updated_event public.events;
 item jsonb;
 quota_sum integer := 0;
 min_amount bigint;
begin
 select * into strict e from public.events where id=p_event for update;
 perform dolend_private.assert_organizer(e.id,p_actor);
 if e.cost_model<>'fixed' or e.status in ('completed','cancelled') then raise exception 'INVALID_EVENT_STATE'; end if;
 if p_expected_version is distinct from e.version then raise exception 'EVENT_VERSION_CONFLICT'; end if;
 if exists(select 1 from public.event_participants where event_id=e.id) then raise exception 'PRICE_OPTIONS_LOCKED'; end if;
 if pg_catalog.jsonb_typeof(p_options)<>'array' or pg_catalog.jsonb_array_length(p_options) not between 2 and 20 then raise exception 'INVALID_PRICE_OPTIONS'; end if;
 for item in select value from pg_catalog.jsonb_array_elements(p_options) loop
  if pg_catalog.jsonb_typeof(item)<>'object' or coalesce(pg_catalog.length(pg_catalog.btrim(item->>'name')),0) not between 1 and 80
    or coalesce(item->>'amount','') !~ '^[1-9][0-9]{0,12}$'
    or coalesce(item->>'quota','') !~ '^[1-9][0-9]{0,5}$'
    or (item->>'amount')::bigint>1000000000000 or (item->>'quota')::integer>100000 then raise exception 'INVALID_PRICE_OPTIONS'; end if;
  quota_sum:=quota_sum+(item->>'quota')::integer;
  min_amount:=least(coalesce(min_amount,(item->>'amount')::bigint),(item->>'amount')::bigint);
 end loop;
 if quota_sum<>e.capacity or exists(
  select 1 from (select pg_catalog.lower(pg_catalog.btrim(value->>'name')) name from pg_catalog.jsonb_array_elements(p_options)) names
  group by name having count(*)>1
 ) then raise exception 'INVALID_PRICE_OPTIONS'; end if;
 delete from public.event_price_options where event_id=e.id;
 insert into public.event_price_options(event_id,name,amount,quota,sort_order)
 select e.id,pg_catalog.btrim(value->>'name'),(value->>'amount')::bigint,(value->>'quota')::integer,(ordinality-1)::integer
 from pg_catalog.jsonb_array_elements(p_options) with ordinality;
 update public.events set price_amount=min_amount where id=e.id returning * into updated_event;
 perform dolend_private.audit(p_actor,'event.price_options_change','event',e.id,
  pg_catalog.jsonb_build_object('from_version',e.version,'to_version',updated_event.version));
 return updated_event;
end; $$;
revoke all on function public.set_event_price_options(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.set_event_price_options(uuid,uuid,integer,jsonb) to service_role;
