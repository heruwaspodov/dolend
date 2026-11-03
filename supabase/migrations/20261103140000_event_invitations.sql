create function public.create_event_invite(
  p_event uuid,
  p_actor uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
) returns public.event_invites
language plpgsql security definer set search_path=''
as $$
declare
  event_row public.events;
  invite_row public.event_invites;
  invite_expiry timestamptz;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INVITE_TOKEN'; end if;
  select * into strict event_row from public.events where id=p_event for update;
  perform dolend_private.assert_organizer(event_row.id,p_actor);
  if event_row.status not in ('published','recruiting','confirmed') then raise exception 'EVENT_NOT_OPEN'; end if;
  invite_expiry=coalesce(p_expires_at,event_row.registration_closes_at);
  if invite_expiry<=clock_timestamp() or invite_expiry>event_row.ends_at then raise exception 'INVALID_INVITE_EXPIRY'; end if;
  insert into public.event_invites(event_id,token_hash,expires_at,created_by)
  values(event_row.id,p_token_hash,invite_expiry,p_actor)
  returning * into invite_row;
  perform dolend_private.audit(p_actor,'event.invite_create','event_invite',invite_row.id,
    jsonb_build_object('event_id',event_row.id,'expires_at',invite_expiry));
  return invite_row;
end;
$$;

create function public.revoke_event_invite(p_invite uuid,p_actor uuid)
returns public.event_invites
language plpgsql security definer set search_path=''
as $$
declare invite_row public.event_invites;
begin
  select * into strict invite_row from public.event_invites where id=p_invite for update;
  perform dolend_private.assert_organizer(invite_row.event_id,p_actor);
  if invite_row.revoked_at is null then
    update public.event_invites set revoked_at=clock_timestamp() where id=invite_row.id returning * into invite_row;
    perform dolend_private.audit(p_actor,'event.invite_revoke','event_invite',invite_row.id,
      jsonb_build_object('event_id',invite_row.event_id));
  end if;
  return invite_row;
end;
$$;

create function public.verify_event_invite(p_event uuid,p_token_hash text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.event_invites i
    join public.events e on e.id=i.event_id
    where i.event_id=p_event
      and i.token_hash=p_token_hash
      and i.revoked_at is null
      and (i.expires_at is null or i.expires_at>statement_timestamp())
      and e.visibility='unlisted'
      and e.status in ('published','recruiting','confirmed','completed')
  );
$$;

revoke all on function public.create_event_invite(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.revoke_event_invite(uuid,uuid) from public,anon,authenticated;
revoke all on function public.verify_event_invite(uuid,text) from public,anon,authenticated;
grant execute on function public.create_event_invite(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.revoke_event_invite(uuid,uuid) to service_role;
grant execute on function public.verify_event_invite(uuid,text) to service_role;
