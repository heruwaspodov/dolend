-- Rename the Dolend business identity model. Supabase login identities remain in auth.users.
-- This migration supports the already-deployed schema; fresh installs already use the final names.
do $$
declare table_name text;
begin
  if to_regclass('public.people') is null or to_regclass('public.users') is not null then
    return;
  end if;

  alter table public.people rename to users;
  foreach table_name in array array['profiles','identity_claims','guest_sessions','event_participants'] loop
    execute format('alter table public.%I rename column person_id to user_id',table_name);
  end loop;
  alter table public.payment_evidence rename column submitted_by to submitted_by_user_id;

  alter function dolend_private.my_person() rename to my_user;
  drop function dolend_private.assert_person(uuid,uuid,uuid,text);
  alter policy own_person on public.users rename to own_user;

  alter index profiles_person_id_idx rename to profiles_user_id_idx;
  alter index identity_claims_person_id_idx rename to identity_claims_user_id_idx;
  alter index guest_sessions_person_id_idx rename to guest_sessions_user_id_idx;
  alter index event_participants_person_id_idx rename to event_participants_user_id_idx;
  alter index participants_person_created_idx rename to participants_user_created_idx;
  alter index payment_evidence_submitted_by_idx rename to payment_evidence_submitted_by_user_id_idx;

  alter table public.users rename constraint people_pkey to users_pkey;
  alter table public.users rename constraint people_display_name_check to users_display_name_check;
  alter table public.users rename constraint people_phone_normalized_check to users_phone_normalized_check;
  alter table public.users rename constraint people_phone_normalized_key to users_phone_normalized_key;
  alter table public.users rename constraint people_state_check to users_state_check;
  alter table public.profiles rename constraint profiles_person_id_key to profiles_user_id_key;
  alter table public.profiles rename constraint profiles_person_id_fkey to profiles_user_id_fkey;
  alter table public.identity_claims rename constraint identity_claims_person_id_fkey to identity_claims_user_id_fkey;
  alter table public.guest_sessions rename constraint guest_sessions_person_id_fkey to guest_sessions_user_id_fkey;
  alter table public.event_participants rename constraint event_participants_person_id_fkey to event_participants_user_id_fkey;
  alter table public.event_participants rename constraint event_participants_event_id_person_id_key to event_participants_event_id_user_id_key;
  alter table public.payment_evidence rename constraint payment_evidence_submitted_by_fkey to payment_evidence_submitted_by_user_id_fkey;
end $$;

-- Rebuild routines because function bodies are stored as source text and column renames do not
-- rewrite references inside PL/pgSQL/SQL bodies.
drop function if exists public.join_event(uuid,uuid,uuid,text);
drop function if exists public.create_payment_attempt(uuid,uuid,text,uuid,text);
drop function if exists public.submit_manual_evidence(uuid,text,text,bigint,uuid,text);
drop function if exists public.apply_provider_payment(uuid,text,text,bigint,text);
drop function if exists public.approve_manual_payment(uuid,uuid,text,text);
drop function if exists public.expire_holds(uuid);
drop function if exists public.cancel_participation(uuid,text,uuid,text);
drop function if exists public.cancel_event(uuid,uuid,text);
drop function if exists public.request_refund(uuid,uuid,bigint,text,text);
drop function if exists public.record_refund(uuid,uuid,text,text);
drop function if exists public.claim_guest_identity(uuid,uuid);
drop function if exists dolend_private.assert_user(uuid,uuid,uuid,text);
create or replace function dolend_private.my_user() returns uuid
language sql stable security definer set search_path='' as $$
  select user_id from public.profiles where id=(select auth.uid());
$$;

create or replace function dolend_private.owns_event(p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.events where id=p_event and organizer_profile_id=(select auth.uid()));
$$;

create or replace function dolend_private.can_read_participant(p_participant uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.event_participants p join public.events e on e.id=p.event_id
    where p.id=p_participant and (p.user_id=dolend_private.my_user() or e.organizer_profile_id=(select auth.uid())));
$$;

create or replace function dolend_private.can_read_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.invoices i where i.id=p_invoice and dolend_private.can_read_participant(i.participant_id));
$$;

create or replace function dolend_private.can_read_attempt(p_attempt uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.payment_attempts a where a.id=p_attempt and dolend_private.can_read_invoice(a.invoice_id));
$$;

create or replace function dolend_private.assert_profile(p_profile uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid;
begin
 select p.id into v_user from public.profiles pr join public.users p on p.id=pr.user_id join auth.users u on u.id=pr.id
 where pr.id=p_profile and p.state='active' and p.phone_verified_at is not null
 and u.phone_confirmed_at is not null and replace(u.phone,'+','')=p.phone_normalized and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<now());
 if v_user is null then raise exception 'VERIFIED_MEMBER_REQUIRED' using errcode='42501'; end if;
 return v_user;
end; $$;

create or replace function dolend_private.assert_user(p_user uuid,p_event uuid,p_profile uuid,p_guest_hash text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_profile is not null then
  if dolend_private.assert_profile(p_profile)<>p_user then raise exception 'ACTOR_MISMATCH' using errcode='42501'; end if;
 elsif not exists(select 1 from public.guest_sessions s join public.users p on p.id=s.user_id
  where s.user_id=p_user and s.scope_event_id=p_event and s.token_hash=p_guest_hash and s.expires_at>now() and s.revoked_at is null
  and p.state='active' and p.phone_verified_at is not null) then
  raise exception 'VERIFIED_GUEST_REQUIRED' using errcode='42501';
 end if;
end; $$;

create or replace function dolend_private.assert_organizer(p_event uuid,p_profile uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform dolend_private.assert_profile(p_profile);
 if not exists(select 1 from public.events where id=p_event and organizer_profile_id=p_profile) then
  raise exception 'ORGANIZER_REQUIRED' using errcode='42501'; end if;
end; $$;

create or replace function dolend_private.audit(p_actor uuid,p_action text,p_type text,p_id uuid,p_changes jsonb default '{}'::jsonb) returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,redacted_changes)
 values(case when p_actor is null then 'system' else 'profile' end,p_actor,p_action,p_type,p_id,p_changes);
$$;

create or replace function dolend_private.occupancy(p_event uuid,p_exclude uuid default null) returns integer
language sql volatile security definer set search_path='' as $$
 select count(*)::integer from public.event_participants where event_id=p_event and (p_exclude is null or id<>p_exclude)
 and (status in ('confirmed','attended','no_show') or (status='held' and hold_expires_at>clock_timestamp()));
$$;

create or replace function dolend_private.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
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

create or replace function dolend_private.guard_participant() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into strict e from public.events where id=new.event_id for update;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.event_id<>old.event_id or new.user_id<>old.user_id or new.joined_as<>old.joined_as then raise exception 'IMMUTABLE_PARTICIPANT'; end if;
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

create or replace function dolend_private.participant_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or old.status<>new.status then
  insert into public.participant_history(participant_id,from_status,to_status,reason)
  values(new.id,case when tg_op='INSERT' then null else old.status end,new.status,new.cancellation_reason);
 end if; return new;
end; $$;

create or replace function dolend_private.guard_attempt() returns trigger language plpgsql security definer set search_path='' as $$
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

create or replace function dolend_private.guard_invoice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.participant_id<>old.participant_id or new.amount_due<>old.amount_due or new.currency<>old.currency or new.pricing_snapshot<>old.pricing_snapshot then raise exception 'IMMUTABLE_INVOICE_PRICE'; end if;
  if old.status='paid' and new.status<>'paid' then raise exception 'INVOICE_ALREADY_PAID'; end if;
 end if;
 if new.status='paid' and (select coalesce(sum(amount),0) from public.payment_ledger where invoice_id=new.id and entry_type='receipt')<new.amount_due then raise exception 'RECEIPT_REQUIRED'; end if;
 return new;
end; $$;

create or replace function dolend_private.guard_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.default_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id) then raise exception 'IMMUTABLE_PROFILE_IDENTITY'; end if;
 return new;
end; $$;

create or replace function public.join_event(p_event_id uuid,p_user_id uuid,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; target_status text; hold_until timestamptz;
begin
 select * into strict e from public.events where id=p_event_id for update;
 perform dolend_private.assert_user(p_user_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select * into p from public.event_participants where event_id=e.id and user_id=p_user_id for update;
 if p.id is not null and (p.status in ('confirmed','attended','no_show') or (p.status='held' and p.hold_expires_at>clock_timestamp())) then return p; end if;
 if e.status<>'published' or clock_timestamp()>=e.registration_closes_at or clock_timestamp()>=e.starts_at then raise exception 'REGISTRATION_CLOSED'; end if;
 if e.payment_mode<>'free' and not exists(select 1 from public.event_payment_methods where event_id=e.id and enabled) then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
 if dolend_private.occupancy(e.id,p.id)>=e.capacity then raise exception 'EVENT_FULL'; end if;
 target_status=case when e.payment_mode='before_event' then 'held' else 'confirmed' end;
 hold_until=least(e.starts_at,clock_timestamp()+make_interval(mins=>e.hold_minutes));
 if p.id is null then
  insert into public.event_participants(event_id,user_id,joined_as,status,hold_expires_at,confirmed_at)
  values(e.id,p_user_id,case when p_actor_profile_id is null then 'guest' else 'member' end,target_status,
   case when target_status='held' then hold_until end,case when target_status='confirmed' then clock_timestamp() end) returning * into p;
 else
  select * into i from public.invoices where participant_id=p.id for update;
  if i.id is not null and exists(select 1 from public.payment_ledger where invoice_id=i.id and entry_type='receipt') then raise exception 'PAID_REJOIN_REQUIRES_REVIEW'; end if;
  update public.event_participants set status=target_status,hold_expires_at=case when target_status='held' then hold_until end,
   confirmed_at=case when target_status='confirmed' then clock_timestamp() end,cancelled_at=null,cancellation_reason=null where id=p.id returning * into p;
 end if;
 if e.payment_mode<>'free' then
  insert into public.invoices(participant_id,amount_due,currency,due_at,pricing_snapshot)
  values(p.id,e.price_amount,e.currency,case when e.payment_mode='before_event' then hold_until else e.payment_due_at end,
   jsonb_build_object('amount',e.price_amount,'currency',e.currency,'mode',e.payment_mode))
  on conflict(participant_id) do update set status='open',due_at=excluded.due_at;
 end if;
 perform dolend_private.audit(p_actor_profile_id,'participant.join','participant',p.id);
 return p;
end; $$;

create or replace function public.create_payment_attempt(p_invoice_id uuid,p_method_id uuid,p_key text,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; m public.event_payment_methods; a public.payment_attempts; v_event_id uuid;
begin
 select p0.event_id into strict v_event_id from public.invoices i0 join public.event_participants p0 on p0.id=i0.participant_id where i0.id=p_invoice_id;
 select * into strict e from public.events where id=v_event_id for update;
 select p0.* into strict p from public.event_participants p0 join public.invoices i0 on i0.participant_id=p0.id where i0.id=p_invoice_id for update of p0;
 perform dolend_private.assert_user(p.user_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select * into strict i from public.invoices where id=p_invoice_id for update;
 select * into a from public.payment_attempts where invoice_id=i.id and idempotency_key=p_key;
 if a.id is not null then
  if a.payment_method_id<>p_method_id then raise exception 'IDEMPOTENCY_MISMATCH'; end if; return a;
 end if;
 if i.status<>'open' or e.status='cancelled' or p.status in ('cancelled','expired') then raise exception 'INVOICE_NOT_PAYABLE'; end if;
 if p.status='held' and p.hold_expires_at<=clock_timestamp() then raise exception 'HOLD_EXPIRED'; end if;
 select * into strict m from public.event_payment_methods where id=p_method_id and event_id=e.id and enabled;
 insert into public.payment_attempts(invoice_id,payment_method_id,method_type,provider,amount,currency,idempotency_key,status,expires_at)
 values(i.id,m.id,m.method_type,m.provider,i.amount_due,i.currency,p_key,'created',case when p.status='held' then p.hold_expires_at else greatest(i.due_at,clock_timestamp()+interval '15 minutes') end) returning * into a;
 return a;
end; $$;

create or replace function public.submit_manual_evidence(p_attempt_id uuid,p_storage_path text,p_mime text,p_size bigint,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; a public.payment_attempts; v_event_id uuid; deadline timestamptz;
begin
 select p0.event_id into strict v_event_id from public.payment_attempts a0 join public.invoices i0 on i0.id=a0.invoice_id join public.event_participants p0 on p0.id=i0.participant_id where a0.id=p_attempt_id;
 select * into strict e from public.events where id=v_event_id for update;
 select p0.* into strict p from public.event_participants p0 join public.invoices i0 on i0.participant_id=p0.id join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of p0;
 perform dolend_private.assert_user(p.user_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select i0.* into strict i from public.invoices i0 join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of i0;
 select * into strict a from public.payment_attempts where id=p_attempt_id for update;
 if a.method_type<>'manual_bank_transfer' or a.status not in ('created','pending') or i.status<>'open' or e.status='cancelled' or p.status in ('cancelled','expired') then raise exception 'INVALID_EVIDENCE_STATE'; end if;
 if p.status='held' and p.hold_expires_at<=clock_timestamp() then raise exception 'HOLD_EXPIRED'; end if;
 if p_storage_path !~ '^[a-zA-Z0-9/_\.-]+$' or p_storage_path like '%..%' then raise exception 'INVALID_STORAGE_PATH'; end if;
 -- T13 must validate uploaded object/contents server-side before committing this metadata.
 insert into public.payment_evidence(attempt_id,storage_path,mime_type,size_bytes,submitted_by_user_id) values(a.id,p_storage_path,p_mime,p_size,p.user_id);
 deadline=clock_timestamp()+make_interval(mins=>e.manual_review_minutes);
 if p.status='held' then
  deadline=least(deadline,e.starts_at);
  update public.event_participants set hold_expires_at=deadline where id=p.id;
  update public.invoices set due_at=deadline where id=i.id;
 end if;
 update public.payment_attempts set status='pending_review',review_deadline=deadline where id=a.id returning * into a;
 return a;
end; $$;

create or replace function dolend_private.receive_payment(p_attempt_id uuid,p_source text,p_amount bigint,p_currency text)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; a public.payment_attempts; v_event_id uuid; reason text; prior public.payment_ledger;
begin
 select p0.event_id into strict v_event_id from public.payment_attempts a0 join public.invoices i0 on i0.id=a0.invoice_id join public.event_participants p0 on p0.id=i0.participant_id where a0.id=p_attempt_id;
 select * into strict e from public.events where id=v_event_id for update;
 select p0.* into strict p from public.event_participants p0 join public.invoices i0 on i0.participant_id=p0.id join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of p0;
 select i0.* into strict i from public.invoices i0 join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of i0;
 select * into strict a from public.payment_attempts where id=p_attempt_id for update;
 if p_amount<>a.amount or p_currency<>a.currency then raise exception 'PAYMENT_MISMATCH'; end if;
 select * into prior from public.payment_ledger where source_reference=p_source;
 if prior.id is not null and (prior.invoice_id<>i.id or prior.attempt_id is distinct from a.id or prior.amount<>p_amount or prior.currency<>p_currency) then raise exception 'LEDGER_SOURCE_CONFLICT'; end if;
 if a.status='succeeded' then return a; end if;
 insert into public.payment_ledger(invoice_id,attempt_id,entry_type,amount,currency,source_reference)
 values(i.id,a.id,'receipt',p_amount,p_currency,p_source) on conflict(source_reference) do nothing;
 if i.status<>'open' then reason='invoice_'||i.status;
 elsif e.status='cancelled' or p.status='cancelled' then reason='cancelled';
 else
  update public.invoices set status='paid' where id=i.id;
  if i.pricing_snapshot->>'mode'='before_event' and p.status in ('held','expired') then
   if e.status<>'published' or clock_timestamp()>=e.starts_at then reason='event_closed';
   elsif dolend_private.occupancy(e.id,p.id)>=e.capacity then reason='late_payment_no_seat';
   else update public.event_participants set status='confirmed',confirmed_at=clock_timestamp() where id=p.id;
   end if;
  end if;
 end if;
 update public.payment_attempts set status='succeeded',exception_reason=reason where id=a.id returning * into a;
 if reason is not null then
  insert into public.outbox_jobs(kind,aggregate_id,dedupe_key,payload) values('payment_exception',a.id,'payment-exception:'||a.id::text,jsonb_build_object('reason',reason)) on conflict(dedupe_key) do nothing;
 end if;
 perform dolend_private.audit(null,'payment.received','payment_attempt',a.id,jsonb_build_object('exception',reason));
 return a;
end; $$;

create or replace function public.apply_provider_payment(p_attempt_id uuid,p_provider text,p_provider_reference text,p_amount bigint,p_currency text)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
begin
 if p_provider is null or p_provider_reference is null or not exists(select 1 from public.payment_attempts where id=p_attempt_id and method_type in ('qris','gateway') and provider=p_provider and provider_reference=p_provider_reference) then raise exception 'PROVIDER_REFERENCE_MISMATCH'; end if;
 -- Signature verification and provider status lookup belong in T16, before invoking this service-only RPC.
 return dolend_private.receive_payment(p_attempt_id,'provider:'||p_provider||':'||p_provider_reference,p_amount,p_currency);
end; $$;

create or replace function public.approve_manual_payment(p_attempt_id uuid,p_actor_profile_id uuid,p_decision text,p_reason text)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts; e public.events; v_event_id uuid;
begin
 select p.event_id into strict v_event_id from public.payment_attempts a0 join public.invoices i on i.id=a0.invoice_id join public.event_participants p on p.id=i.participant_id where a0.id=p_attempt_id;
 select * into strict e from public.events where id=v_event_id for update;
 perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 select * into strict a from public.payment_attempts where id=p_attempt_id;
 if p_decision not in ('approve','reject') or length(trim(coalesce(p_reason,'')))=0 then raise exception 'REVIEW_REASON_REQUIRED'; end if;
 if a.method_type<>'manual_bank_transfer' then raise exception 'MANUAL_PAYMENT_REQUIRED'; end if;
 if a.status='succeeded' and p_decision='approve' then return a; end if;
 if a.status not in ('pending_review','expired') or not exists(select 1 from public.payment_evidence where attempt_id=a.id) then raise exception 'EVIDENCE_REQUIRED'; end if;
 if p_decision='approve' then a=dolend_private.receive_payment(a.id,'manual:'||a.id::text,a.amount,a.currency);
 else update public.payment_attempts set status='rejected' where id=a.id;
 end if;
 update public.payment_attempts set reviewed_by=p_actor_profile_id,review_reason=p_reason where id=a.id returning * into a;
 update public.payment_evidence set reviewed_at=clock_timestamp() where attempt_id=a.id;
 perform dolend_private.audit(p_actor_profile_id,'payment.review','payment_attempt',a.id,jsonb_build_object('decision',p_decision));
 return a;
end; $$;

create or replace function public.expire_holds(p_event_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 perform 1 from public.events where id=p_event_id for update;
 update public.event_participants set status='expired' where event_id=p_event_id and status='held' and hold_expires_at<=clock_timestamp();
 get diagnostics affected=row_count;
 update public.payment_attempts a set status='expired' from public.invoices i,public.event_participants p
 where a.invoice_id=i.id and i.participant_id=p.id and p.event_id=p_event_id and (
  (a.status in ('created','pending') and a.expires_at<=clock_timestamp()) or (a.status='pending_review' and a.review_deadline<=clock_timestamp()));
 return affected;
end; $$;

create or replace function public.cancel_participation(p_participant_id uuid,p_reason text,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; v_event_id uuid;
begin
 select event_participants.event_id into strict v_event_id from public.event_participants where id=p_participant_id;
 select * into strict e from public.events where id=v_event_id for update;
 select * into strict p from public.event_participants where id=p_participant_id for update;
 if p_actor_profile_id is not null and p_actor_profile_id=e.organizer_profile_id then perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 else perform dolend_private.assert_user(p.user_id,e.id,p_actor_profile_id,p_guest_session_hash); end if;
 if p.status='cancelled' then return p; end if;
 if p.status in ('attended','no_show') then raise exception 'ATTENDANCE_RECORDED'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 update public.event_participants set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=p_reason where id=p.id returning * into p;
 update public.invoices set status='void' where participant_id=p.id and status='open';
 insert into public.outbox_jobs(kind,aggregate_id,dedupe_key) select 'refund_review',i.id,'refund-review:'||i.id::text from public.invoices i where i.participant_id=p.id and exists(select 1 from public.payment_ledger l where l.invoice_id=i.id and l.entry_type='receipt') on conflict(dedupe_key) do nothing;
 perform dolend_private.audit(p_actor_profile_id,'participant.cancel','participant',p.id);
 return p;
end; $$;

create or replace function public.cancel_event(p_event_id uuid,p_actor_profile_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events; participant record;
begin
 select * into strict e from public.events where id=p_event_id for update;
 perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 if e.status='cancelled' then return; end if;
 if e.status='completed' then raise exception 'EVENT_ALREADY_COMPLETED'; end if;
 for participant in select id from public.event_participants where event_id=e.id and status in ('held','confirmed','expired') order by id loop
  perform public.cancel_participation(participant.id,p_reason,p_actor_profile_id);
 end loop;
 update public.events set status='cancelled' where id=e.id;
 update public.invoices i set status='void' from public.event_participants p where p.id=i.participant_id and p.event_id=e.id and i.status='open';
 perform dolend_private.audit(p_actor_profile_id,'event.cancel','event',e.id);
end; $$;

create or replace function public.request_refund(p_attempt_id uuid,p_actor_profile_id uuid,p_amount bigint,p_reason text,p_key text)
returns public.refunds language plpgsql security definer set search_path='' as $$
declare e public.events; a public.payment_attempts; i public.invoices; r public.refunds; v_event_id uuid; reserved bigint;
begin
 select p.event_id into strict v_event_id from public.payment_attempts a0 join public.invoices i0 on i0.id=a0.invoice_id join public.event_participants p on p.id=i0.participant_id where a0.id=p_attempt_id;
 select * into strict e from public.events where id=v_event_id for update;
 perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 select i0.* into strict i from public.invoices i0 join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of i0;
 select * into strict a from public.payment_attempts where id=p_attempt_id for update;
 select * into r from public.refunds where invoice_id=i.id and idempotency_key=p_key;
 if r.id is not null then
  if r.attempt_id<>a.id or r.amount<>p_amount or r.reason<>p_reason then raise exception 'IDEMPOTENCY_MISMATCH'; end if; return r;
 end if;
 select coalesce(sum(amount),0) into reserved from public.refunds where attempt_id=a.id and status in ('requested','processing','succeeded');
 if a.status<>'succeeded' or p_amount<=0 or p_amount+reserved>a.amount or length(trim(coalesce(p_reason,'')))=0 then raise exception 'INVALID_REFUND_AMOUNT'; end if;
 insert into public.refunds(invoice_id,attempt_id,amount,reason,approved_by,idempotency_key) values(i.id,a.id,p_amount,p_reason,p_actor_profile_id,p_key) returning * into r;
 return r;
end; $$;

create or replace function public.record_refund(p_refund_id uuid,p_actor_profile_id uuid,p_reference text,p_evidence_path text default null)
returns public.refunds language plpgsql security definer set search_path='' as $$
declare e public.events; i public.invoices; a public.payment_attempts; r public.refunds; v_event_id uuid; refunded bigint;
begin
 select p.event_id into strict v_event_id from public.refunds r0 join public.invoices i0 on i0.id=r0.invoice_id join public.event_participants p on p.id=i0.participant_id where r0.id=p_refund_id;
 select * into strict e from public.events where id=v_event_id for update;
 perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 select i0.* into strict i from public.invoices i0 join public.refunds r0 on r0.invoice_id=i0.id where r0.id=p_refund_id for update of i0;
 select a0.* into strict a from public.payment_attempts a0 join public.refunds r0 on r0.attempt_id=a0.id where r0.id=p_refund_id for update of a0;
 select * into strict r from public.refunds where id=p_refund_id for update;
 if r.status='succeeded' then
  if r.provider_reference is distinct from p_reference then raise exception 'REFUND_REFERENCE_MISMATCH'; end if; return r;
 end if;
 select coalesce(sum(amount),0) into refunded from public.payment_ledger where attempt_id=a.id and entry_type='refund';
 if refunded+r.amount>a.amount or a.status<>'succeeded' or length(trim(coalesce(p_reference,'')))=0 then raise exception 'INVALID_REFUND_AMOUNT'; end if;
 if a.method_type='manual_bank_transfer' and length(trim(coalesce(p_evidence_path,'')))=0 then raise exception 'REFUND_EVIDENCE_REQUIRED'; end if;
 insert into public.payment_ledger(invoice_id,attempt_id,entry_type,amount,currency,source_reference) values(i.id,a.id,'refund',r.amount,a.currency,'refund:'||r.id::text);
 update public.refunds set status='succeeded',provider_reference=p_reference,evidence_path=p_evidence_path where id=r.id returning * into r;
 perform dolend_private.audit(p_actor_profile_id,'refund.recorded','refund',r.id);
 return r;
end; $$;

create or replace function public.claim_guest_identity(p_auth_user_id uuid,p_challenge_id uuid) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare c public.verification_challenges; domain_user public.users; profile public.profiles;
begin
 -- Serialize concurrent claims by account and phone before consuming proof.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_auth_user_id::text,0));
 select * into strict c from public.verification_challenges where id=p_challenge_id for update;
 if c.auth_user_id is distinct from p_auth_user_id or c.purpose<>'claim' or c.verified_at is null or c.expires_at<=clock_timestamp() or c.consumed_at is not null then raise exception 'INVALID_IDENTITY_PROOF' using errcode='42501'; end if;
 select * into strict domain_user from public.users where phone_normalized=c.phone_normalized for update;
 if domain_user.state<>'active' or not exists(select 1 from auth.users where id=p_auth_user_id and phone_confirmed_at is not null and replace(phone,'+','')=domain_user.phone_normalized and deleted_at is null and (banned_until is null or banned_until<now())) then raise exception 'INVALID_AUTH_IDENTITY' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where user_id=domain_user.id and id<>p_auth_user_id) or exists(select 1 from public.profiles where id=p_auth_user_id and user_id<>domain_user.id) then raise exception 'IDENTITY_COLLISION' using errcode='42501'; end if;
 update public.users set phone_verified_at=coalesce(phone_verified_at,c.verified_at) where id=domain_user.id;
 insert into public.profiles(id,user_id) values(p_auth_user_id,domain_user.id) on conflict(id) do nothing;
 select * into strict profile from public.profiles where id=p_auth_user_id;
 update public.verification_challenges set consumed_at=clock_timestamp() where id=c.id;
 insert into public.identity_claims(user_id,auth_user_id,challenge_id,status,expires_at,resolved_at) values(domain_user.id,p_auth_user_id,c.id,'resolved',c.expires_at,clock_timestamp());
 perform dolend_private.audit(p_auth_user_id,'identity.claim','user',domain_user.id);
 return profile;
end; $$;

revoke all on all functions in schema dolend_private from public, anon, authenticated;
grant execute on function dolend_private.my_user(),dolend_private.owns_event(uuid),dolend_private.can_read_participant(uuid),dolend_private.can_read_invoice(uuid),dolend_private.can_read_attempt(uuid) to authenticated;
revoke all on all functions in schema dolend_private from public, anon;
revoke execute on function dolend_private.assert_profile(uuid),dolend_private.assert_user(uuid,uuid,uuid,text),dolend_private.assert_organizer(uuid,uuid),dolend_private.audit(uuid,text,text,uuid,jsonb),dolend_private.occupancy(uuid,uuid),dolend_private.guard_event(),dolend_private.guard_participant(),dolend_private.participant_history(),dolend_private.guard_attempt(),dolend_private.guard_invoice(),dolend_private.guard_profile() from authenticated,service_role;
revoke all on function public.join_event(uuid,uuid,uuid,text),public.create_payment_attempt(uuid,uuid,text,uuid,text),public.submit_manual_evidence(uuid,text,text,bigint,uuid,text),public.apply_provider_payment(uuid,text,text,bigint,text),public.approve_manual_payment(uuid,uuid,text,text),public.expire_holds(uuid),public.cancel_participation(uuid,text,uuid,text),public.cancel_event(uuid,uuid,text),public.request_refund(uuid,uuid,bigint,text,text),public.record_refund(uuid,uuid,text,text),public.claim_guest_identity(uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_event(uuid,uuid,uuid,text),public.create_payment_attempt(uuid,uuid,text,uuid,text),public.submit_manual_evidence(uuid,text,text,bigint,uuid,text),public.apply_provider_payment(uuid,text,text,bigint,text),public.approve_manual_payment(uuid,uuid,text,text),public.expire_holds(uuid),public.cancel_participation(uuid,text,uuid,text),public.cancel_event(uuid,uuid,text),public.request_refund(uuid,uuid,bigint,text,text),public.record_refund(uuid,uuid,text,text),public.claim_guest_identity(uuid,uuid) to service_role;
