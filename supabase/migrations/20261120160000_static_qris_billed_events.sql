create or replace function public.create_billed_event(
 p_actor uuid,
 p_workspace uuid,
 p_activity_type uuid,
 p_title text,
 p_description text,
 p_starts_at timestamptz,
 p_ends_at timestamptz,
 p_registration_closes_at timestamptz,
 p_timezone text,
 p_capacity integer,
 p_visibility text,
 p_venue_snapshot jsonb,
 p_payment_mode text,
 p_price_amount bigint,
 p_payment_due_at timestamptz default null,
 p_hold_minutes integer default 15,
 p_payment_method uuid default null
) returns public.events
language plpgsql security definer set search_path='' as $$
declare event_row public.events; method public.organizer_payment_methods;
begin
 perform dolend_private.assert_profile(p_actor);
 if not dolend_private.can_organize_workspace(p_workspace,p_actor) then raise exception 'ORGANIZER_REQUIRED' using errcode='42501'; end if;
 if p_payment_mode not in ('free','before_event','after_event') then raise exception 'INVALID_PAYMENT_MODE'; end if;
 if (p_payment_mode='free' and (p_price_amount<>0 or p_payment_method is not null)) or
    (p_payment_mode<>'free' and (p_price_amount<=0 or p_payment_method is null)) then raise exception 'INVALID_BILLING_CONFIGURATION'; end if;
 if p_payment_mode='after_event' and (p_payment_due_at is null or p_payment_due_at<p_ends_at) then raise exception 'INVALID_PAYMENT_DUE_AT'; end if;

 if p_payment_method is not null then
  select * into method from public.organizer_payment_methods
  where id=p_payment_method and organizer_id=p_actor and type in ('bank_transfer','static_qris') and is_active;
  if method.id is null then raise exception 'INVALID_PAYMENT_METHOD'; end if;
 end if;

 insert into public.events(
  organizer_profile_id,workspace_id,activity_type_id,title,description,starts_at,ends_at,
  registration_closes_at,timezone,capacity,visibility,status,payment_mode,price_amount,
  payment_due_at,hold_minutes,venue_snapshot,contribution_mode,estimated_total_cost
 ) values(
  p_actor,p_workspace,p_activity_type,p_title,coalesce(p_description,''),p_starts_at,p_ends_at,
  p_registration_closes_at,p_timezone,p_capacity,p_visibility,'draft',p_payment_mode,p_price_amount,
  p_payment_due_at,p_hold_minutes,p_venue_snapshot,'legacy',p_price_amount
 ) returning * into event_row;

 insert into public.event_organizers(event_id,profile_id,role) values(event_row.id,p_actor,'owner');
 if method.id is not null then
  insert into public.event_payment_methods(event_id,method_type,provider,provider_method,instruction_snapshot)
  values(event_row.id,
   case when method.type='static_qris' then 'qris' else 'manual_bank_transfer' end,
   case when method.type='static_qris' then 'manual' else null end,
   case when method.type='static_qris' then 'static_qris' else null end,
   case when method.type='static_qris' then jsonb_build_object(
    'source_method_id',method.id,'recipient_name',method.recipient_name,'storage_path',method.storage_path
   ) else jsonb_build_object(
    'source_method_id',method.id,'recipient_name',method.recipient_name,'bank_details',method.bank_details
   ) end
  );
 end if;
 update public.events set status='published' where id=event_row.id returning * into event_row;
 perform dolend_private.audit(p_actor,'event.create','event',event_row.id,jsonb_build_object('billing_mode',p_payment_mode));
 return event_row;
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
 if (a.method_type<>'manual_bank_transfer' and not (
  a.method_type='qris' and exists(
   select 1 from public.event_payment_methods m
   where m.id=a.payment_method_id and m.provider='manual' and m.provider_method='static_qris'
  )
 )) or a.status not in ('created','pending') or i.status<>'open' or e.status='cancelled' or p.status in ('cancelled','expired') then raise exception 'INVALID_EVIDENCE_STATE'; end if;
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

create or replace function public.apply_provider_payment(p_attempt_id uuid,p_provider text,p_provider_reference text,p_amount bigint,p_currency text)
returns public.payment_attempts language plpgsql security definer set search_path='' as $$
begin
 if p_provider is null or p_provider_reference is null or not exists(select 1 from public.payment_attempts where id=p_attempt_id and method_type in ('qris','gateway') and provider=p_provider and provider_reference=p_provider_reference and not (provider='manual' and method_type='qris')) then raise exception 'PROVIDER_REFERENCE_MISMATCH'; end if;
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
 if a.method_type<>'manual_bank_transfer' and not (
  a.method_type='qris' and exists(
   select 1 from public.event_payment_methods m
   where m.id=a.payment_method_id and m.provider='manual' and m.provider_method='static_qris'
  )
 ) then raise exception 'MANUAL_PAYMENT_REQUIRED'; end if;
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
 if (a.method_type='manual_bank_transfer' or (
  a.method_type='qris' and exists(
   select 1 from public.event_payment_methods m
   where m.id=a.payment_method_id and m.provider='manual' and m.provider_method='static_qris'
  )
 )) and length(trim(coalesce(p_evidence_path,'')))=0 then raise exception 'REFUND_EVIDENCE_REQUIRED'; end if;
 insert into public.payment_ledger(invoice_id,attempt_id,entry_type,amount,currency,source_reference) values(i.id,a.id,'refund',r.amount,a.currency,'refund:'||r.id::text);
 update public.refunds set status='succeeded',provider_reference=p_reference,evidence_path=p_evidence_path where id=r.id returning * into r;
 perform dolend_private.audit(p_actor_profile_id,'refund.recorded','refund',r.id);
 return r;
end; $$;
