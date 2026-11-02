create function public.update_dynamic_event(
  p_event uuid,
  p_actor uuid,
  p_expected_version integer,
  p_title text default null,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_registration_closes_at timestamptz default null,
  p_timezone text default null,
  p_capacity integer default null,
  p_estimated_total_cost bigint default null,
  p_payment_timing text default null,
  p_venue_booking_status text default null,
  p_status text default null,
  p_venue_snapshot jsonb default null
) returns public.events
language plpgsql security definer set search_path=''
as $$
declare
  current_event public.events;
  updated_event public.events;
  changed_fields jsonb;
begin
  select * into strict current_event
  from public.events
  where id=p_event
  for update;

  perform dolend_private.assert_organizer(current_event.id,p_actor);
  if current_event.contribution_mode<>'dynamic' then raise exception 'INVALID_EVENT_STATE'; end if;
  if current_event.status in ('completed','cancelled') then raise exception 'EVENT_FINALIZED'; end if;
  if p_expected_version is null or p_expected_version<>current_event.version then
    raise exception 'EVENT_VERSION_CONFLICT';
  end if;

  select coalesce(jsonb_agg(field order by field),'[]'::jsonb) into changed_fields
  from (values
    ('capacity',p_capacity is not null and p_capacity is distinct from current_event.capacity),
    ('description',p_description is not null and p_description is distinct from current_event.description),
    ('ends_at',p_ends_at is not null and p_ends_at is distinct from current_event.ends_at),
    ('estimated_total_cost',p_estimated_total_cost is not null and p_estimated_total_cost is distinct from current_event.estimated_total_cost),
    ('payment_timing',p_payment_timing is not null and p_payment_timing is distinct from current_event.payment_timing),
    ('registration_closes_at',p_registration_closes_at is not null and p_registration_closes_at is distinct from current_event.registration_closes_at),
    ('starts_at',p_starts_at is not null and p_starts_at is distinct from current_event.starts_at),
    ('status',p_status is not null and p_status is distinct from current_event.status),
    ('timezone',p_timezone is not null and p_timezone is distinct from current_event.timezone),
    ('title',p_title is not null and p_title is distinct from current_event.title),
    ('venue_booking_status',p_venue_booking_status is not null and p_venue_booking_status is distinct from current_event.venue_booking_status),
    ('venue_snapshot',p_venue_snapshot is not null and p_venue_snapshot is distinct from current_event.venue_snapshot)
  ) changes(field,changed)
  where changed;

  if changed_fields='[]'::jsonb then raise exception 'NO_EVENT_CHANGES'; end if;

  update public.events set
    title=coalesce(p_title,title),
    description=coalesce(p_description,description),
    starts_at=coalesce(p_starts_at,starts_at),
    ends_at=coalesce(p_ends_at,ends_at),
    registration_closes_at=coalesce(p_registration_closes_at,registration_closes_at),
    timezone=coalesce(p_timezone,timezone),
    capacity=coalesce(p_capacity,capacity),
    estimated_total_cost=coalesce(p_estimated_total_cost,estimated_total_cost),
    payment_timing=coalesce(p_payment_timing,payment_timing),
    venue_booking_status=coalesce(p_venue_booking_status,venue_booking_status),
    status=coalesce(p_status,status),
    venue_snapshot=coalesce(p_venue_snapshot,venue_snapshot)
  where id=current_event.id and version=p_expected_version
  returning * into strict updated_event;

  perform dolend_private.audit(
    p_actor,
    case when p_status is not null and p_status is distinct from current_event.status then 'event.status_change' else 'event.edit' end,
    'event',
    updated_event.id,
    jsonb_strip_nulls(jsonb_build_object(
      'fields',changed_fields,
      'from_version',current_event.version,
      'to_version',updated_event.version,
      'from_status',case when p_status is not null and p_status is distinct from current_event.status then current_event.status end,
      'to_status',case when p_status is not null and p_status is distinct from current_event.status then updated_event.status end
    ))
  );
  return updated_event;
end;
$$;

revoke all on function public.update_dynamic_event(uuid,uuid,integer,text,text,timestamptz,timestamptz,timestamptz,text,integer,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.update_dynamic_event(uuid,uuid,integer,text,text,timestamptz,timestamptz,timestamptz,text,integer,bigint,text,text,text,jsonb) to service_role;
