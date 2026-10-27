-- Enforce receipt-backed status and refund bounds even if server code attempts a direct write.
create function dolend_private.guard_attempt_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.provider_reference is not null and new.provider_reference is distinct from old.provider_reference then raise exception 'IMMUTABLE_PROVIDER_REFERENCE'; end if;
 if new.status='succeeded' and not exists(select 1 from public.payment_ledger where attempt_id=new.id and invoice_id=new.invoice_id and entry_type='receipt' and amount=new.amount and currency=new.currency) then raise exception 'RECEIPT_REQUIRED'; end if;
 return new;
end; $$;
create trigger guard_attempt_receipt before insert or update on public.payment_attempts for each row execute function dolend_private.guard_attempt_receipt();

create function dolend_private.guard_ledger() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_event uuid; i public.invoices; a public.payment_attempts; received bigint; refunded bigint;
begin
 select p.event_id into strict v_event from public.invoices i0 join public.event_participants p on p.id=i0.participant_id where i0.id=new.invoice_id;
 perform 1 from public.events where id=v_event for update;
 select * into strict i from public.invoices where id=new.invoice_id for update;
 if i.currency<>new.currency then raise exception 'LEDGER_CURRENCY_MISMATCH'; end if;
 if new.entry_type in ('receipt','refund') then
  if new.attempt_id is null then raise exception 'LEDGER_ATTEMPT_REQUIRED'; end if;
  select * into strict a from public.payment_attempts where id=new.attempt_id for update;
  if a.invoice_id<>new.invoice_id or a.currency<>new.currency then raise exception 'LEDGER_ATTEMPT_MISMATCH'; end if;
  select coalesce(sum(amount),0) into received from public.payment_ledger where attempt_id=a.id and entry_type='receipt';
  if new.entry_type='receipt' and (received>0 or new.amount<>a.amount) then raise exception 'INVALID_RECEIPT'; end if;
  select coalesce(sum(amount),0) into refunded from public.payment_ledger where attempt_id=a.id and entry_type='refund';
  if new.entry_type='refund' and refunded+new.amount>received then raise exception 'REFUND_EXCEEDS_RECEIPTS'; end if;
 end if;
 return new;
end; $$;
create trigger guard_ledger before insert on public.payment_ledger for each row execute function dolend_private.guard_ledger();
revoke all on function dolend_private.guard_attempt_receipt(),dolend_private.guard_ledger() from public,anon,authenticated,service_role;
