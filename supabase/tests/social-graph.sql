-- Rollback-only social graph regression. Uses synthetic accounts only.
begin;
do $$
declare
  account_a uuid:=gen_random_uuid(); account_b uuid:=gen_random_uuid(); account_c uuid:=gen_random_uuid();
  user_a uuid:=gen_random_uuid(); user_b uuid:=gen_random_uuid(); user_c uuid:=gen_random_uuid();
  phone_a text:='628' || (10000000000+floor(random()*89999999999)::bigint)::text;
  phone_b text:='628' || (10000000000+floor(random()*89999999999)::bigint)::text;
  phone_c text:='628' || (10000000000+floor(random()*89999999999)::bigint)::text;
  v_status text; v_profile record; v_page_one uuid; v_page_two uuid;
begin
  insert into auth.users(id,phone,phone_confirmed_at) values
    (account_a,phone_a,now()),(account_b,phone_b,now()),(account_c,phone_c,now());
  insert into public.users(id,display_name,phone_normalized,phone_verified_at) values
    (user_a,'Social fixture A',phone_a,now()),(user_b,'Social fixture B',phone_b,now()),(user_c,'Social fixture C',phone_c,now());
  insert into public.profiles(id,user_id,is_private) values (account_a,user_a,false),(account_b,user_b,true),(account_c,user_c,false);

  v_status:=public.social_follow(account_a,account_c);
  if v_status<>'accepted' then raise exception 'PUBLIC_FOLLOW_NOT_ACCEPTED'; end if;
  if public.social_follow(account_a,account_c)<>'accepted' then raise exception 'FOLLOW_NOT_IDEMPOTENT'; end if;
  if public.social_follow(account_a,account_b)<>'pending' then raise exception 'PRIVATE_FOLLOW_NOT_PENDING'; end if;
  if exists(select 1 from public.social_profile(account_a,account_b)) then raise exception 'PRIVATE_PROFILE_LEAKED'; end if;
  if not public.social_respond_request(account_b,account_a,true) then raise exception 'FOLLOW_REQUEST_NOT_ACCEPTED'; end if;
  select * into v_profile from public.social_profile(account_a,account_b);
  if v_profile.profile_id is null or not v_profile.is_private then raise exception 'ACCEPTED_PRIVATE_PROFILE_HIDDEN'; end if;
  perform public.social_block(account_b,account_a);
  if exists(select 1 from public.social_follows where (follower_profile_id=account_a and followed_profile_id=account_b) or (follower_profile_id=account_b and followed_profile_id=account_a)) then raise exception 'BLOCK_DID_NOT_REMOVE_FOLLOW'; end if;
  if exists(select 1 from public.social_profile(account_a,account_b)) then raise exception 'BLOCKED_PROFILE_VISIBLE'; end if;
  if public.social_unblock(account_b,account_a) is not true then raise exception 'UNBLOCK_FAILED'; end if;
  perform public.social_set_privacy(account_b,false);
  if (select is_private from public.profiles where id=account_b) then raise exception 'PRIVACY_SETTING_NOT_UPDATED'; end if;
  if public.social_follow(account_a,account_b)<>'accepted' then raise exception 'PUBLIC_FOLLOW_AFTER_PRIVACY_CHANGE_FAILED'; end if;
  select profile_id into v_page_one from public.social_list(account_a,'following',1,null);
  select profile_id into v_page_two from public.social_list(account_a,'following',1,v_page_one);
  if v_page_one is null or v_page_two is null or v_page_one=v_page_two then raise exception 'SOCIAL_CURSOR_PAGINATION_FAILED'; end if;
  perform public.social_report(account_a,account_b,'other','synthetic report');
  if (select count(*) from public.social_reports where reporter_profile_id=account_a and reported_profile_id=account_b)<>1 then raise exception 'REPORT_NOT_RECORDED'; end if;
  begin
    perform public.social_follow(account_a,account_a);
    raise exception 'SELF_FOLLOW_ALLOWED';
  exception when others then
    if sqlerrm='SELF_FOLLOW_ALLOWED' then raise; end if;
  end;
end $$;
rollback;
