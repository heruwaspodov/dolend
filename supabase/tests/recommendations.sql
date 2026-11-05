begin;
do $$
declare
  v_actor constant uuid := '31000000-0000-4000-8000-000000000001';
  v_friend constant uuid := '31000000-0000-4000-8000-000000000002';
  v_organizer constant uuid := '31000000-0000-4000-8000-000000000003';
  v_blocked constant uuid := '31000000-0000-4000-8000-000000000004';
  v_actor_user constant uuid := '41000000-0000-4000-8000-000000000001';
  v_friend_user constant uuid := '41000000-0000-4000-8000-000000000002';
  v_organizer_user constant uuid := '41000000-0000-4000-8000-000000000003';
  v_blocked_user constant uuid := '41000000-0000-4000-8000-000000000004';
  v_workspace constant uuid := '61000000-0000-4000-8000-000000000001';
  v_blocked_workspace constant uuid := '61000000-0000-4000-8000-000000000002';
  v_activity_type uuid;
  v_generic_activity_type uuid;
  v_recommended constant uuid := '51000000-0000-4000-8000-000000000001';
  v_generic constant uuid := '51000000-0000-4000-8000-000000000002';
  v_full constant uuid := '51000000-0000-4000-8000-000000000003';
  v_blocked_event constant uuid := '51000000-0000-4000-8000-000000000004';
  v_cancelled constant uuid := '51000000-0000-4000-8000-000000000005';
  v_rows jsonb;
  v_feedback_first jsonb;
  v_feedback_retry jsonb;
  v_weekday smallint;
begin
  insert into auth.users(id) values(v_actor),(v_friend),(v_organizer),(v_blocked);
  insert into public.users(id,display_name,phone_normalized) values
    (v_actor_user,'Recommendation actor','628123450901'),
    (v_friend_user,'Recommendation friend','628123450902'),
    (v_organizer_user,'Recommendation organizer','628123450903'),
    (v_blocked_user,'Blocked organizer','628123450904');
  insert into public.profiles(id,user_id) values
    (v_actor,v_actor_user),(v_friend,v_friend_user),(v_organizer,v_organizer_user),(v_blocked,v_blocked_user);
  insert into public.workspaces(id,name,created_by_profile_id) values
    (v_workspace,'Recommendation workspace',v_organizer),
    (v_blocked_workspace,'Blocked event workspace',v_blocked);
  insert into public.workspace_members(workspace_id,profile_id,role) values
    (v_workspace,v_organizer,'owner'),(v_blocked_workspace,v_blocked,'owner');
  select id into strict v_activity_type from public.activity_types where active order by slug limit 1;
  select id into strict v_generic_activity_type from public.activity_types where active and id<>v_activity_type order by slug limit 1;
  v_weekday:=date_part('dow',(now()+interval '3 days') at time zone 'Asia/Jakarta')::smallint;
  insert into public.events(id,organizer_profile_id,workspace_id,activity_type_id,title,starts_at,ends_at,capacity,registration_closes_at,visibility,status,venue_snapshot) values
    (v_recommended,v_organizer,v_workspace,v_activity_type,'Preference match',now()+interval '3 days',now()+interval '3 days 1 hour',5,now()+interval '2 days','public','published','{"name":"Community Hall","address":"Jakarta","coarse_region_code":"ID-JK"}'),
    (v_generic,v_organizer,v_workspace,v_generic_activity_type,'Generic fallback',now()+interval '2 days',now()+interval '2 days 1 hour',5,now()+interval '1 day','public','published','{"name":"Community Hall","address":"Jakarta"}'),
    (v_full,v_organizer,v_workspace,v_activity_type,'Full event',now()+interval '2 days',now()+interval '2 days 1 hour',1,now()+interval '1 day','public','published','{"name":"Community Hall","address":"Jakarta"}'),
    (v_blocked_event,v_blocked,v_blocked_workspace,v_activity_type,'Blocked organizer event',now()+interval '2 days',now()+interval '2 days 1 hour',5,now()+interval '1 day','public','published','{"name":"Community Hall","address":"Jakarta"}'),
    (v_cancelled,v_organizer,v_workspace,v_activity_type,'Cancelled recommendation fixture',now()+interval '2 days',now()+interval '2 days 1 hour',5,now()+interval '1 day','public','cancelled','{"name":"Community Hall","address":"Jakarta"}');
  insert into public.event_participants(event_id,user_id,joined_as,status,confirmed_at) values
    (v_recommended,v_friend_user,'member','confirmed',now()),
    (v_full,v_friend_user,'member','confirmed',now());
  insert into public.social_follows(follower_profile_id,followed_profile_id,status) values(v_actor,v_friend,'accepted');
  insert into public.social_blocks(blocker_profile_id,blocked_profile_id) values(v_actor,v_blocked);

  perform public.set_recommendation_preferences(v_actor,false,true,array[v_activity_type],array[v_weekday],'id-jk');
  select jsonb_agg(jsonb_build_object('id',r.event_id,'reasons',r.reason_labels,'score',r.rank_score) order by r.rank_score desc,r.starts_at,r.event_id) into v_rows
    from public.get_event_recommendations(v_actor,20) r where r.event_id in (v_recommended,v_generic);
  if jsonb_array_length(v_rows)<>2 or v_rows->0->>'id'<>v_recommended::text or v_rows->1->>'id'<>v_generic::text then
    raise exception 'PERSONALIZED_FIXTURE_RANKING_FAILED: %',v_rows;
  end if;
  if not (v_rows @> jsonb_build_array(jsonb_build_object('id',v_recommended,'reasons',jsonb_build_array('Kategori pilihan','Area pilihan','Jadwal pilihan','Teman yang kamu ikuti juga ikut'),'score',145))) then
    raise exception 'PERSONALIZED_RECOMMENDATION_FAILED: %',v_rows;
  end if;
  if v_rows @> jsonb_build_array(jsonb_build_object('id',v_full)) or v_rows @> jsonb_build_array(jsonb_build_object('id',v_blocked_event)) then raise exception 'FULL_OR_BLOCKED_EVENT_RECOMMENDED'; end if;
  v_feedback_first:=public.record_recommendation_feedback(v_actor,v_recommended,'open',1,'rec-feedback-key-001');
  v_feedback_retry:=public.record_recommendation_feedback(v_actor,v_recommended,'open',1,'rec-feedback-key-001');
  if v_feedback_first->>'feedback_id' is distinct from v_feedback_retry->>'feedback_id' or (v_feedback_retry->>'recorded')::boolean then raise exception 'FEEDBACK_RETRY_NOT_IDEMPOTENT'; end if;
  if (select count(*) from public.recommendation_feedback_events where profile_id=v_actor and event_id=v_recommended)<>1 then raise exception 'FEEDBACK_DUPLICATED'; end if;
  begin
    perform public.record_recommendation_feedback(v_actor,v_full,'dismiss',1,'rec-feedback-full-key');
    raise exception 'FULL_EVENT_FEEDBACK_ALLOWED';
  exception when others then if sqlerrm='FULL_EVENT_FEEDBACK_ALLOWED' then raise; elsif sqlerrm<>'EVENT_NOT_RECOMMENDABLE' then raise; end if; end;
  begin
    perform public.record_recommendation_feedback(v_actor,v_cancelled,'open',1,'rec-feedback-cancelled-key');
    raise exception 'CANCELLED_EVENT_FEEDBACK_ALLOWED';
  exception when others then if sqlerrm='CANCELLED_EVENT_FEEDBACK_ALLOWED' then raise; elsif sqlerrm<>'EVENT_NOT_RECOMMENDABLE' then raise; end if; end;
  begin
    perform public.record_recommendation_feedback(v_actor,v_generic,'dismiss',1,'rec-feedback-key-001');
    raise exception 'FEEDBACK_KEY_REUSE_ALLOWED';
  exception when others then if sqlerrm='FEEDBACK_KEY_REUSE_ALLOWED' then raise; end if; end;

  perform public.set_recommendation_preferences(v_actor,true,false);
  if exists(select 1 from public.get_event_recommendations(v_actor,20)) then raise exception 'RECOMMENDATION_OPTOUT_FAILED'; end if;
  begin
    perform public.record_recommendation_feedback(v_actor,v_recommended,'dismiss',1,'rec-feedback-key-002');
    raise exception 'OPTOUT_FEEDBACK_ALLOWED';
  exception when others then if sqlerrm='OPTOUT_FEEDBACK_ALLOWED' then raise; end if; end;
  perform public.set_recommendation_preferences(v_actor,false,false);
  select jsonb_agg(r.event_id order by r.starts_at,r.event_id) into v_rows from public.get_event_recommendations(v_actor,20) r where r.event_id in (v_recommended,v_generic);
  if v_rows<>jsonb_build_array(v_generic,v_recommended) then raise exception 'NEW_USER_FALLBACK_FAILED: %',v_rows; end if;
  if exists(select 1 from public.get_event_recommendations(v_actor,20) where event_id in (v_full,v_blocked_event)) then raise exception 'FALLBACK_PRIVACY_OR_CAPACITY_FAILED'; end if;
end $$;
rollback;
