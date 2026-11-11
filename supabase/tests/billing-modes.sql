do $$
declare owner uuid='10000000-0000-4000-8000-000000000001'; owner_user uuid='20000000-0000-4000-8000-000000000001';
 other uuid='10000000-0000-4000-8000-000000000002'; other_user uuid='20000000-0000-4000-8000-000000000002';
 workspace uuid; activity uuid; bank uuid; free_event public.events; before_event public.events; after_event public.events;
 participant public.event_participants; invoice public.invoices; event_method uuid; attempt public.payment_attempts;
 venue jsonb='{"name":"GOR Dolend","address":"Jl. Fixture 1","maps_url":""}'::jsonb;
begin
 select id into strict workspace from public.workspaces where created_by_profile_id=owner limit 1;
 select id into strict activity from public.activity_types limit 1;
 insert into public.organizer_payment_methods(organizer_id,type,recipient_name,bank_details)
 values(owner,'bank_transfer','Rekening fixture','{"bank":"BCA","account":"123456"}') returning id into bank;

 free_event=public.create_billed_event(p_actor=>owner,p_workspace=>workspace,p_activity_type=>activity,p_title=>'Free billed fixture',
  p_description=>'',p_starts_at=>now()+interval '2 days',p_ends_at=>now()+interval '2 days 2 hours',
  p_registration_closes_at=>now()+interval '1 day',p_timezone=>'Asia/Jakarta',p_capacity=>4,p_visibility=>'public',
  p_venue_snapshot=>venue,p_payment_mode=>'free',p_price_amount=>0);
 if free_event.cost_model is distinct from 'free' or free_event.payment_timing is distinct from null then
  raise exception 'INVALID_COST_MODEL_OR_TIMING';
 end if;
 begin
  update public.events set payment_timing='before_event' where id=free_event.id;
  raise exception 'EXPECTED_FREE_TIMING_REJECTION';
 exception when check_violation then
  if sqlerrm not like '%events_cost_model_payment_timing_check%' then raise; end if;
 end;
 participant=public.join_event(free_event.id,owner_user,owner);
 if exists(select 1 from public.invoices where participant_id=participant.id) then raise exception 'FREE_CREATED_INVOICE'; end if;

 before_event=public.create_billed_event(p_actor=>owner,p_workspace=>workspace,p_activity_type=>activity,p_title=>'Prepay fixture',
  p_description=>'',p_starts_at=>now()+interval '3 days',p_ends_at=>now()+interval '3 days 2 hours',
  p_registration_closes_at=>now()+interval '2 days',p_timezone=>'Asia/Jakarta',p_capacity=>4,p_visibility=>'unlisted',
  p_venue_snapshot=>venue,p_payment_mode=>'before_event',p_price_amount=>5000,p_hold_minutes=>30,p_payment_method=>bank);
 if before_event.cost_model is distinct from 'fixed' or before_event.payment_timing is distinct from 'before_event' then
  raise exception 'INVALID_COST_MODEL_OR_TIMING';
 end if;
 participant=public.join_event(before_event.id,other_user,other);
 if participant.status<>'held' then raise exception 'PREPAY_NOT_HELD'; end if;
 select * into strict invoice from public.invoices where participant_id=participant.id;
 if invoice.amount_due<>5000 or invoice.pricing_snapshot->>'mode'<>'before_event' then raise exception 'PREPAY_SNAPSHOT_INVALID'; end if;
 perform public.join_event(before_event.id,other_user,other);
 if (select count(*) from public.invoices where participant_id=participant.id)<>1 then raise exception 'DUPLICATE_INVOICE'; end if;
 update public.events set price_amount=9000 where id=before_event.id;
 if (select amount_due from public.invoices where id=invoice.id)<>5000 then raise exception 'PRICE_SNAPSHOT_CHANGED'; end if;
 select id into strict event_method from public.event_payment_methods where event_id=before_event.id;
 attempt=public.create_payment_attempt(invoice.id,event_method,'same-action',other);
 if (public.create_payment_attempt(invoice.id,event_method,'same-action',other)).id<>attempt.id then raise exception 'ATTEMPT_NOT_IDEMPOTENT'; end if;

 after_event=public.create_billed_event(p_actor=>owner,p_workspace=>workspace,p_activity_type=>activity,p_title=>'Postpay fixture',
  p_description=>'',p_starts_at=>now()+interval '4 days',p_ends_at=>now()+interval '4 days 2 hours',
  p_registration_closes_at=>now()+interval '3 days',p_timezone=>'Asia/Jakarta',p_capacity=>4,p_visibility=>'public',
  p_venue_snapshot=>venue,p_payment_mode=>'after_event',p_price_amount=>7000,p_payment_due_at=>now()+interval '5 days',p_payment_method=>bank);
 if after_event.cost_model is distinct from 'fixed' or after_event.payment_timing is distinct from 'after_event' then
  raise exception 'INVALID_COST_MODEL_OR_TIMING';
 end if;
 participant=public.join_event(after_event.id,owner_user,owner);
 select * into strict invoice from public.invoices where participant_id=participant.id;
 if participant.status<>'confirmed' or invoice.due_at<after_event.ends_at then raise exception 'POSTPAY_DUE_INVALID'; end if;

 begin
  perform public.create_billed_event(p_actor=>owner,p_workspace=>workspace,p_activity_type=>activity,p_title=>'Bad due',p_description=>'',
   p_starts_at=>now()+interval '6 days',p_ends_at=>now()+interval '6 days 2 hours',p_registration_closes_at=>now()+interval '5 days',
   p_timezone=>'Asia/Jakarta',p_capacity=>2,p_visibility=>'public',p_venue_snapshot=>venue,p_payment_mode=>'after_event',
   p_price_amount=>1000,p_payment_due_at=>now()+interval '6 days',p_payment_method=>bank);
  raise exception 'EXPECTED_DUE_REJECTION';
 exception when others then if sqlerrm<>'INVALID_PAYMENT_DUE_AT' then raise; end if; end;
end; $$;
