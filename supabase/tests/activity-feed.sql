begin;
do $$
declare
  v_actor constant uuid := '10000000-0000-4000-8000-000000000001';
  v_author constant uuid := '10000000-0000-4000-8000-000000000002';
  v_private constant uuid := '10000000-0000-4000-8000-000000000003';
  v_blocked constant uuid := '10000000-0000-4000-8000-000000000004';
  v_key constant text := 'activity-feed-retry-fixture';
  v_first jsonb;
  v_retry jsonb;
  v_rows jsonb[];
begin
  insert into auth.users(id) values(v_actor),(v_author),(v_private),(v_blocked);
  insert into public.users(id,display_name,phone_normalized) values
    ('20000000-0000-4000-8000-000000000001','Feed viewer','628123450001'),
    ('20000000-0000-4000-8000-000000000002','Feed author','628123450002'),
    ('20000000-0000-4000-8000-000000000003','Private author','628123450003'),
    ('20000000-0000-4000-8000-000000000004','Blocked author','628123450004');
  insert into public.profiles(id,user_id) values
    (v_actor,'20000000-0000-4000-8000-000000000001'),
    (v_author,'20000000-0000-4000-8000-000000000002'),
    (v_private,'20000000-0000-4000-8000-000000000003'),
    (v_blocked,'20000000-0000-4000-8000-000000000004');
  update public.profiles set is_private=true where id=v_private;
  insert into public.social_follows(follower_profile_id,followed_profile_id,status) values(v_actor,v_author,'accepted');
  insert into public.social_blocks(blocker_profile_id,blocked_profile_id) values(v_actor,v_blocked);

  v_first := public.publish_activity(v_author,v_key,'feed dedupe fixture','public');
  v_retry := public.publish_activity(v_author,v_key,'different retry payload','public');
  if v_first->>'id' is distinct from v_retry->>'id' then raise exception 'IDEMPOTENCY_FAILED'; end if;
  perform public.publish_activity(v_private,'private-feed-fixture','private profile fixture','public');
  perform public.publish_activity(v_blocked,'blocked-feed-fixture','blocked profile fixture','public');
  perform public.publish_activity(v_author,'private-item-fixture','private visibility fixture','private');
  v_rows := array(select public.get_activity_feed(v_actor,null,null,50));
  if cardinality(v_rows) <> 1 then raise exception 'FEED_PRIVACY_FAILED: expected accepted follower post only, got %',cardinality(v_rows); end if;
  if v_rows[1]->>'author_profile_id' <> v_author::text then raise exception 'FEED_WRONG_AUTHOR'; end if;

  perform public.delete_activity(v_author,(v_first->>'id')::uuid);
  if exists(select 1 from public.get_activity_feed(v_actor,null,null,50)) then raise exception 'DELETED_ACTIVITY_VISIBLE'; end if;
end $$;
rollback;
