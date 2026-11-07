alter table public.event_invites add column share_nonce uuid;

create unique index event_invites_one_share_link
  on public.event_invites(event_id)
  where share_nonce is not null and revoked_at is null;

create function public.ensure_event_share_link(
  p_event uuid,
  p_actor uuid,
  p_share_nonce uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
) returns public.event_invites
language plpgsql security definer set search_path=''
as $$
declare
  event_row public.events;
  invite_row public.event_invites;
  checked_at timestamptz;
begin
  if p_share_nonce is null or p_token_hash is null then raise exception 'INVALID_INVITE_TOKEN'; end if;
  select * into strict event_row from public.events where id=p_event for update;
  perform dolend_private.assert_organizer(event_row.id,p_actor);
  if event_row.visibility <> 'unlisted' or event_row.status not in ('published','recruiting','confirmed') then
    raise exception 'INVALID_EVENT_STATE';
  end if;
  checked_at=clock_timestamp();
  select * into invite_row from public.event_invites
    where event_id=p_event and share_nonce is not null and revoked_at is null and expires_at>checked_at
    for update;
  if found then return invite_row; end if;

  for invite_row in
    select * from public.event_invites
    where event_id=p_event and revoked_at is null
      and (share_nonce is not null or expires_at is null or expires_at>checked_at)
    order by id for update
  loop
    perform public.revoke_event_invite(invite_row.id,p_actor);
  end loop;

  invite_row=public.create_event_invite(p_event,p_actor,p_token_hash,coalesce(p_expires_at,event_row.ends_at));
  update public.event_invites set share_nonce=p_share_nonce where id=invite_row.id returning * into invite_row;
  return invite_row;
end;
$$;

revoke all on function public.ensure_event_share_link(uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ensure_event_share_link(uuid,uuid,uuid,text,timestamptz) to service_role;
