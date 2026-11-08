alter table public.venues
  add column workspace_id uuid references public.workspaces(id) on delete restrict,
  add column source text not null default 'manual' check (source in ('manual', 'geoapify')),
  add column source_attribution text,
  add column reuse_key text,
  add constraint venues_workspace_reuse_unique unique (workspace_id, reuse_key);

-- Attach a legacy venue only when all its linked events identify the same
-- workspace and its creator is still authorized to organize there.
with linked as (
  select venue_id, array_agg(distinct workspace_id) as workspaces
  from public.events
  where venue_id is not null
  group by venue_id
)
update public.venues v
set workspace_id = linked.workspaces[1]
from linked
where v.id = linked.venue_id
  and cardinality(linked.workspaces) = 1
  and dolend_private.can_organize_workspace(linked.workspaces[1], v.created_by);

drop policy own_venue on public.venues;
create policy organizer_venue_read on public.venues for select to authenticated using (
  (workspace_id is null and created_by = (select auth.uid()))
  or dolend_private.can_organize_workspace(workspace_id, (select auth.uid()))
);

create function public.reserve_venue_search(p_actor uuid, p_workspace uuid)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path='' as $$
declare
  actor_count integer;
  actor_retry integer;
  daily_count integer;
  daily_retry integer;
begin
  if not coalesce(dolend_private.can_organize_workspace(p_workspace,p_actor),false) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select r.current_count,r.retry_after_seconds into actor_count,actor_retry
  from dolend_private.consume_rate_limit('venue-search:actor:'||p_actor::text,12,60) r;
  if actor_count > 12 then
    return query select false,actor_retry;
    return;
  end if;

  -- One autocomplete request costs one credit. Leave margin below the
  -- provider's free quota for other requests under the same account.
  select r.current_count,r.retry_after_seconds into daily_count,daily_retry
  from dolend_private.consume_rate_limit('venue-search:daily',2500,86400) r;
  return query select daily_count <= 2500, case when daily_count > 2500 then daily_retry else 0 end;
end;
$$;

revoke all on function public.reserve_venue_search(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_venue_search(uuid,uuid) to service_role;

create function public.search_workspace_venues(p_actor uuid, p_workspace uuid, p_query text)
returns table(id uuid,name text,address text,city text,latitude numeric,longitude numeric,maps_url text,source text,place_id text,source_attribution text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce(dolend_private.can_organize_workspace(p_workspace,p_actor),false) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  return query
  select v.id,v.name,v.address,v.city,v.latitude,v.longitude,v.maps_url,v.source,v.place_id,v.source_attribution
  from public.venues v
  where (v.workspace_id=p_workspace or (v.workspace_id is null and v.created_by=p_actor))
    and strpos(lower(v.name||' '||v.address||' '||v.city),lower(p_query)) > 0
  order by (strpos(lower(v.name),lower(p_query))=1) desc,v.name,v.id
  limit 12;
end;
$$;

create function public.save_workspace_venue(p_actor uuid, p_workspace uuid, p_venue jsonb)
returns void
language plpgsql security definer set search_path='' as $$
declare
  venue public.venues;
begin
  if not coalesce(dolend_private.can_organize_workspace(p_workspace,p_actor),false) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  venue := jsonb_populate_record(null::public.venues,p_venue);
  insert into public.venues(workspace_id,created_by,name,address,city,latitude,longitude,maps_url,source,place_id,source_attribution,reuse_key)
  values(p_workspace,p_actor,venue.name,venue.address,venue.city,venue.latitude,venue.longitude,venue.maps_url,
         venue.source,venue.place_id,venue.source_attribution,venue.reuse_key)
  on conflict on constraint venues_workspace_reuse_unique do nothing;
end;
$$;

revoke all on function public.search_workspace_venues(uuid,uuid,text),public.save_workspace_venue(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.search_workspace_venues(uuid,uuid,text),public.save_workspace_venue(uuid,uuid,jsonb)
  to service_role;
