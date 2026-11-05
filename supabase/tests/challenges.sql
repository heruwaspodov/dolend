begin;
do $$
declare
  v_owner uuid:=gen_random_uuid();
  v_user uuid:=gen_random_uuid();
  v_profile uuid:=gen_random_uuid();
  v_activity_type uuid;
  v_workspace uuid:=gen_random_uuid();
  v_challenge public.challenges;
  v_join_challenge public.challenges;
  v_eligibility_challenge public.challenges;
  v_member public.challenge_members;
  v_event_inside uuid:=gen_random_uuid();
  v_event_outside uuid:=gen_random_uuid();
  v_from uuid;
  v_to uuid;
  v_participant uuid;
  v_result jsonb;
begin
  insert into auth.users(id) values(v_owner),(v_profile);
  insert into public.users(id,display_name,phone_normalized) values
    (v_owner,'Challenge owner','628123450010'),(v_user,'Challenge member','628123450011');
  insert into public.profiles(id,user_id) values(v_owner,v_owner),(v_profile,v_user);
  insert into public.workspaces(id,name,created_by_profile_id) values(v_workspace,'Challenge fixture',v_owner);
  select id into v_activity_type from public.activity_types limit 1;
  if v_activity_type is null then raise exception 'NO_ACTIVITY_TYPE_FIXTURE'; end if;

  v_join_challenge:=public.create_challenge(v_owner,'Current attendance','Join access fixture',1,current_date,current_date+2,'UTC','{}');
  v_member:=public.join_challenge(v_profile,v_join_challenge.id);
  if v_member.status<>'joined' then raise exception 'CHALLENGE_JOIN_FAILED'; end if;
  perform public.join_challenge(v_profile,v_join_challenge.id);
  if (select count(*) from public.challenge_members where challenge_id=v_join_challenge.id and profile_id=v_profile)<>1 then raise exception 'DUPLICATE_JOIN_CREATED'; end if;
  v_join_challenge:=public.update_challenge(v_owner,v_join_challenge.id,1,'Current attendance updated','Versioned rules',2,current_date,current_date+3,'UTC','{}');
  if v_join_challenge.rule_version<>2 then raise exception 'CHALLENGE_RULE_VERSION_NOT_ADVANCED'; end if;
  if (select rules->>'target' from public.challenge_rule_versions where challenge_id=v_join_challenge.id and version=1)<>'1' then raise exception 'CHALLENGE_PRIOR_RULE_CHANGED'; end if;
  if (select count(*) from public.challenge_rule_versions where challenge_id=v_join_challenge.id)<>2 then raise exception 'CHALLENGE_RULE_VERSION_MISSING'; end if;
  begin
    perform public.update_challenge(v_profile,v_join_challenge.id,2,'Unauthorized edit','',2,current_date,current_date+3,'UTC','{}');
    raise exception 'NON_OWNER_UPDATED_CHALLENGE';
  exception when others then
    if sqlerrm='NON_OWNER_UPDATED_CHALLENGE' then raise; end if;
  end;
  begin
    perform public.update_challenge(v_owner,v_join_challenge.id,1,'Stale edit','',2,current_date,current_date+3,'UTC','{}');
    raise exception 'STALE_CHALLENGE_VERSION_ACCEPTED';
  exception when others then
    if sqlerrm='STALE_CHALLENGE_VERSION_ACCEPTED' then raise; end if;
  end;

  v_eligibility_challenge:=public.create_challenge(v_owner,'Age-gated attendance','Eligibility fixture',1,current_date,current_date+2,'UTC','{"minimum_account_age_days":1}');
  begin
    perform public.join_challenge(v_profile,v_eligibility_challenge.id);
    raise exception 'INELIGIBLE_PROFILE_JOINED';
  exception when others then
    if sqlerrm='INELIGIBLE_PROFILE_JOINED' then raise; end if;
  end;

  v_challenge:=public.create_challenge(v_owner,'DST verified attendance','A bounded local-date challenge',1,date '2026-11-01',date '2026-11-01','America/New_York','{}');
  insert into public.challenge_members(challenge_id,profile_id) values(v_challenge.id,v_profile);

  insert into public.events(id,workspace_id,organizer_profile_id,activity_type_id,title,starts_at,ends_at,timezone,capacity,registration_closes_at,visibility,status,payment_mode,price_amount)
  values
    (v_event_inside,v_workspace,v_owner,v_activity_type,'Inside DST window',timestamptz '2026-11-02 04:30:00+00',timestamptz '2026-11-02 05:00:00+00','America/New_York',10,timestamptz '2026-11-02 04:00:00+00','public','completed','free',0),
    (v_event_outside,v_workspace,v_owner,v_activity_type,'Outside DST window',timestamptz '2026-11-02 05:30:00+00',timestamptz '2026-11-02 06:00:00+00','America/New_York',10,timestamptz '2026-11-02 05:00:00+00','public','completed','free',0);
  insert into public.event_organizers(event_id,profile_id,role) values(v_event_inside,v_owner,'owner'),(v_event_outside,v_owner,'owner');
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at)
  values(v_event_inside,v_user,'member','attended',timestamptz '2026-11-02 04:30:00+00'),(v_event_outside,v_user,'member','attended',timestamptz '2026-11-02 05:30:00+00');
  perform public.run_challenge_maintenance(100);
  v_result:=public.rebuild_challenge_progress(v_challenge.id,null,100);
  select * into v_member from public.challenge_members where challenge_id=v_challenge.id and profile_id=v_profile;
  if v_member.progress<>1 or v_member.completed_at is null then raise exception 'DST_WINDOW_OR_PROGRESS_FAILED: %',v_member.progress; end if;
  if (public.rebuild_challenge_progress(v_challenge.id,null,100)->>'processed')::integer<>1 then raise exception 'REBUILD_NOT_IDEMPOTENT'; end if;
  select id into v_participant from public.event_participants where event_id=v_event_inside and user_id=v_user;
  perform public.record_event_attendance(v_participant,v_owner,'no_show');
  perform public.rebuild_challenge_progress(v_challenge.id,null,100);
  perform public.run_challenge_maintenance(100);
  select * into v_member from public.challenge_members where challenge_id=v_challenge.id and profile_id=v_profile;
  if v_member.progress<>0 or v_member.completed_at is not null then raise exception 'CORRECTED_ATTENDANCE_STILL_COUNTED'; end if;
  if exists(select 1 from public.challenge_progress_jobs where challenge_id=v_challenge.id and profile_id=v_profile and status<>'done') then raise exception 'PROGRESS_JOB_NOT_RETRY_SAFE'; end if;

  begin
    perform public.create_challenge(v_owner,'Bad zone','invalid timezone',1,current_date,current_date,'Mars/Olympus','{}');
    raise exception 'INVALID_TIMEZONE_ACCEPTED';
  exception when others then
    if sqlerrm='INVALID_TIMEZONE_ACCEPTED' then raise; end if;
  end;
  begin
    perform public.create_challenge(v_owner,'Bad eligibility','unknown key',1,current_date,current_date,'UTC','{"minimum_followers":1}');
    raise exception 'UNKNOWN_ELIGIBILITY_ACCEPTED';
  exception when others then
    if sqlerrm='UNKNOWN_ELIGIBILITY_ACCEPTED' then raise; end if;
  end;
end $$;
rollback;
