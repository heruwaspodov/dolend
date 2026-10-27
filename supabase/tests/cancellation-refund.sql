-- Hosted regression with no persistent fixtures. Entire test rolls back.
begin;
do $$
declare account_id uuid:=gen_random_uuid(); person_id uuid:=gen_random_uuid(); event_id uuid:=gen_random_uuid(); method_id uuid:=gen_random_uuid();
 p public.event_participants; i public.invoices; a public.payment_attempts; phone text:='628' || (10000000000+floor(random()*89999999999)::bigint)::text;
begin
 insert into auth.users(id,phone,phone_confirmed_at,created_at,updated_at) values(account_id,phone,now(),now(),now());
 insert into public.people(id,display_name,phone_normalized,phone_verified_at) values(person_id,'Rollback-only fixture',phone,now());
 insert into public.profiles(id,person_id) values(account_id,person_id);
 insert into public.events(id,organizer_profile_id,activity_type_id,title,venue_snapshot,starts_at,ends_at,registration_closes_at,capacity,payment_mode,price_amount,payment_due_at)
 values(event_id,account_id,(select id from public.activity_types where slug='walking'),'Rollback-only fixture','{"name":"Fixture","address":"Fixture"}',now()+interval '1 day',now()+interval '1 day 1 hour',now()+interval '23 hours',1,'after_event',10000,now()+interval '2 days');
 insert into public.event_payment_methods(id,event_id,method_type,provider,provider_method) values(method_id,event_id,'qris','fixture','qris');
 update public.events set status='published' where id=event_id;
 p=public.join_event(event_id,person_id,account_id);
 select * into strict i from public.invoices where participant_id=p.id;
 a=public.create_payment_attempt(i.id,method_id,'rollback-only',account_id);
 update public.payment_attempts set provider_reference=a.id::text where id=a.id;
 a=public.apply_provider_payment(a.id,'fixture',a.id::text,10000,'IDR');
 update public.events set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour',registration_closes_at=now()-interval '2 hours' where id=event_id;
 update public.event_participants set status='attended',attendance_at=now() where id=p.id;
 perform public.cancel_event(event_id,account_id,'Rollback-only regression');
 if (select count(*) from public.outbox_jobs where aggregate_id=i.id and kind='refund_review')<>1 then raise exception 'REFUND_REVIEW_NOT_QUEUED'; end if;
 if (select status from public.event_participants where id=p.id)<>'attended' then raise exception 'ATTENDANCE_HISTORY_LOST'; end if;
 if (select count(*) from public.payment_ledger where invoice_id=i.id and entry_type='receipt')<>1 then raise exception 'RECEIPT_LOST'; end if;
end $$;
rollback;
