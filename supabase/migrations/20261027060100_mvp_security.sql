-- All domain mutations are server-only. Never expose service-role keys to the browser.
create function dolend_private.my_person() returns uuid
language sql stable security definer set search_path='' as $$
  select person_id from public.profiles where id=(select auth.uid());
$$;
create function dolend_private.owns_event(p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.events where id=p_event and organizer_profile_id=(select auth.uid()));
$$;
create function dolend_private.can_read_participant(p_participant uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.event_participants p join public.events e on e.id=p.event_id
    where p.id=p_participant and (p.person_id=dolend_private.my_person() or e.organizer_profile_id=(select auth.uid())));
$$;
create function dolend_private.can_read_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.invoices i where i.id=p_invoice and dolend_private.can_read_participant(i.participant_id));
$$;
create function dolend_private.can_read_attempt(p_attempt uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_attempts a where a.id=p_attempt and dolend_private.can_read_invoice(a.invoice_id));
$$;
revoke all on all functions in schema dolend_private from public, anon, authenticated;
grant execute on function dolend_private.my_person(),dolend_private.owns_event(uuid),dolend_private.can_read_participant(uuid),dolend_private.can_read_invoice(uuid),dolend_private.can_read_attempt(uuid) to authenticated;

grant select on public.people,public.profiles,public.venues,public.events,public.event_participants,public.participant_history,
 public.event_payment_methods,public.invoices,public.payment_attempts,public.payment_evidence,public.refunds to authenticated;
grant select on public.activity_types to anon, authenticated;
grant update(bio,avatar_path,default_timezone) on public.profiles to authenticated;
create policy own_person on public.people for select to authenticated using (id=dolend_private.my_person());
create policy own_profile on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy update_own_profile on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy active_categories on public.activity_types for select to anon,authenticated using (active);
create policy own_venue on public.venues for select to authenticated using (created_by=(select auth.uid()));
create policy related_event on public.events for select to authenticated using (
 organizer_profile_id=(select auth.uid()) or exists(select 1 from public.event_participants p where p.event_id=events.id and p.person_id=dolend_private.my_person()));
create policy related_participant on public.event_participants for select to authenticated using (
 person_id=dolend_private.my_person() or dolend_private.owns_event(event_id));
create policy related_history on public.participant_history for select to authenticated using (dolend_private.can_read_participant(participant_id));
create policy related_payment_methods on public.event_payment_methods for select to authenticated using (
 dolend_private.owns_event(event_id) or exists(select 1 from public.event_participants p where p.event_id=event_payment_methods.event_id and p.person_id=dolend_private.my_person()));
create policy related_invoice on public.invoices for select to authenticated using (dolend_private.can_read_participant(participant_id));
create policy related_attempt on public.payment_attempts for select to authenticated using (dolend_private.can_read_invoice(invoice_id));
create policy related_evidence on public.payment_evidence for select to authenticated using (dolend_private.can_read_attempt(attempt_id));
create policy related_refund on public.refunds for select to authenticated using (dolend_private.can_read_invoice(invoice_id));

-- A deliberately curated definer-owned projection: no phone, instructions, tokens or raw snapshots.
create view public.public_events with (security_barrier=true) as
select e.id,e.title,e.description,e.starts_at,e.ends_at,e.timezone,e.capacity,e.price_amount,e.currency,e.status,e.activity_type_id,
 jsonb_build_object('name',e.venue_snapshot->>'name','address',e.venue_snapshot->>'address','maps_url',e.venue_snapshot->>'maps_url') as venue,
 (select count(*)::integer from public.event_participants p where p.event_id=e.id and
  (p.status in ('confirmed','attended','no_show') or (p.status='held' and p.hold_expires_at>statement_timestamp()))) as participants_count
from public.events e where e.visibility='public' and e.status in ('published','completed');
grant select on public.public_events to anon, authenticated, service_role;
comment on view public.public_events is 'Intentional definer projection; explicit public filter/column allowlist. Never expose raw event/identity tables to anon.';

create function dolend_private.assert_profile(p_profile uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_person uuid;
begin
 select p.id into v_person from public.profiles pr join public.people p on p.id=pr.person_id join auth.users u on u.id=pr.id
 where pr.id=p_profile and p.state='active' and p.phone_verified_at is not null
 and u.phone_confirmed_at is not null and replace(u.phone,'+','')=p.phone_normalized and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<now());
 if v_person is null then raise exception 'VERIFIED_MEMBER_REQUIRED' using errcode='42501'; end if;
 return v_person;
end; $$;
create function dolend_private.assert_person(p_person uuid,p_event uuid,p_profile uuid,p_guest_hash text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_profile is not null then
  if dolend_private.assert_profile(p_profile)<>p_person then raise exception 'ACTOR_MISMATCH' using errcode='42501'; end if;
 elsif not exists(select 1 from public.guest_sessions s join public.people p on p.id=s.person_id
  where s.person_id=p_person and s.scope_event_id=p_event and s.token_hash=p_guest_hash and s.expires_at>now() and s.revoked_at is null
  and p.state='active' and p.phone_verified_at is not null) then
  raise exception 'VERIFIED_GUEST_REQUIRED' using errcode='42501';
 end if;
end; $$;
create function dolend_private.assert_organizer(p_event uuid,p_profile uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform dolend_private.assert_profile(p_profile);
 if not exists(select 1 from public.events where id=p_event and organizer_profile_id=p_profile) then
  raise exception 'ORGANIZER_REQUIRED' using errcode='42501'; end if;
end; $$;
create function dolend_private.audit(p_actor uuid,p_action text,p_type text,p_id uuid,p_changes jsonb default '{}'::jsonb) returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,redacted_changes)
 values(case when p_actor is null then 'system' else 'profile' end,p_actor,p_action,p_type,p_id,p_changes);
$$;
create function dolend_private.occupancy(p_event uuid,p_exclude uuid default null) returns integer
language sql volatile security definer set search_path='' as $$
 select count(*)::integer from public.event_participants where event_id=p_event and (p_exclude is null or id<>p_exclude)
 and (status in ('confirmed','attended','no_show') or (status='held' and hold_expires_at>clock_timestamp()));
$$;

create function dolend_private.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform dolend_private.assert_profile(new.organizer_profile_id);
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'INVALID_TIMEZONE'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.organizer_profile_id<>old.organizer_profile_id then raise exception 'IMMUTABLE_EVENT_OWNER'; end if;
  if new.capacity<dolend_private.occupancy(new.id) then raise exception 'CAPACITY_BELOW_OCCUPANCY'; end if;
  if new.payment_mode<>old.payment_mode and exists(select 1 from public.event_participants where event_id=new.id) then raise exception 'PAYMENT_MODE_LOCKED'; end if;
  if new.status<>old.status and not ((old.status='draft' and new.status in ('published','cancelled')) or (old.status='published' and new.status in ('completed','cancelled'))) then raise exception 'INVALID_EVENT_TRANSITION'; end if;
  if new.status='completed' and old.status<>'completed' and clock_timestamp()<new.ends_at then raise exception 'EVENT_NOT_ENDED'; end if;
  new.version=old.version+1;
 end if;
 if new.status='published' and (tg_op='INSERT' or old.status='draft') then
  if new.starts_at<=clock_timestamp() or new.registration_closes_at<=clock_timestamp() or coalesce(new.venue_snapshot->>'name','')='' or coalesce(new.venue_snapshot->>'address','')='' then raise exception 'INCOMPLETE_EVENT'; end if;
  if new.payment_mode<>'free' and not exists(select 1 from public.event_payment_methods where event_id=new.id and enabled) then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
 end if;
 return new;
end; $$;
create trigger guard_event before insert or update on public.events for each row execute function dolend_private.guard_event();

create function dolend_private.guard_participant() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into strict e from public.events where id=new.event_id for update;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.event_id<>old.event_id or new.person_id<>old.person_id or new.joined_as<>old.joined_as then raise exception 'IMMUTABLE_PARTICIPANT'; end if;
  if new.status<>old.status and not (
   (old.status='held' and new.status in ('confirmed','expired','cancelled')) or
   (old.status='confirmed' and new.status in ('attended','no_show','cancelled')) or
   (old.status in ('attended','no_show') and new.status in ('attended','no_show')) or
   (old.status='expired' and new.status in ('held','confirmed','cancelled')) or
   (old.status='cancelled' and new.status in ('held','confirmed'))) then raise exception 'INVALID_PARTICIPANT_TRANSITION'; end if;
 end if;
 if new.status='held' and new.hold_expires_at<=clock_timestamp() then raise exception 'INVALID_HOLD_EXPIRY'; end if;
 if new.status in ('attended','no_show') and clock_timestamp()<e.starts_at then raise exception 'EVENT_NOT_STARTED'; end if;
 if new.status in ('held','confirmed') then
   if e.status<>'published' then raise exception 'EVENT_NOT_OPEN'; end if;
   if dolend_private.occupancy(new.event_id,new.id)>=e.capacity then raise exception 'EVENT_FULL'; end if;
   if e.payment_mode='before_event' and new.status='confirmed' and not exists(select 1 from public.invoices where participant_id=new.id and status='paid') then raise exception 'PAYMENT_REQUIRED'; end if;
 end if;
 return new;
end; $$;
create trigger guard_participant before insert or update on public.event_participants for each row execute function dolend_private.guard_participant();
create function dolend_private.participant_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or old.status<>new.status then
  insert into public.participant_history(participant_id,from_status,to_status,reason)
  values(new.id,case when tg_op='INSERT' then null else old.status end,new.status,new.cancellation_reason);
 end if; return new;
end; $$;
create trigger record_participant_history after insert or update on public.event_participants for each row execute function dolend_private.participant_history();

create function dolend_private.guard_attempt() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.invoices; m public.event_payment_methods; v_event_id uuid;
begin
 select * into strict i from public.invoices where id=new.invoice_id;
 select p.event_id into strict v_event_id from public.event_participants p where p.id=i.participant_id;
 select * into strict m from public.event_payment_methods where id=new.payment_method_id;
 if m.event_id<>v_event_id or m.method_type<>new.method_type or m.provider is distinct from new.provider or i.amount_due<>new.amount or i.currency<>new.currency then raise exception 'PAYMENT_MISMATCH'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.invoice_id<>old.invoice_id or new.amount<>old.amount or new.currency<>old.currency or new.payment_method_id<>old.payment_method_id then raise exception 'IMMUTABLE_PAYMENT_ATTEMPT'; end if;
  if old.status='succeeded' and new.status<>'succeeded' then raise exception 'PAYMENT_ALREADY_SUCCEEDED'; end if;
 end if;
 return new;
end; $$;
create trigger guard_attempt before insert or update on public.payment_attempts for each row execute function dolend_private.guard_attempt();

create function dolend_private.guard_invoice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.participant_id<>old.participant_id or new.amount_due<>old.amount_due or new.currency<>old.currency or new.pricing_snapshot<>old.pricing_snapshot then raise exception 'IMMUTABLE_INVOICE_PRICE'; end if;
  if old.status='paid' and new.status<>'paid' then raise exception 'INVOICE_ALREADY_PAID'; end if;
 end if;
 if new.status='paid' and (select coalesce(sum(amount),0) from public.payment_ledger where invoice_id=new.id and entry_type='receipt')<new.amount_due then raise exception 'RECEIPT_REQUIRED'; end if;
 return new;
end; $$;
create trigger guard_invoice before insert or update on public.invoices for each row execute function dolend_private.guard_invoice();

create function dolend_private.guard_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.default_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.person_id<>old.person_id) then raise exception 'IMMUTABLE_PROFILE_IDENTITY'; end if;
 return new;
end; $$;
create trigger guard_profile before insert or update on public.profiles for each row execute function dolend_private.guard_profile();
-- No blanket privileges on later helpers: default PUBLIC EXECUTE is removed explicitly.
revoke all on all functions in schema dolend_private from public, anon;
revoke execute on function dolend_private.assert_profile(uuid),dolend_private.assert_person(uuid,uuid,uuid,text),dolend_private.assert_organizer(uuid,uuid),dolend_private.audit(uuid,text,text,uuid,jsonb),dolend_private.occupancy(uuid,uuid),dolend_private.guard_event(),dolend_private.guard_participant(),dolend_private.participant_history(),dolend_private.guard_attempt(),dolend_private.guard_invoice(),dolend_private.guard_profile() from authenticated,service_role;
