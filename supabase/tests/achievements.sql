begin;
do $$
declare
  v_profile uuid:=gen_random_uuid();
  v_user uuid:=gen_random_uuid();
  v_viewer uuid:=gen_random_uuid();
  v_viewer_user uuid:=gen_random_uuid();
  v_owner uuid:=gen_random_uuid();
  v_type uuid;
  v_workspace uuid:=gen_random_uuid();
  v_event_a uuid:=gen_random_uuid();
  v_event_b uuid:=gen_random_uuid();
  v_event_c uuid:=gen_random_uuid();
  v_achievement public.achievement_definitions;
  v_participant uuid;
  v_result jsonb;
  v_audit_count integer;
begin
  insert into auth.users(id) values(v_profile),(v_viewer),(v_owner);
  insert into public.users(id,display_name,phone_normalized) values
    (v_user,'Achievement member','628123450020'),(v_viewer_user,'Achievement viewer','628123450021'),(v_owner,'Achievement organizer','628123450022');
  insert into public.profiles(id,user_id) values(v_profile,v_user),(v_viewer,v_viewer_user),(v_owner,v_owner);
  update public.profiles set is_private=true where id=v_profile;
  insert into public.workspaces(id,name,created_by_profile_id) values(v_workspace,'Achievement fixture',v_owner);
  select id into v_type from public.activity_types limit 1;
  v_achievement:=public.create_achievement_definition('attend_two','Hadir dua kali','Verified completed event attendance',2);
  insert into public.events(id,workspace_id,organizer_profile_id,activity_type_id,title,starts_at,ends_at,timezone,capacity,registration_closes_at,visibility,status,payment_mode,price_amount)
  values
    (v_event_a,v_workspace,v_owner,v_type,'Completed A',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','UTC',10,now()-interval '3 days','public','completed','free',0),
    (v_event_b,v_workspace,v_owner,v_type,'Completed B',now()-interval '1 day',now()-interval '1 day'+interval '1 hour','UTC',10,now()-interval '2 days','public','completed','free',0),
    (v_event_c,v_workspace,v_owner,v_type,'Completed C',now()-interval '12 hours',now()-interval '12 hours'+interval '1 hour','UTC',10,now()-interval '1 day','public','completed','free',0);
  insert into public.event_organizers(event_id,profile_id,role) values(v_event_a,v_owner,'owner'),(v_event_b,v_owner,'owner'),(v_event_c,v_owner,'owner');
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at) values(v_event_a,v_user,'member','attended',now()-interval '2 days');
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if exists(select 1 from public.achievement_awards where profile_id=v_profile and achievement_id=v_achievement.id and status='awarded') then raise exception 'AWARDED_BELOW_THRESHOLD'; end if;
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at) values(v_event_b,v_user,'member','attended',now()-interval '1 day');
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if (v_result->>'awarded')::integer<>1 then raise exception 'THRESHOLD_BOUNDARY_NOT_AWARDED'; end if;
  select count(*)::integer into v_audit_count from public.achievement_award_audit where profile_id=v_profile;
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if (v_result->>'awarded')::integer<>0 or (select count(*)::integer from public.achievement_award_audit where profile_id=v_profile)<>v_audit_count then raise exception 'RETRY_NOT_IDEMPOTENT'; end if;
  if (select cardinality(evidence_event_ids) from public.achievement_awards where profile_id=v_profile and achievement_id=v_achievement.id and status='awarded')<>2 then raise exception 'EVIDENCE_IDS_MISSING'; end if;
  if (select count(*) from public.get_profile_achievements(v_viewer,v_profile))<>0 then raise exception 'PRIVATE_BADGE_LEAKED'; end if;
  if (select count(*) from public.get_profile_achievements(v_profile,v_profile))<2 then raise exception 'SELF_BADGE_HIDDEN'; end if;

  select id into v_participant from public.event_participants where event_id=v_event_b and user_id=v_user;
  perform public.record_event_attendance(v_participant,v_owner,'no_show');
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if (v_result->>'revoked')::integer<>1 or (select status from public.achievement_awards where profile_id=v_profile and achievement_id=v_achievement.id and rule_version=1)<>'revoked' then raise exception 'CORRECTION_DID_NOT_REVOKE'; end if;
  perform public.record_event_attendance(v_participant,v_owner,'attended');
  perform public.rebuild_achievement_awards(array[v_profile]);
  v_achievement:=public.update_achievement_definition('attend_two','Hadir tiga kali','Versioned attendance threshold',3,true);
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if (v_result->>'revoked')::integer<>1 then raise exception 'OLD_RULE_VERSION_NOT_REVOKED'; end if;
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at) values(v_event_c,v_user,'member','attended',now()-interval '12 hours');
  v_result:=public.rebuild_achievement_awards(array[v_profile]);
  if (v_result->>'awarded')::integer<>1 or not exists(select 1 from public.achievement_awards where profile_id=v_profile and achievement_id=v_achievement.id and rule_version=2 and status='awarded') then raise exception 'NEW_RULE_VERSION_NOT_AWARDED'; end if;
  perform public.run_achievement_maintenance(100);
  if exists(select 1 from public.achievement_rebuild_jobs where profile_id=v_profile and status<>'done') then raise exception 'ACHIEVEMENT_JOB_NOT_RETRY_SAFE'; end if;
  if (select count(distinct rule_version) from public.achievement_award_audit where profile_id=v_profile and action='awarded')<>2 then raise exception 'AWARD_AUDIT_MISSING'; end if;
end $$;
rollback;
