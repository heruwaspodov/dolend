alter table public.private_uploads drop constraint private_uploads_purpose_check;
alter table public.private_uploads add constraint private_uploads_purpose_check
  check(purpose in ('qris','payment_proof','activity_photo'));
alter table public.private_uploads drop constraint private_uploads_attachment_type_check;
alter table public.private_uploads add constraint private_uploads_attachment_type_check
  check(attachment_type is null or attachment_type in ('organizer_payment_method','manual_payment_record','activity_photo'));
alter table public.private_uploads drop constraint private_uploads_storage_reference_check;
alter table public.private_uploads add constraint private_uploads_storage_reference_check
  check(storage_reference ~ '^(s3:|supabase:)?(qris|proof|activity-photos)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg)$');
alter table public.private_uploads drop constraint private_uploads_check1;
alter table public.private_uploads add constraint private_uploads_purpose_charge_check
  check((purpose='qris' and charge_id is null) or (purpose='payment_proof' and charge_id is not null) or (purpose='activity_photo' and charge_id is null));

create table public.activity_photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  uploader_profile_id uuid not null references public.profiles(id) on delete restrict,
  storage_reference text unique references public.private_uploads(storage_reference) on delete set null,
  content_type text not null check(content_type in ('image/png','image/jpeg')),
  size_bytes integer not null check(size_bytes between 1 and 2097152),
  width integer not null check(width between 1 and 8192),
  height integer not null check(height between 1 and 8192),
  consented_at timestamptz not null,
  moderation_status text not null default 'visible' check(moderation_status in ('visible','reported','hidden','removed')),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index activity_photos_activity_idx on public.activity_photos(activity_id,created_at,id)
  where deleted_at is null and moderation_status='visible';
create index activity_photos_moderation_idx on public.activity_photos(created_at,id)
  where deleted_at is null and moderation_status='reported';
alter table public.activity_photos enable row level security;
revoke all on public.activity_photos from public,anon,authenticated;
grant all on public.activity_photos to service_role;

create table public.activity_photo_reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.activity_photos(id) on delete restrict,
  reporter_profile_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check(reason in ('privacy','unsafe','spam','copyright','other')),
  details text not null default '' check(length(details)<=500),
  status text not null default 'pending' check(status in ('pending','dismissed','actioned')),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete restrict,
  unique(photo_id,reporter_profile_id)
);
create index activity_photo_reports_queue_idx on public.activity_photo_reports(created_at,id) where status='pending';
alter table public.activity_photo_reports enable row level security;
revoke all on public.activity_photo_reports from public,anon,authenticated;
grant all on public.activity_photo_reports to service_role;

create table public.activity_photo_moderators (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default clock_timestamp(),
  granted_by uuid references public.profiles(id) on delete restrict
);
alter table public.activity_photo_moderators enable row level security;
revoke all on public.activity_photo_moderators from public,anon,authenticated;
grant all on public.activity_photo_moderators to service_role;

create or replace function public.can_view_activity(p_actor uuid,p_activity uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.activities a join public.profiles p on p.id=a.author_profile_id
  left join public.communities c on c.id=a.community_id
  where a.id=p_activity and a.deleted_at is null
   and not exists(select 1 from public.social_blocks b where
    (b.blocker_profile_id=p_actor and b.blocked_profile_id=a.author_profile_id) or
    (b.blocker_profile_id=a.author_profile_id and b.blocked_profile_id=p_actor))
   and (a.author_profile_id=p_actor
    or (a.visibility='public' and not p.is_private)
    or (a.visibility in ('public','followers') and exists(select 1 from public.social_follows f where f.follower_profile_id=p_actor and f.followed_profile_id=a.author_profile_id and f.status='accepted'))
    or (a.visibility='community' and exists(select 1 from public.community_members m where m.community_id=a.community_id and m.profile_id=p_actor and m.status='active')))
   and (a.visibility<>'community' or c.visibility='public' or exists(select 1 from public.community_members m where m.community_id=c.id and m.profile_id=p_actor and m.status='active'))
 );
$$;

create function public.attach_activity_photo(p_actor uuid,p_activity uuid,p_upload text,p_content_type text,p_size integer,p_width integer,p_height integer,p_consented_at timestamptz)
returns public.activity_photos language plpgsql security definer set search_path='' as $$
declare v_activity public.activities; v_upload public.private_uploads; v_photo public.activity_photos;
begin
 select * into v_activity from public.activities where id=p_activity and deleted_at is null for update;
 if not found or v_activity.author_profile_id<>p_actor then raise exception 'ACTIVITY_PHOTO_FORBIDDEN' using errcode='42501'; end if;
 if p_consented_at is null or p_content_type not in ('image/png','image/jpeg') or p_size not between 1 and 2097152
  or p_width not between 1 and 8192 or p_height not between 1 and 8192 then raise exception 'INVALID_ACTIVITY_PHOTO'; end if;
 if (select count(*) from public.activity_photos where activity_id=p_activity and deleted_at is null and moderation_status<>'removed')>=5 then raise exception 'ACTIVITY_PHOTO_LIMIT'; end if;
 select * into v_upload from public.private_uploads where storage_reference=p_upload and purpose='activity_photo'
  and owner_profile_id=p_actor and attached_at is null and cleanup_started_at is null and expires_at>clock_timestamp() for update;
 if v_upload.storage_reference is null or v_upload.content_type<>p_content_type or v_upload.size_bytes<>p_size then raise exception 'INVALID_ACTIVITY_PHOTO'; end if;
 insert into public.activity_photos(activity_id,uploader_profile_id,storage_reference,content_type,size_bytes,width,height,consented_at)
 values(p_activity,p_actor,p_upload,p_content_type,p_size,p_width,p_height,p_consented_at) returning * into v_photo;
 update public.private_uploads set attached_at=clock_timestamp(),attachment_type='activity_photo',attachment_id=v_photo.id where storage_reference=p_upload;
 return v_photo;
end; $$;

create function public.get_activity_photos(p_actor uuid,p_activity uuid)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'activity_id',p.activity_id,'uploader_profile_id',p.uploader_profile_id,
  'storage_reference',p.storage_reference,'content_type',p.content_type,'size_bytes',p.size_bytes,
  'width',p.width,'height',p.height,'moderation_status',p.moderation_status,'created_at',p.created_at)
 from public.activity_photos p where p.activity_id=p_activity and p.deleted_at is null
  and (p.moderation_status='visible' or p.uploader_profile_id=p_actor)
  and public.can_view_activity(p_actor,p_activity)
 order by p.created_at,p.id;
$$;

create function public.delete_activity_photo(p_actor uuid,p_activity uuid,p_photo uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.activity_photos set deleted_at=coalesce(deleted_at,clock_timestamp()),moderation_status='removed'
 where id=p_photo and activity_id=p_activity and uploader_profile_id=p_actor and deleted_at is null;
 return found;
end; $$;

create function public.report_activity_photo(p_actor uuid,p_activity uuid,p_photo uuid,p_reason text,p_details text default '')
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_reason not in ('privacy','unsafe','spam','copyright','other') or length(p_details)>500 then raise exception 'INVALID_ACTIVITY_PHOTO_REPORT'; end if;
 if not exists(select 1 from public.activity_photos where id=p_photo and activity_id=p_activity and deleted_at is null and public.can_view_activity(p_actor,p_activity)) then return false; end if;
 insert into public.activity_photo_reports(photo_id,reporter_profile_id,reason,details)
 values(p_photo,p_actor,p_reason,trim(p_details)) on conflict(photo_id,reporter_profile_id) do nothing;
 update public.activity_photos set moderation_status='reported' where id=p_photo and moderation_status='visible';
 return true;
end; $$;

create function public.activity_photo_moderation_queue(p_actor uuid,p_limit integer default 50)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.activity_photo_moderators where profile_id=p_actor) then raise exception 'ACTIVITY_PHOTO_MODERATOR_REQUIRED' using errcode='42501'; end if;
 if p_limit not between 1 and 100 then raise exception 'INVALID_ACTIVITY_PHOTO_LIMIT'; end if;
 return query select jsonb_build_object('photo_id',p.id,'activity_id',p.activity_id,'uploader_profile_id',p.uploader_profile_id,
  'storage_reference',p.storage_reference,'content_type',p.content_type,'size_bytes',p.size_bytes,'width',p.width,'height',p.height,'created_at',p.created_at,
  'reports',(select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'details',r.details,'created_at',r.created_at) order by r.created_at),'[]'::jsonb) from public.activity_photo_reports r where r.photo_id=p.id and r.status='pending'))
 from public.activity_photos p where p.moderation_status='reported' and p.deleted_at is null order by p.created_at,p.id limit p_limit;
end; $$;

create function public.review_activity_photo(p_actor uuid,p_photo uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_moderator boolean;
begin
 select exists(select 1 from public.activity_photo_moderators where profile_id=p_actor) into v_moderator;
 if not v_moderator then raise exception 'ACTIVITY_PHOTO_MODERATOR_REQUIRED' using errcode='42501'; end if;
 if p_action not in ('dismiss','hide','remove') then raise exception 'INVALID_ACTIVITY_PHOTO_ACTION'; end if;
 update public.activity_photos set moderation_status=case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'visible' end,
  deleted_at=case when p_action='remove' then coalesce(deleted_at,clock_timestamp()) else deleted_at end
 where id=p_photo and deleted_at is null;
 if not found then return false; end if;
 update public.activity_photo_reports set status=case when p_action='dismiss' then 'dismissed' else 'actioned' end,
  reviewed_at=clock_timestamp(),reviewed_by_profile_id=p_actor where photo_id=p_photo and status='pending';
 return true;
end; $$;

-- Deleted activity/photo objects are claimed by the existing bounded cleanup worker.
create or replace function public.claim_expired_private_uploads(p_limit integer default 100)
returns setof public.private_uploads language plpgsql security definer set search_path='' as $$
begin
 if p_limit not between 1 and 500 then raise exception 'INVALID_CLEANUP_LIMIT'; end if;
 return query with candidates as (
  select u.storage_reference from public.private_uploads u
  left join public.activity_photos p on p.id=u.attachment_id and u.attachment_type='activity_photo'
  left join public.activities a on a.id=p.activity_id
  where ((u.attached_at is null and u.expires_at<=clock_timestamp())
    or (u.purpose='activity_photo' and (p.deleted_at is not null or a.deleted_at is not null)))
   and (u.cleanup_started_at is null or u.cleanup_started_at<clock_timestamp()-interval '15 minutes')
  order by u.expires_at for update of u skip locked limit p_limit
 ) update public.private_uploads u set cleanup_started_at=clock_timestamp(),cleanup_attempts=u.cleanup_attempts+1
 from candidates c where c.storage_reference=u.storage_reference returning u.*;
end; $$;

revoke all on function public.can_view_activity(uuid,uuid),public.attach_activity_photo(uuid,uuid,text,text,integer,integer,integer,timestamptz),public.get_activity_photos(uuid,uuid),public.delete_activity_photo(uuid,uuid,uuid),public.report_activity_photo(uuid,uuid,uuid,text,text),public.activity_photo_moderation_queue(uuid,integer),public.review_activity_photo(uuid,uuid,text),public.claim_expired_private_uploads(integer) from public,anon,authenticated;
grant execute on function public.can_view_activity(uuid,uuid),public.attach_activity_photo(uuid,uuid,text,text,integer,integer,integer,timestamptz),public.get_activity_photos(uuid,uuid),public.delete_activity_photo(uuid,uuid,uuid),public.report_activity_photo(uuid,uuid,uuid,text,text),public.activity_photo_moderation_queue(uuid,integer),public.review_activity_photo(uuid,uuid,text),public.claim_expired_private_uploads(integer) to service_role;
