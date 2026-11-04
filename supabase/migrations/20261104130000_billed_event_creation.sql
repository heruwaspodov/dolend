create function public.create_billed_event(
 p_actor uuid,
 p_workspace uuid,
 p_activity_type uuid,
 p_title text,
 p_description text,
 p_starts_at timestamptz,
 p_ends_at timestamptz,
 p_registration_closes_at timestamptz,
 p_timezone text,
 p_capacity integer,
 p_visibility text,
 p_venue_snapshot jsonb,
 p_payment_mode text,
 p_price_amount bigint,
 p_payment_due_at timestamptz default null,
 p_hold_minutes integer default 15,
 p_payment_method uuid default null
) returns public.events
language plpgsql security definer set search_path='' as $$
declare event_row public.events; method public.organizer_payment_methods;
begin
 perform dolend_private.assert_profile(p_actor);
 if not dolend_private.can_organize_workspace(p_workspace,p_actor) then raise exception 'ORGANIZER_REQUIRED' using errcode='42501'; end if;
 if p_payment_mode not in ('free','before_event','after_event') then raise exception 'INVALID_PAYMENT_MODE'; end if;
 if (p_payment_mode='free' and (p_price_amount<>0 or p_payment_method is not null)) or
    (p_payment_mode<>'free' and (p_price_amount<=0 or p_payment_method is null)) then raise exception 'INVALID_BILLING_CONFIGURATION'; end if;
 if p_payment_mode='after_event' and (p_payment_due_at is null or p_payment_due_at<p_ends_at) then raise exception 'INVALID_PAYMENT_DUE_AT'; end if;

 if p_payment_method is not null then
  select * into method from public.organizer_payment_methods
  where id=p_payment_method and organizer_id=p_actor and type='bank_transfer' and is_active;
  if method.id is null then raise exception 'INVALID_PAYMENT_METHOD'; end if;
 end if;

 insert into public.events(
  organizer_profile_id,workspace_id,activity_type_id,title,description,starts_at,ends_at,
  registration_closes_at,timezone,capacity,visibility,status,payment_mode,price_amount,
  payment_due_at,hold_minutes,venue_snapshot,contribution_mode,estimated_total_cost
 ) values(
  p_actor,p_workspace,p_activity_type,p_title,coalesce(p_description,''),p_starts_at,p_ends_at,
  p_registration_closes_at,p_timezone,p_capacity,p_visibility,'draft',p_payment_mode,p_price_amount,
  p_payment_due_at,p_hold_minutes,p_venue_snapshot,'legacy',p_price_amount
 ) returning * into event_row;

 insert into public.event_organizers(event_id,profile_id,role) values(event_row.id,p_actor,'owner');
 if method.id is not null then
  insert into public.event_payment_methods(event_id,method_type,instruction_snapshot)
  values(event_row.id,'manual_bank_transfer',jsonb_build_object(
   'source_method_id',method.id,'recipient_name',method.recipient_name,'bank_details',method.bank_details
  ));
 end if;
 update public.events set status='published' where id=event_row.id returning * into event_row;
 perform dolend_private.audit(p_actor,'event.create','event',event_row.id,jsonb_build_object('billing_mode',p_payment_mode));
 return event_row;
end; $$;

revoke all on function public.create_billed_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,text,integer,text,jsonb,text,bigint,timestamptz,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_billed_event(uuid,uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,text,integer,text,jsonb,text,bigint,timestamptz,integer,uuid) to service_role;

create function public.update_billed_event(
 p_event uuid,p_actor uuid,p_expected_version integer,p_title text default null,p_description text default null,
 p_starts_at timestamptz default null,p_ends_at timestamptz default null,p_registration_closes_at timestamptz default null,
 p_capacity integer default null,p_venue_booking_status text default null,p_status text default null,p_venue_snapshot jsonb default null
) returns public.events
language plpgsql security definer set search_path='' as $$
declare current_event public.events; updated_event public.events; changed_fields jsonb;
begin
 select * into strict current_event from public.events where id=p_event for update;
 perform dolend_private.assert_organizer(current_event.id,p_actor);
 if current_event.contribution_mode<>'legacy' then raise exception 'INVALID_EVENT_STATE'; end if;
 if current_event.status in ('completed','cancelled') then raise exception 'EVENT_FINALIZED'; end if;
 if p_expected_version is null or p_expected_version<>current_event.version then raise exception 'EVENT_VERSION_CONFLICT'; end if;
 select coalesce(jsonb_agg(field order by field),'[]'::jsonb) into changed_fields from (values
  ('capacity',p_capacity is not null and p_capacity is distinct from current_event.capacity),
  ('description',p_description is not null and p_description is distinct from current_event.description),
  ('ends_at',p_ends_at is not null and p_ends_at is distinct from current_event.ends_at),
  ('registration_closes_at',p_registration_closes_at is not null and p_registration_closes_at is distinct from current_event.registration_closes_at),
  ('starts_at',p_starts_at is not null and p_starts_at is distinct from current_event.starts_at),
  ('status',p_status is not null and p_status is distinct from current_event.status),
  ('title',p_title is not null and p_title is distinct from current_event.title),
  ('venue_booking_status',p_venue_booking_status is not null and p_venue_booking_status is distinct from current_event.venue_booking_status),
  ('venue_snapshot',p_venue_snapshot is not null and p_venue_snapshot is distinct from current_event.venue_snapshot)
 ) changes(field,changed) where changed;
 if changed_fields='[]'::jsonb then raise exception 'NO_EVENT_CHANGES'; end if;
 update public.events set title=coalesce(p_title,title),description=coalesce(p_description,description),
  starts_at=coalesce(p_starts_at,starts_at),ends_at=coalesce(p_ends_at,ends_at),
  registration_closes_at=coalesce(p_registration_closes_at,registration_closes_at),capacity=coalesce(p_capacity,capacity),
  venue_booking_status=coalesce(p_venue_booking_status,venue_booking_status),status=coalesce(p_status,status),
  venue_snapshot=coalesce(p_venue_snapshot,venue_snapshot)
 where id=current_event.id and version=p_expected_version returning * into strict updated_event;
 perform dolend_private.audit(p_actor,case when p_status is not null and p_status is distinct from current_event.status then 'event.status_change' else 'event.edit' end,
  'event',updated_event.id,jsonb_build_object('fields',changed_fields,'from_version',current_event.version,'to_version',updated_event.version));
 return updated_event;
end; $$;
revoke all on function public.update_billed_event(uuid,uuid,integer,text,text,timestamptz,timestamptz,timestamptz,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_billed_event(uuid,uuid,integer,text,text,timestamptz,timestamptz,timestamptz,integer,text,text,jsonb) to service_role;
