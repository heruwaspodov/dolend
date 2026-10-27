-- Lock order: event -> participant -> invoice -> attempt/refund.
-- RPCs are callable only by trusted service_role. Resolve JWT/guest proof in API first;
-- DB repeats ownership/proof checks instead of trusting a person/profile supplied by a browser.
create function public.join_event(p_event_id uuid,p_person_id uuid,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; target_status text; hold_until timestamptz;
begin
 select * into strict e from public.events where id=p_event_id for update;
 perform dolend_private.assert_person(p_person_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select * into p from public.event_participants where event_id=e.id and person_id=p_person_id for update;
 if p.id is not null and (p.status in ('confirmed','attended','no_show') or (p.status='held' and p.hold_expires_at>clock_timestamp())) then return p; end if;
 if e.status<>'published' or clock_timestamp()>=e.registration_closes_at or clock_timestamp()>=e.starts_at then raise exception 'REGISTRATION_CLOSED'; end if;
 if e.payment_mode<>'free' and not exists(select 1 from public.event_payment_methods where event_id=e.id and enabled) then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
 if dolend_private.occupancy(e.id,p.id)>=e.capacity then raise exception 'EVENT_FULL'; end if;
 target_status=case when e.payment_mode='before_event' then 'held' else 'confirmed' end;
 hold_until=least(e.starts_at,clock_timestamp()+make_interval(mins=>e.hold_minutes));
 if p.id is null then
  insert into public.event_participants(event_id,person_id,joined_as,status,hold_expires_at,confirmed_at)
  values(e.id,p_person_id,case when p_actor_profile_id is null then 'guest' else 'member' end,target_status,
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

create function public.create_payment_attempt(p_invoice_id uuid,p_method_id uuid,p_key text,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; m public.event_payment_methods; a public.payment_attempts; v_event_id uuid;
begin
 select p0.event_id into strict v_event_id from public.invoices i0 join public.event_participants p0 on p0.id=i0.participant_id where i0.id=p_invoice_id;
 select * into strict e from public.events where id=v_event_id for update;
 select p0.* into strict p from public.event_participants p0 join public.invoices i0 on i0.participant_id=p0.id where i0.id=p_invoice_id for update of p0;
 perform dolend_private.assert_person(p.person_id,e.id,p_actor_profile_id,p_guest_session_hash);
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

create function public.submit_manual_evidence(p_attempt_id uuid,p_storage_path text,p_mime text,p_size bigint,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; a public.payment_attempts; v_event_id uuid; deadline timestamptz;
begin
 select p0.event_id into strict v_event_id from public.payment_attempts a0 join public.invoices i0 on i0.id=a0.invoice_id join public.event_participants p0 on p0.id=i0.participant_id where a0.id=p_attempt_id;
 select * into strict e from public.events where id=v_event_id for update;
 select p0.* into strict p from public.event_participants p0 join public.invoices i0 on i0.participant_id=p0.id join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of p0;
 perform dolend_private.assert_person(p.person_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select i0.* into strict i from public.invoices i0 join public.payment_attempts a0 on a0.invoice_id=i0.id where a0.id=p_attempt_id for update of i0;
 select * into strict a from public.payment_attempts where id=p_attempt_id for update;
 if a.method_type<>'manual_bank_transfer' or a.status not in ('created','pending') or i.status<>'open' or e.status='cancelled' or p.status in ('cancelled','expired') then raise exception 'INVALID_EVIDENCE_STATE'; end if;
 if p.status='held' and p.hold_expires_at<=clock_timestamp() then raise exception 'HOLD_EXPIRED'; end if;
 if p_storage_path !~ '^[a-zA-Z0-9/_\.-]+$' or p_storage_path like '%..%' then raise exception 'INVALID_STORAGE_PATH'; end if;
 -- T13 must validate uploaded object/contents server-side before committing this metadata.
 insert into public.payment_evidence(attempt_id,storage_path,mime_type,size_bytes,submitted_by) values(a.id,p_storage_path,p_mime,p_size,p.person_id);
 deadline=clock_timestamp()+make_interval(mins=>e.manual_review_minutes);
 if p.status='held' then
  deadline=least(deadline,e.starts_at);
  update public.event_participants set hold_expires_at=deadline where id=p.id;
  update public.invoices set due_at=deadline where id=i.id;
 end if;
 update public.payment_attempts set status='pending_review',review_deadline=deadline where id=a.id returning * into a;
 return a;
end; $$;

create function dolend_private.receive_payment(p_attempt_id uuid,p_source text,p_amount bigint,p_currency text)
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
revoke all on function dolend_private.receive_payment(uuid,text,bigint,text) from public,anon,authenticated,service_role;

create function public.apply_provider_payment(p_attempt_id uuid,p_provider text,p_provider_reference text,p_amount bigint,p_currency text)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
begin
 if p_provider is null or p_provider_reference is null or not exists(select 1 from public.payment_attempts where id=p_attempt_id and method_type in ('qris','gateway') and provider=p_provider and provider_reference=p_provider_reference) then raise exception 'PROVIDER_REFERENCE_MISMATCH'; end if;
 -- Signature verification and provider status lookup belong in T16, before invoking this service-only RPC.
 return dolend_private.receive_payment(p_attempt_id,'provider:'||p_provider||':'||p_provider_reference,p_amount,p_currency);
end; $$;

create function public.approve_manual_payment(p_attempt_id uuid,p_actor_profile_id uuid,p_decision text,p_reason text)
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

create function public.expire_holds(p_event_id uuid) returns integer
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

create function public.cancel_participation(p_participant_id uuid,p_reason text,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; v_event_id uuid;
begin
 select event_participants.event_id into strict v_event_id from public.event_participants where id=p_participant_id;
 select * into strict e from public.events where id=v_event_id for update;
 select * into strict p from public.event_participants where id=p_participant_id for update;
 if p_actor_profile_id is not null and p_actor_profile_id=e.organizer_profile_id then perform dolend_private.assert_organizer(e.id,p_actor_profile_id);
 else perform dolend_private.assert_person(p.person_id,e.id,p_actor_profile_id,p_guest_session_hash); end if;
 if p.status='cancelled' then return p; end if;
 if p.status in ('attended','no_show') then raise exception 'ATTENDANCE_RECORDED'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 update public.event_participants set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason=p_reason where id=p.id returning * into p;
 update public.invoices set status='void' where participant_id=p.id and status='open';
 insert into public.outbox_jobs(kind,aggregate_id,dedupe_key) select 'refund_review',i.id,'refund-review:'||i.id::text from public.invoices i where i.participant_id=p.id and exists(select 1 from public.payment_ledger l where l.invoice_id=i.id and l.entry_type='receipt') on conflict(dedupe_key) do nothing;
 perform dolend_private.audit(p_actor_profile_id,'participant.cancel','participant',p.id);
 return p;
end; $$;

create function public.cancel_event(p_event_id uuid,p_actor_profile_id uuid,p_reason text) returns void
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

create function public.request_refund(p_attempt_id uuid,p_actor_profile_id uuid,p_amount bigint,p_reason text,p_key text)
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

create function public.record_refund(p_refund_id uuid,p_actor_profile_id uuid,p_reference text,p_evidence_path text default null)
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

create function public.claim_guest_identity(p_auth_user_id uuid,p_challenge_id uuid) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare c public.verification_challenges; person public.people; profile public.profiles;
begin
 -- Serialize concurrent claims by account and phone before consuming proof.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_auth_user_id::text,0));
 select * into strict c from public.verification_challenges where id=p_challenge_id for update;
 if c.auth_user_id is distinct from p_auth_user_id or c.purpose<>'claim' or c.verified_at is null or c.expires_at<=clock_timestamp() or c.consumed_at is not null then raise exception 'INVALID_IDENTITY_PROOF' using errcode='42501'; end if;
 select * into strict person from public.people where phone_normalized=c.phone_normalized for update;
 if person.state<>'active' or not exists(select 1 from auth.users where id=p_auth_user_id and phone_confirmed_at is not null and replace(phone,'+','')=person.phone_normalized and deleted_at is null and (banned_until is null or banned_until<now())) then raise exception 'INVALID_AUTH_IDENTITY' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where person_id=person.id and id<>p_auth_user_id) or exists(select 1 from public.profiles where id=p_auth_user_id and person_id<>person.id) then raise exception 'IDENTITY_COLLISION' using errcode='42501'; end if;
 update public.people set phone_verified_at=coalesce(phone_verified_at,c.verified_at) where id=person.id;
 insert into public.profiles(id,person_id) values(p_auth_user_id,person.id) on conflict(id) do nothing;
 select * into strict profile from public.profiles where id=p_auth_user_id;
 update public.verification_challenges set consumed_at=clock_timestamp() where id=c.id;
 insert into public.identity_claims(person_id,auth_user_id,challenge_id,status,expires_at,resolved_at) values(person.id,p_auth_user_id,c.id,'resolved',c.expires_at,clock_timestamp());
 perform dolend_private.audit(p_auth_user_id,'identity.claim','person',person.id);
 return profile;
end; $$;

-- Runtime roles cannot mutate history/ledger/audit. Privileged database maintenance remains possible.
revoke all on function public.join_event(uuid,uuid,uuid,text),public.create_payment_attempt(uuid,uuid,text,uuid,text),public.submit_manual_evidence(uuid,text,text,bigint,uuid,text),public.apply_provider_payment(uuid,text,text,bigint,text),public.approve_manual_payment(uuid,uuid,text,text),public.expire_holds(uuid),public.cancel_participation(uuid,text,uuid,text),public.cancel_event(uuid,uuid,text),public.request_refund(uuid,uuid,bigint,text,text),public.record_refund(uuid,uuid,text,text),public.claim_guest_identity(uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_event(uuid,uuid,uuid,text),public.create_payment_attempt(uuid,uuid,text,uuid,text),public.submit_manual_evidence(uuid,text,text,bigint,uuid,text),public.apply_provider_payment(uuid,text,text,bigint,text),public.approve_manual_payment(uuid,uuid,text,text),public.expire_holds(uuid),public.cancel_participation(uuid,text,uuid,text),public.cancel_event(uuid,uuid,text),public.request_refund(uuid,uuid,bigint,text,text),public.record_refund(uuid,uuid,text,text),public.claim_guest_identity(uuid,uuid) to service_role;
