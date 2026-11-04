-- Track private uploads before they are attached to a business record. This lets a
-- provider-neutral worker remove abandoned objects without scanning bucket names.
create table public.private_uploads (
 storage_reference text primary key,
 purpose text not null check(purpose in ('qris','payment_proof')),
 owner_profile_id uuid references public.profiles(id) on delete set null,
 charge_id uuid references public.participant_charges(id) on delete set null,
 content_type text check(content_type is null or content_type in ('image/png','image/jpeg')),
 size_bytes bigint check(size_bytes is null or size_bytes between 1 and 2097152),
 attachment_type text check(attachment_type is null or attachment_type in ('organizer_payment_method','manual_payment_record')),
 attachment_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '24 hours'),
 attached_at timestamptz,
 cleanup_started_at timestamptz,
 cleanup_attempts integer not null default 0 check(cleanup_attempts>=0),
 check(storage_reference ~ '^(s3:|supabase:)?(qris|proof)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg)$'),
 check((attached_at is null and attachment_type is null and attachment_id is null) or
       (attached_at is not null and attachment_type is not null and attachment_id is not null)),
 check((purpose='qris' and charge_id is null) or (purpose='payment_proof' and charge_id is not null))
);
create index private_uploads_orphan_expiry_idx on public.private_uploads(expires_at)
 where attached_at is null;
create index private_uploads_owner_idx on public.private_uploads(owner_profile_id)
 where owner_profile_id is not null;
create index private_uploads_charge_idx on public.private_uploads(charge_id)
 where charge_id is not null;

alter table public.private_uploads enable row level security;
revoke all on public.private_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.private_uploads to service_role;

-- Existing referenced objects are retained as attached legacy records. Their size
-- and MIME are unknown because those attributes lived only in object storage.
insert into public.private_uploads(storage_reference,purpose,owner_profile_id,attachment_type,attachment_id,created_at,expires_at,attached_at)
select storage_path,'qris',organizer_id,'organizer_payment_method',id,created_at,created_at+interval '24 hours',created_at
from public.organizer_payment_methods where storage_path is not null
on conflict(storage_reference) do nothing;

insert into public.private_uploads(storage_reference,purpose,charge_id,owner_profile_id,attachment_type,attachment_id,created_at,expires_at,attached_at)
select proof_storage_path,'payment_proof',charge_id,recorded_by,'manual_payment_record',id,created_at,created_at+interval '24 hours',created_at
from public.manual_payment_records where proof_storage_path is not null
on conflict(storage_reference) do nothing;

create function public.create_organizer_payment_method(
 p_actor uuid,p_type text,p_recipient_name text,p_storage_reference text default null,p_bank_details jsonb default null
) returns public.organizer_payment_methods
language plpgsql security definer set search_path='' as $$
declare upload public.private_uploads; method public.organizer_payment_methods;
begin
 if p_type='static_qris' then
  select * into upload from public.private_uploads
  where storage_reference=p_storage_reference and purpose='qris' and owner_profile_id=p_actor
    and attached_at is null and cleanup_started_at is null and expires_at>clock_timestamp()
  for update;
  if upload.storage_reference is null then raise exception 'INVALID_UPLOAD'; end if;
 elsif p_storage_reference is not null then
  raise exception 'INVALID_UPLOAD';
 end if;

 insert into public.organizer_payment_methods(organizer_id,type,recipient_name,storage_path,bank_details)
 values(p_actor,p_type,p_recipient_name,p_storage_reference,p_bank_details) returning * into method;

 if p_storage_reference is not null then
  update public.private_uploads set attached_at=clock_timestamp(),attachment_type='organizer_payment_method',attachment_id=method.id
  where storage_reference=p_storage_reference;
 end if;
 return method;
end; $$;
revoke all on function public.create_organizer_payment_method(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_organizer_payment_method(uuid,text,text,text,jsonb) to service_role;

create or replace function public.report_manual_payment(p_charge uuid,p_method uuid,p_amount bigint,p_key text,p_actor uuid default null,p_guest_hash text default null,p_proof text default null)
returns public.manual_payment_records language plpgsql security definer set search_path='' as $$
declare p public.event_participants; e public.events; m public.organizer_payment_methods; r public.manual_payment_records; upload public.private_uploads;
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

 select * into r from public.manual_payment_records where charge_id=p_charge and idempotency_key=p_key;
 if r.id is not null then
  if r.amount<>p_amount or r.method_id<>p_method or r.proof_storage_path is distinct from p_proof then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
  return r;
 end if;

 if p_proof is not null then
  select * into upload from public.private_uploads
  where storage_reference=p_proof and purpose='payment_proof' and charge_id=p_charge
    and attached_at is null and cleanup_started_at is null and expires_at>clock_timestamp()
  for update;
  if upload.storage_reference is null then raise exception 'INVALID_UPLOAD'; end if;
 end if;

 insert into public.manual_payment_records(charge_id,method_id,amount,idempotency_key,proof_storage_path,recorded_by)
 values(p_charge,p_method,p_amount,p_key,p_proof,p_actor) returning * into r;
 if p_proof is not null then
  update public.private_uploads set attached_at=clock_timestamp(),attachment_type='manual_payment_record',attachment_id=r.id
  where storage_reference=p_proof;
 end if;
 return r;
end; $$;

create function public.claim_expired_private_uploads(p_limit integer default 100)
returns setof public.private_uploads
language plpgsql security definer set search_path='' as $$
begin
 if p_limit not between 1 and 500 then raise exception 'INVALID_CLEANUP_LIMIT'; end if;
 return query
 with candidates as (
  select storage_reference from public.private_uploads
  where attached_at is null and expires_at<=clock_timestamp()
    and (cleanup_started_at is null or cleanup_started_at<clock_timestamp()-interval '15 minutes')
  order by expires_at for update skip locked limit p_limit
 )
 update public.private_uploads u set cleanup_started_at=clock_timestamp(),cleanup_attempts=u.cleanup_attempts+1
 from candidates c where u.storage_reference=c.storage_reference returning u.*;
end; $$;
revoke all on function public.claim_expired_private_uploads(integer) from public,anon,authenticated;
grant execute on function public.claim_expired_private_uploads(integer) to service_role;
