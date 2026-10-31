-- Fixtures use the parent local-test.mjs Google identities/workspaces.
do $$
declare owner uuid='10000000-0000-4000-8000-000000000001'; other uuid='10000000-0000-4000-8000-000000000002';
 e uuid; p uuid; c uuid; m uuid; r public.manual_payment_records; n bigint; guest uuid; late uuid; hash text;
begin
 insert into public.events(organizer_profile_id,workspace_id,activity_type_id,title,starts_at,ends_at,registration_closes_at,capacity,contribution_mode,status,estimated_total_cost)
 values(owner,(select id from public.workspaces where created_by_profile_id=owner limit 1),(select id from public.activity_types limit 1),'Dynamic fixture',now()+interval '1 day',now()+interval '2 days',now()+interval '23 hours',3,'dynamic','recruiting',10001) returning id into e;
 begin perform public.lock_contributions(e,owner);
 perform public.join_event(e,guest,null,hash);
 if exists(select 1 from public.participant_charges where participant_id=late) then raise exception 'AUTO_LATE_CHARGE'; end if;
 perform public.assign_contribution(late,owner,7000);
 perform public.cancel_dynamic_participant(late,owner,null,'waive','Late cancellation waived','cancel-waive');
 if (select amount from public.participant_charges where participant_id=late)<>7000 then raise exception 'WAIVE_REWROTE_CHARGE'; end if;
 if (select sum(amount) from public.contribution_ledger where charge_id=(select id from public.participant_charges where participant_id=late))<>-7000 then raise exception 'WAIVE_MISSING_ADJUSTMENT'; end if; raise exception 'EXPECTED_ZERO_REJECTION'; exception when others then if sqlerrm<>'NO_CHARGEABLE_PARTICIPANTS' then raise; end if; end;
 select id into p from public.join_event(e,'20000000-0000-4000-8000-000000000001',owner);
 perform public.join_event(e,'20000000-0000-4000-8000-000000000002',other);
 insert into public.users(display_name) values('Guest dynamic fixture') returning id into guest;
 hash=replace(e::text,'-','')||replace(e::text,'-','');
 insert into public.guest_sessions(user_id,scope_event_id,token_hash,expires_at) values(guest,e,hash,now()+interval '3 days');
 select id into late from public.join_event(e,guest,null,hash);
 perform public.cancel_dynamic_participant(late,owner,null,'retain','Before lock','cancel-before');
 n=public.lock_contributions(e,owner); if n<>5001 then raise exception 'ROUNDING_FAILED'; end if;
 perform public.lock_contributions(e,owner);
 select id into c from public.participant_charges where participant_id=p;
 update public.events set estimated_total_cost=30000 where id=e;
 if (select amount from public.participant_charges where id=c)<>5001 then raise exception 'LOCK_CHANGED'; end if;
 begin perform public.assign_contribution(p,owner,9000); raise exception 'EXPECTED_IMMUTABLE'; exception when others then if sqlerrm<>'IMMUTABLE_CHARGE' then raise; end if; end;
 insert into public.organizer_payment_methods(organizer_id,type,recipient_name) values(owner,'cash','Owner') returning id into m;
 insert into public.manual_event_methods(event_id,method_id) values(e,m);
 r=public.report_manual_payment(c,m,2000,'partial-1',owner);
 if r.status<>'pending_verification' then raise exception 'PREMATURE_PAID'; end if;
 begin perform public.review_manual_payment(r.id,other,'verified','Bad actor'); raise exception 'EXPECTED_OWNER_REJECTION'; exception when insufficient_privilege then null; end;
 perform public.review_manual_payment(r.id,owner,'verified','Cash received');
 perform public.review_manual_payment(r.id,owner,'verified','Cash received');
 if (select count(*) from public.contribution_ledger where charge_id=c)<>1 then raise exception 'DOUBLE_RECEIPT'; end if;
 begin perform public.review_manual_payment(r.id,owner,'rejected','No'); raise exception 'EXPECTED_REVIEW_REJECTION'; exception when others then if sqlerrm<>'PAYMENT_ALREADY_REVIEWED' then raise; end if; end;
 r=public.report_manual_payment(c,m,4000,'partial-2',owner);
 perform public.review_manual_payment(r.id,owner,'verified','Overpayment received');
 if (select sum(amount) from public.contribution_ledger where charge_id=c and entry_type='receipt')<>6000 then raise exception 'PARTIAL_FAILED'; end if;
 perform public.adjust_contribution(c,owner,'refund',999,'Return overpayment','refund-1');
 perform public.adjust_contribution(c,owner,'refund',999,'Return overpayment','refund-1');
 begin perform public.adjust_contribution(c,owner,'refund',6000,'Too much','refund-bad'); raise exception 'EXPECTED_REFUND_LIMIT'; exception when others then if sqlerrm<>'REFUND_EXCEEDS_RECEIPTS' then raise; end if; end;
 perform public.cancel_dynamic_participant(p,owner,null,'retain','Cancelled after lock','cancel-1');
 if (select amount from public.participant_charges where id=c)<>5001 then raise exception 'CANCEL_REWROTE_CHARGE'; end if;
end; $$;
