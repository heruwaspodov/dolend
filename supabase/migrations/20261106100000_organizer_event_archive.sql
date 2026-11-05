alter table public.events add column archived_at timestamptz;

create function public.set_organizer_event_archive(p_event uuid, p_actor uuid, p_archived boolean)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_archived_at timestamptz;
begin
  perform dolend_private.assert_organizer(p_event, p_actor);
  select archived_at into v_archived_at from public.events where id = p_event for update;
  if not found then
    raise insufficient_privilege using message = 'ORGANIZER_REQUIRED';
  end if;

  if (v_archived_at is not null) = p_archived then
    return v_archived_at;
  end if;

  update public.events
  set archived_at = case when p_archived then now() else null end
  where id = p_event
  returning archived_at into v_archived_at;

  perform dolend_private.audit(p_actor, case when p_archived then 'event.archive' else 'event.restore' end, 'event', p_event);
  return v_archived_at;
end;
$$;

revoke all on function public.set_organizer_event_archive(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_organizer_event_archive(uuid, uuid, boolean) to service_role;
