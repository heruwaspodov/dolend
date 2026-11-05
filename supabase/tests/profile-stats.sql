begin;
do $$
declare
  v_auth_id constant uuid := '30000000-0000-4000-8000-000000000001';
  v_user_id constant uuid := '40000000-0000-4000-8000-000000000001';
  v_activity_type uuid;
  v_event_id uuid := '50000000-0000-4000-8000-000000000001';
  v_cancelled_event_id uuid := '50000000-0000-4000-8000-000000000002';
  v_workspace_id uuid := '60000000-0000-4000-8000-000000000001';
  v_attendance_at timestamptz;
  v_event_start timestamptz;
  v_period_start date;
  values_before bigint[];
  values_after bigint[];
begin
  v_attendance_at:=clock_timestamp()-interval '10 minutes';
  v_event_start:=v_attendance_at-interval '1 day';
  v_period_start:=(v_attendance_at at time zone 'Asia/Jakarta')::date;
  insert into auth.users(id) values(v_auth_id);
  insert into public.users(id,display_name,phone_normalized) values(v_user_id,'Stats fixture','628123450991');
  insert into public.profiles(id,user_id,default_timezone) values(v_auth_id,v_user_id,'Asia/Jakarta');
  insert into public.workspaces(id,name,created_by_profile_id) values(v_workspace_id,'Stats fixture workspace',v_auth_id);
  insert into public.workspace_members(workspace_id,profile_id,role) values(v_workspace_id,v_auth_id,'owner');
  select id into strict v_activity_type from public.activity_types where active order by slug limit 1;
  insert into public.events(id,organizer_profile_id,workspace_id,activity_type_id,title,starts_at,ends_at,capacity,registration_closes_at,visibility,status)
  values(v_event_id,v_auth_id,v_workspace_id,v_activity_type,'Stats fixture event',v_event_start,v_event_start+interval '1 hour',10,v_event_start-interval '1 hour','public','completed');
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at)
  values(v_event_id,v_user_id,'member','attended',v_attendance_at);
  insert into public.events(id,organizer_profile_id,workspace_id,activity_type_id,title,starts_at,ends_at,capacity,registration_closes_at,visibility,status)
  values(v_cancelled_event_id,v_auth_id,v_workspace_id,v_activity_type,'Cancelled stats fixture',v_event_start,v_event_start+interval '1 hour',10,v_event_start-interval '1 hour','public','cancelled');
  insert into public.event_participants(event_id,user_id,joined_as,status,attendance_at)
  values(v_cancelled_event_id,v_user_id,'member','attended',v_attendance_at);
  insert into public.activities(author_profile_id,idempotency_key,body,visibility,created_at)
  values(v_auth_id,'stats-activity-001','Activity fixture','private',v_attendance_at);

  perform public.rebuild_profile_stats(v_auth_id,v_period_start,1);
  select array_agg(metric_value order by metric_key) into values_before from public.get_profile_stats(v_auth_id,v_period_start,1);
  if values_before is distinct from array[1,1]::bigint[] then raise exception 'LOCAL_DATE_STATS_FAILED: %',values_before; end if;
  if exists(select 1 from public.profile_stats where profile_id=v_auth_id and metric_key='events_attended' and metric_value<>1) then raise exception 'CANCELLED_EVENT_STATS_LEAKED'; end if;
  perform public.rebuild_profile_stats(v_auth_id,v_period_start,1);
  if (select count(*) from public.profile_stats where profile_id=v_auth_id and period_start=v_period_start and period_days=1)<>2 then raise exception 'STATS_REBUILD_NOT_IDEMPOTENT'; end if;

  update public.event_participants set status='no_show' where event_id=v_event_id and user_id=v_user_id;
  update public.activities set deleted_at=now() where author_profile_id=v_auth_id and idempotency_key='stats-activity-001';
  perform public.rebuild_profile_stats(v_auth_id,v_period_start,1);
  select array_agg(metric_value order by metric_key) into values_after from public.get_profile_stats(v_auth_id,v_period_start,1);
  if values_after is distinct from array[0,0]::bigint[] then raise exception 'STATS_CORRECTION_NOT_PROPAGATED: %',values_after; end if;
  if exists(select 1 from public.stats_metric_definitions where metric_key in ('distance_km','calories')) then raise exception 'UNSUPPORTED_METRIC_EXPOSED'; end if;
end $$;
rollback;
