begin;
do $$
declare
  v_owner uuid:=gen_random_uuid();
  v_viewer uuid:=gen_random_uuid();
  v_user_owner uuid:=gen_random_uuid();
  v_user_viewer uuid:=gen_random_uuid();
  v_activity uuid:=gen_random_uuid();
  v_upload text;
  v_phone_owner text:='628'||lpad(floor(random()*9999999999)::bigint::text,10,'0');
  v_phone_viewer text:='628'||lpad(floor(random()*9999999999)::bigint::text,10,'0');
  v_photo public.activity_photos;
  v_queue jsonb[];
  v_claimed text[];
begin
  v_upload:=format('activity-photos/%s/%s.png',v_owner,gen_random_uuid());
  insert into auth.users(id) values(v_owner),(v_viewer);
  insert into public.users(id,display_name,phone_normalized) values(v_user_owner,'Photo owner',v_phone_owner),(v_user_viewer,'Photo viewer',v_phone_viewer);
  insert into public.profiles(id,user_id) values(v_owner,v_user_owner),(v_viewer,v_user_viewer);
  insert into public.activities(id,author_profile_id,idempotency_key,body,visibility) values(v_activity,v_owner,'photo-test-key','Photo visibility','public');
  insert into public.private_uploads(storage_reference,purpose,owner_profile_id,content_type,size_bytes)
    values(v_upload,'activity_photo',v_owner,'image/png',100);
  v_photo:=public.attach_activity_photo(v_owner,v_activity,v_upload,'image/png',100,320,240,clock_timestamp());
  if not exists(select 1 from public.get_activity_photos(v_viewer,v_activity) as p(photo) where photo->>'id'=v_photo.id::text) then raise exception 'VISIBLE_ACTIVITY_PHOTO_MISSING'; end if;
  if (select attached_at is null or attachment_type<>'activity_photo' from public.private_uploads where storage_reference=v_upload) then raise exception 'PHOTO_UPLOAD_NOT_ATTACHED'; end if;

  perform public.report_activity_photo(v_viewer,v_activity,v_photo.id,'privacy','Synthetic location concern');
  if exists(select 1 from public.get_activity_photos(v_viewer,v_activity)) then raise exception 'REPORTED_PHOTO_NOT_HIDDEN_FROM_FEED'; end if;
  if not exists(select 1 from public.get_activity_photos(v_owner,v_activity)) then raise exception 'UPLOADER_CANNOT_REVIEW_REPORTED_PHOTO'; end if;
  begin
    perform public.activity_photo_moderation_queue(v_viewer,10);
    raise exception 'NON_MODERATOR_READ_QUEUE';
  exception when others then if sqlerrm='NON_MODERATOR_READ_QUEUE' then raise; end if; end;
  insert into public.activity_photo_moderators(profile_id) values(v_viewer);
  v_queue:=array(select public.activity_photo_moderation_queue(v_viewer,10));
  if cardinality(v_queue)<>1 or v_queue[1]->>'photo_id'<>v_photo.id::text then raise exception 'MODERATION_QUEUE_MISSING_PHOTO'; end if;
  if not public.review_activity_photo(v_viewer,v_photo.id,'hide') then raise exception 'MODERATION_HIDE_FAILED'; end if;
  if exists(select 1 from public.get_activity_photos(v_viewer,v_activity)) then raise exception 'HIDDEN_PHOTO_VISIBLE'; end if;
  if not public.review_activity_photo(v_viewer,v_photo.id,'remove') then raise exception 'MODERATION_REMOVE_FAILED'; end if;
  v_claimed:=array(select storage_reference from public.claim_expired_private_uploads(10));
  if not (v_upload=any(v_claimed)) then raise exception 'DELETED_PHOTO_NOT_QUEUED_FOR_STORAGE_CLEANUP'; end if;
end $$;
rollback;
