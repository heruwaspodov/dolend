-- Dynamic contribution events coexist with immutable legacy invoices.
alter table public.events add column contribution_mode text not null default 'legacy' check(contribution_mode in ('legacy','dynamic')),
 add column venue_booking_status text not null default 'not_booked' check(venue_booking_status in ('not_booked','pending','booked','cancelled')),
 add column estimated_total_cost bigint not null default 0 check(estimated_total_cost between 0 and 1000000000000),
 add column contributions_locked_at timestamptz,
 add column contributions_locked_by uuid references public.profiles(id);
create index events_contributions_locked_by_idx on public.events(contributions_locked_by);
alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check check(status in ('draft','published','recruiting','confirmed','completed','cancelled'));
alter table public.events add constraint dynamic_legacy_free check(contribution_mode<>'dynamic' or payment_mode='free');
alter table public.event_participants add column chargeable boolean not null default true;
create or replace function dolend_private.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform dolend_private.assert_profile(new.organizer_profile_id);
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'INVALID_TIMEZONE'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.organizer_profile_id<>old.organizer_profile_id then raise exception 'IMMUTABLE_EVENT_OWNER'; end if;
  if new.capacity<dolend_private.occupancy(new.id) then raise exception 'CAPACITY_BELOW_OCCUPANCY'; end if;
  if new.payment_mode<>old.payment_mode and exists(select 1 from public.event_participants where event_id=new.id) then raise exception 'PAYMENT_MODE_LOCKED'; end if;
  if new.contribution_mode<>old.contribution_mode then raise exception 'IMMUTABLE_CONTRIBUTION_MODE'; end if;
  if old.contributions_locked_at is not null and (new.contributions_locked_at is distinct from old.contributions_locked_at or new.contributions_locked_by is distinct from old.contributions_locked_by) then raise exception 'IMMUTABLE_LOCK'; end if;
  if new.status<>old.status and not ((new.contribution_mode='dynamic' and ((old.status='draft' and new.status in ('recruiting','cancelled')) or (old.status='recruiting' and new.status in ('confirmed','cancelled')) or (old.status='confirmed' and new.status in ('completed','cancelled')))) or (old.status='draft' and new.status in ('published','cancelled')) or (old.status='published' and new.status in ('completed','cancelled'))) then raise exception 'INVALID_EVENT_TRANSITION'; end if;
  if new.status='completed' and old.status<>'completed' and clock_timestamp()<new.ends_at then raise exception 'EVENT_NOT_ENDED'; end if;
  new.version=old.version+1;
 end if;
 if new.contribution_mode='dynamic' and new.status in ('recruiting','confirmed') and new.starts_at<=clock_timestamp() then raise exception 'EVENT_NOT_OPEN'; end if;
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
   if e.status not in ('published','recruiting','confirmed') then raise exception 'EVENT_NOT_OPEN'; end if;
   if dolend_private.occupancy(new.event_id,new.id)>=e.capacity then raise exception 'EVENT_FULL'; end if;
   if e.payment_mode='before_event' and new.status='confirmed' and not exists(select 1 from public.invoices where participant_id=new.id and status='paid') then raise exception 'PAYMENT_REQUIRED'; end if;
 end if;
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
 if e.status not in ('published','recruiting','confirmed') or clock_timestamp()>=e.registration_closes_at or clock_timestamp()>=e.starts_at then raise exception 'REGISTRATION_CLOSED'; end if;
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
create or replace function public.create_guest_booking(
  p_event uuid,
  p_display_name text,
  p_phone_normalized text,
  p_token_hash text
) returns public.event_participants
language plpgsql security definer set search_path='' as $$
declare
  event_row public.events;
  domain_user public.users;
  participant public.event_participants;
begin
  if length(trim(p_display_name)) not between 1 and 120 then raise exception 'INVALID_GUEST_NAME'; end if;
  if p_phone_normalized !~ '^62[1-9][0-9]{6,12}$' then raise exception 'INVALID_GUEST_PHONE'; end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_GUEST_TOKEN'; end if;

  select * into strict event_row from public.events where id=p_event for update;
  if event_row.status not in ('published','recruiting','confirmed') or event_row.registration_closes_at<=clock_timestamp() then
    raise exception 'EVENT_NOT_OPEN';
  end if;

  insert into public.users(display_name,phone_normalized)
  values(trim(p_display_name),p_phone_normalized)
  on conflict(phone_normalized) do nothing;

  select * into strict domain_user from public.users
  where phone_normalized=p_phone_normalized for update;
  if domain_user.state<>'active' then raise exception 'GUEST_NOT_ACTIVE' using errcode='42501'; end if;
  if exists(select 1 from public.event_participants where event_id=p_event and user_id=domain_user.id) then
    raise exception 'BOOKING_ALREADY_EXISTS' using errcode='23505';
  end if;

  insert into public.guest_sessions(user_id,scope_event_id,token_hash,expires_at)
  values(domain_user.id,p_event,p_token_hash,greatest(event_row.ends_at+interval '30 days',clock_timestamp()+interval '24 hours'));
  participant=public.join_event(p_event,domain_user.id,null,p_token_hash);
  perform dolend_private.audit(null,'guest.booking_create','event_participant',participant.id);
  return participant;
end;
$$;

create table public.organizer_payment_methods (
 id uuid primary key default gen_random_uuid(), organizer_id uuid not null references public.profiles(id),
 type text not null check(type in ('static_qris','bank_transfer','cash')),
 recipient_name text not null check(length(trim(recipient_name)) between 1 and 120),
 storage_path text, bank_details jsonb, is_active boolean not null default true,
 created_at timestamptz not null default now(),
 check(type<>'static_qris' or storage_path is not null)
);
create index organizer_payment_methods_owner_idx on public.organizer_payment_methods(organizer_id);
create table public.manual_event_methods (
 event_id uuid not null references public.events(id), method_id uuid not null references public.organizer_payment_methods(id),
 enabled boolean not null default true, primary key(event_id,method_id)
);
create index manual_event_methods_method_idx on public.manual_event_methods(method_id);
-- Legacy invoices are immutable snapshots tied to all-or-nothing attempts. New charges
-- reference the same participation but support zero, partial receipts and independent adjustments.
create table public.participant_charges (
 id uuid primary key default gen_random_uuid(), participant_id uuid not null unique references public.event_participants(id),
 amount bigint not null check(amount between 0 and 1000000000000), currency text not null default 'IDR' check(currency='IDR'),
 locked_at timestamptz not null default now(), locked_by uuid not null references public.profiles(id)
);
create index participant_charges_actor_idx on public.participant_charges(locked_by);
create table public.manual_payment_records (
 id uuid primary key default gen_random_uuid(), charge_id uuid not null references public.participant_charges(id),
 method_id uuid not null references public.organizer_payment_methods(id), amount bigint not null check(amount between 1 and 1000000000000),
 status text not null default 'pending_verification' check(status in ('pending_verification','verified','rejected')),
 idempotency_key text not null check(length(idempotency_key) between 1 and 200),
 proof_storage_path text, recorded_by uuid references public.profiles(id),
 verified_by uuid references public.profiles(id), verified_at timestamptz, reason text,
 paid_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(charge_id,idempotency_key), check((status='pending_verification' and verified_at is null and verified_by is null) or (status<>'pending_verification' and verified_at is not null and verified_by is not null))
);
create index manual_payment_records_charge_idx on public.manual_payment_records(charge_id);
create index manual_payment_records_method_idx on public.manual_payment_records(method_id);
create index manual_payment_records_recorder_idx on public.manual_payment_records(recorded_by);
create index manual_payment_records_verifier_idx on public.manual_payment_records(verified_by);
create table public.contribution_ledger (
 id uuid primary key default gen_random_uuid(), charge_id uuid not null references public.participant_charges(id),
 payment_id uuid unique references public.manual_payment_records(id),
 entry_type text not null check(entry_type in ('receipt','refund','adjustment')),
 amount bigint not null check(amount<>0 and amount between -1000000000000 and 1000000000000),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 actor_id uuid not null references public.profiles(id), idempotency_key text not null,
 created_at timestamptz not null default now(), unique(charge_id,idempotency_key),
 check((entry_type='receipt' and amount>0 and payment_id is not null) or (entry_type='refund' and amount>0 and payment_id is null) or (entry_type='adjustment' and payment_id is null))
);
create index contribution_ledger_charge_idx on public.contribution_ledger(charge_id);
create index contribution_ledger_actor_idx on public.contribution_ledger(actor_id);

create function public.lock_contributions(p_event uuid,p_actor uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare e public.events; n bigint; amount bigint;
begin
 select * into strict e from public.events where id=p_event for update;
 perform dolend_private.assert_organizer(p_event,p_actor);
 if e.contribution_mode<>'dynamic' or e.status not in ('recruiting','confirmed') then raise exception 'INVALID_EVENT_STATE'; end if;
 if e.contributions_locked_at is not null then return (select c.amount from public.participant_charges c join public.event_participants p on p.id=c.participant_id where p.event_id=p_event order by c.locked_at limit 1); end if;
 select count(*) into n from public.event_participants where event_id=p_event and chargeable and status='confirmed';
 if n=0 then raise exception 'NO_CHARGEABLE_PARTICIPANTS'; end if;
 amount=(e.estimated_total_cost+n-1)/n;
 insert into public.participant_charges(participant_id,amount,locked_by)
 select id,amount,p_actor from public.event_participants where event_id=p_event and chargeable and status='confirmed';
 update public.events set contributions_locked_at=clock_timestamp(),contributions_locked_by=p_actor where id=p_event;
 perform dolend_private.audit(p_actor,'contribution.lock','event',p_event);
 return amount;
end; $$;

create function public.assign_contribution(p_participant uuid,p_actor uuid,p_amount bigint) returns public.participant_charges
language plpgsql security definer set search_path='' as $$
declare e public.events; c public.participant_charges;
begin
 select e0.* into strict e from public.events e0 join public.event_participants p on p.event_id=e0.id where p.id=p_participant for update of e0;
 perform dolend_private.assert_organizer(e.id,p_actor);
 if e.contribution_mode<>'dynamic' or e.contributions_locked_at is null or e.status not in ('recruiting','confirmed') then raise exception 'INVALID_EVENT_STATE'; end if;
 if not exists(select 1 from public.event_participants where id=p_participant and status='confirmed' and chargeable) then raise exception 'INVALID_PARTICIPANT'; end if;
 select * into c from public.participant_charges where participant_id=p_participant;
 if c.id is not null then
  if c.amount<>p_amount then raise exception 'IMMUTABLE_CHARGE'; end if;
  return c;
 end if;
 insert into public.participant_charges(participant_id,amount,locked_by) values(p_participant,p_amount,p_actor) returning * into c;
 perform dolend_private.audit(p_actor,'contribution.assign','participant',p_participant);
 return c;
end; $$;

create function public.report_manual_payment(p_charge uuid,p_method uuid,p_amount bigint,p_key text,p_actor uuid default null,p_guest_hash text default null,p_proof text default null)
returns public.manual_payment_records language plpgsql security definer set search_path='' as $$
declare p public.event_participants; e public.events; m public.organizer_payment_methods; r public.manual_payment_records;
begin
 select e0.* into strict e from public.events e0 join public.event_participants p0 on p0.event_id=e0.id join public.participant_charges c on c.participant_id=p0.id where c.id=p_charge for update of e0;
 select p0.* into strict p from public.event_participants p0 join public.participant_charges c on c.participant_id=p0.id where c.id=p_charge;
 if p_actor is null or not dolend_private.can_organize_event(e.id,p_actor) then
  perform dolend_private.assert_user(p.user_id,e.id,p_actor,p_guest_hash);
 else perform dolend_private.assert_organizer(e.id,p_actor); end if;
 if e.status='cancelled' then raise exception 'EVENT_CANCELLED'; end if;
 select * into strict m from public.organizer_payment_methods where id=p_method and is_active;
 if not exists(select 1 from public.manual_event_methods where event_id=e.id and method_id=m.id and enabled) then raise exception 'METHOD_DISABLED'; end if;
 if m.type='cash' then perform dolend_private.assert_organizer(e.id,p_actor); end if;
 if p_proof is not null and p_proof not like ('proof/'||p_charge::text||'/%') then raise exception 'INVALID_PROOF_PATH'; end if;
 select * into r from public.manual_payment_records where charge_id=p_charge and idempotency_key=p_key;
 if r.id is not null then
  if r.amount<>p_amount or r.method_id<>p_method or r.proof_storage_path is distinct from p_proof then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
  return r;
 end if;
 insert into public.manual_payment_records(charge_id,method_id,amount,idempotency_key,proof_storage_path,recorded_by)
 values(p_charge,p_method,p_amount,p_key,p_proof,p_actor) returning * into r;
 return r;
end; $$;

create function public.review_manual_payment(p_payment uuid,p_actor uuid,p_decision text,p_reason text) returns public.manual_payment_records
language plpgsql security definer set search_path='' as $$
declare e public.events; r public.manual_payment_records;
begin
 select e0.* into strict e from public.events e0 join public.event_participants p on p.event_id=e0.id join public.participant_charges c on c.participant_id=p.id join public.manual_payment_records r0 on r0.charge_id=c.id where r0.id=p_payment for update of e0;
 perform dolend_private.assert_organizer(e.id,p_actor);
 if p_decision not in ('verified','rejected') or length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'INVALID_REVIEW'; end if;
 select * into strict r from public.manual_payment_records where id=p_payment for update;
 if r.status=p_decision then return r; end if;
 if r.status<>'pending_verification' then raise exception 'PAYMENT_ALREADY_REVIEWED'; end if;
 if p_decision='verified' then
  insert into public.contribution_ledger(charge_id,payment_id,entry_type,amount,reason,actor_id,idempotency_key)
  values(r.charge_id,r.id,'receipt',r.amount,p_reason,p_actor,'payment:'||r.id::text);
 end if;
 update public.manual_payment_records set status=p_decision,verified_by=p_actor,verified_at=clock_timestamp(),reason=p_reason where id=r.id returning * into r;
 perform dolend_private.audit(p_actor,'payment.'||p_decision,'manual_payment',r.id);
 return r;
end; $$;

create function public.adjust_contribution(p_charge uuid,p_actor uuid,p_type text,p_amount bigint,p_reason text,p_key text) returns public.contribution_ledger
language plpgsql security definer set search_path='' as $$
declare e public.events; l public.contribution_ledger; received bigint; refunded bigint;
begin
 select e0.* into strict e from public.events e0 join public.event_participants p on p.event_id=e0.id join public.participant_charges c on c.participant_id=p.id where c.id=p_charge for update of e0;
 perform dolend_private.assert_organizer(e.id,p_actor);
 if p_type not in ('refund','adjustment') then raise exception 'INVALID_ADJUSTMENT'; end if;
 select * into l from public.contribution_ledger where charge_id=p_charge and idempotency_key=p_key;
 if l.id is not null then
  if l.entry_type<>p_type or l.amount<>p_amount or l.reason<>p_reason then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
  return l;
 end if;
 select coalesce(sum(amount) filter(where entry_type='receipt'),0),coalesce(sum(amount) filter(where entry_type='refund'),0) into received,refunded from public.contribution_ledger where charge_id=p_charge;
 if p_type='refund' and (p_amount<=0 or refunded+p_amount>received) then raise exception 'REFUND_EXCEEDS_RECEIPTS'; end if;
 insert into public.contribution_ledger(charge_id,entry_type,amount,reason,actor_id,idempotency_key) values(p_charge,p_type,p_amount,p_reason,p_actor,p_key) returning * into l;
 perform dolend_private.audit(p_actor,'contribution.'||p_type,'charge',p_charge);
 return l;
end; $$;

-- All writes go through the API's validated identity and service-only RPCs.
alter table public.organizer_payment_methods enable row level security;
revoke all on public.organizer_payment_methods from anon,authenticated;
grant select,insert on public.organizer_payment_methods to service_role;
alter table public.manual_event_methods enable row level security;
revoke all on public.manual_event_methods from anon,authenticated;
grant select,insert on public.manual_event_methods to service_role;
alter table public.participant_charges enable row level security;
revoke all on public.participant_charges from anon,authenticated;
grant select,insert on public.participant_charges to service_role;
alter table public.manual_payment_records enable row level security;
revoke all on public.manual_payment_records from anon,authenticated;
grant select,insert on public.manual_payment_records to service_role;
alter table public.contribution_ledger enable row level security;
revoke all on public.contribution_ledger from anon,authenticated;
grant select,insert on public.contribution_ledger to service_role;
grant update on public.organizer_payment_methods,public.manual_event_methods to service_role;
revoke all on function public.lock_contributions(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lock_contributions(uuid,uuid) to service_role;
revoke all on function public.assign_contribution(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.assign_contribution(uuid,uuid,bigint) to service_role;
revoke all on function public.report_manual_payment(uuid,uuid,bigint,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.report_manual_payment(uuid,uuid,bigint,text,uuid,text,text) to service_role;
revoke all on function public.review_manual_payment(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_manual_payment(uuid,uuid,text,text) to service_role;
revoke all on function public.adjust_contribution(uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.adjust_contribution(uuid,uuid,text,bigint,text,text) to service_role;

create function public.manual_event_access(p_event uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform dolend_private.assert_organizer(p_event,p_actor); end; $$;
revoke all on function public.manual_event_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.manual_event_access(uuid,uuid) to service_role;

-- Bucket is absent from the lightweight local SQL harness; hosted Supabase owns storage.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('dolend-payments','dolend-payments',false,2097152,array['image/png','image/jpeg'])
  on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg'];
 end if;
end; $$;

alter table public.events add column payment_timing text not null default 'before_event' check(payment_timing in ('before_event','after_event'));

create function public.cancel_dynamic_participant(p_participant uuid,p_actor uuid,p_guest_hash text,p_policy text,p_reason text,p_key text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; c public.participant_charges; total bigint;
begin
 select e0.* into strict e from public.events e0 join public.event_participants p0 on p0.event_id=e0.id where p0.id=p_participant for update of e0;
 select * into strict p from public.event_participants where id=p_participant;
 if e.contribution_mode<>'dynamic' then raise exception 'INVALID_EVENT_STATE'; end if;
 if e.contributions_locked_at is not null or (p_actor is not null and dolend_private.can_organize_event(e.id,p_actor)) then
  perform dolend_private.assert_organizer(e.id,p_actor);
 else perform dolend_private.assert_user(p.user_id,e.id,p_actor,p_guest_hash); end if;
 if p.status='cancelled' then return; end if;
 if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'REASON_REQUIRED'; end if;
 if e.contributions_locked_at is not null then
  if p_policy not in ('retain','waive') then raise exception 'EXPLICIT_CANCEL_POLICY_REQUIRED'; end if;
  select * into c from public.participant_charges where participant_id=p.id;
  if p_policy='waive' and c.id is not null then
   select c.amount+coalesce(sum(amount) filter(where entry_type='adjustment'),0) into total from public.contribution_ledger where charge_id=c.id;
   if total<>0 then perform public.adjust_contribution(c.id,p_actor,'adjustment',-total,p_reason,p_key); end if;
  end if;
 end if;
 update public.event_participants set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=p_reason where id=p.id;
 perform dolend_private.audit(p_actor,'participant.cancel','participant',p.id);
end; $$;
revoke all on function public.cancel_dynamic_participant(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cancel_dynamic_participant(uuid,uuid,text,text,text,text) to service_role;
