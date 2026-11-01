create function dolend_private.valid_event_venue_snapshot(snapshot jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path=''
as $$
declare
  latitude numeric;
  longitude numeric;
begin
  if jsonb_typeof(snapshot) <> 'object' then return false; end if;
  if snapshot ? 'meeting_instructions' and (
    jsonb_typeof(snapshot->'meeting_instructions') <> 'string'
    or length(snapshot->>'meeting_instructions') > 1000
  ) then return false; end if;
  if (snapshot ? 'latitude') <> (snapshot ? 'longitude') then return false; end if;
  if not (snapshot ? 'latitude') then return true; end if;
  if jsonb_typeof(snapshot->'latitude') <> 'number'
    or jsonb_typeof(snapshot->'longitude') <> 'number' then return false; end if;
  latitude=(snapshot->>'latitude')::numeric;
  longitude=(snapshot->>'longitude')::numeric;
  return latitude between -90 and 90 and longitude between -180 and 180;
exception when others then
  return false;
end;
$$;

revoke all on function dolend_private.valid_event_venue_snapshot(jsonb) from public,anon,authenticated,service_role;

alter table public.events
  add constraint events_venue_snapshot_fields_check
  check (dolend_private.valid_event_venue_snapshot(venue_snapshot));
