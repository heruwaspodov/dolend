create table public.recommendation_preferences (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  opted_out boolean not null default false,
  personalization_enabled boolean not null default false,
  consented_at timestamptz,
  activity_type_ids uuid[] not null default '{}',
  weekdays smallint[] not null default '{}',
  coarse_region_code text,
  updated_at timestamptz not null default now(),
  check (cardinality(activity_type_ids) <= 20),
  check (cardinality(weekdays) <= 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (coarse_region_code is null or coarse_region_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  check (not personalization_enabled or consented_at is not null),
  check (not opted_out or (not personalization_enabled and cardinality(activity_type_ids)=0 and cardinality(weekdays)=0 and coarse_region_code is null))
);
alter table public.recommendation_preferences enable row level security;
revoke all on public.recommendation_preferences from public,anon,authenticated;
grant all on public.recommendation_preferences to service_role;

create function public.get_recommendation_preferences(p_profile uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object(
    'opted_out',p.opted_out,
    'personalization_enabled',p.personalization_enabled,
    'activity_type_ids',p.activity_type_ids,
    'weekdays',p.weekdays,
    'coarse_region_code',p.coarse_region_code
  ) from public.recommendation_preferences p where p.profile_id=p_profile),
  jsonb_build_object('opted_out',false,'personalization_enabled',false,'activity_type_ids','[]'::jsonb,'weekdays','[]'::jsonb,'coarse_region_code',null));
$$;

create function public.set_recommendation_preferences(
  p_profile uuid,
  p_opted_out boolean,
  p_personalization_enabled boolean,
  p_activity_type_ids uuid[] default '{}',
  p_weekdays smallint[] default '{}',
  p_coarse_region_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_categories uuid[]; v_days smallint[]; v_region text; v_personal boolean;
begin
  if not exists(select 1 from public.profiles where id=p_profile) then raise exception 'PROFILE_NOT_FOUND'; end if;
  if p_opted_out then
    v_personal:=false; v_categories:='{}'; v_days:='{}'; v_region:=null;
  else
    v_personal:=coalesce(p_personalization_enabled,false);
    v_categories:=case when v_personal then coalesce(p_activity_type_ids,'{}') else '{}' end;
    v_days:=case when v_personal then coalesce(p_weekdays,'{}') else '{}' end;
    v_region:=case when v_personal then nullif(upper(trim(p_coarse_region_code)),'') else null end;
    if cardinality(v_categories)>20 or cardinality(v_categories)<>(select count(distinct x) from unnest(v_categories) x) then raise exception 'INVALID_RECOMMENDATION_PREFERENCES'; end if;
    if exists(select 1 from unnest(v_categories) x left join public.activity_types a on a.id=x and a.active where a.id is null) then raise exception 'INVALID_RECOMMENDATION_PREFERENCES'; end if;
    if cardinality(v_days)>7 or exists(select 1 from unnest(v_days) d where d<0 or d>6) then raise exception 'INVALID_RECOMMENDATION_PREFERENCES'; end if;
    if v_region is not null and v_region !~ '^[A-Z0-9][A-Z0-9_-]{1,31}$' then raise exception 'INVALID_RECOMMENDATION_PREFERENCES'; end if;
  end if;
  insert into public.recommendation_preferences(profile_id,opted_out,personalization_enabled,consented_at,activity_type_ids,weekdays,coarse_region_code,updated_at)
  values(p_profile,p_opted_out,v_personal,case when v_personal then clock_timestamp() else null end,v_categories,v_days,v_region,clock_timestamp())
  on conflict(profile_id) do update set opted_out=excluded.opted_out,personalization_enabled=excluded.personalization_enabled,
    consented_at=excluded.consented_at,activity_type_ids=excluded.activity_type_ids,weekdays=excluded.weekdays,
    coarse_region_code=excluded.coarse_region_code,updated_at=excluded.updated_at;
  return public.get_recommendation_preferences(p_profile);
end; $$;

create function public.get_event_recommendations(p_profile uuid,p_limit integer default 20)
returns table(event_id uuid,title text,activity_type_name text,starts_at timestamptz,reason_labels text[],rank_score integer,capacity_remaining integer,ranking_version integer)
language sql stable security definer set search_path='' as $$
  with actor as (
    select p.id,p.user_id from public.profiles p where p.id=p_profile
  ), pref as (
    select coalesce(r.opted_out,false) opted_out,coalesce(r.personalization_enabled,false) personalization_enabled,
      coalesce(r.activity_type_ids,'{}'::uuid[]) activity_type_ids,coalesce(r.weekdays,'{}'::smallint[]) weekdays,r.coarse_region_code
    from actor a left join public.recommendation_preferences r on r.profile_id=a.id
  ), candidates as (
    select e.id,e.title,at.name activity_type_name,e.starts_at,e.id order_id,
      case when exists(select 1 from actor a join public.profiles friend_profile on friend_profile.id<>a.id
        join public.social_follows f on f.follower_profile_id=a.id and f.followed_profile_id=friend_profile.id and f.status='accepted'
        join public.event_participants friend_join on friend_join.user_id=friend_profile.user_id and friend_join.event_id=e.id and friend_join.status in ('confirmed','attended')
        where not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=a.id and b.blocked_profile_id=friend_profile.id) or (b.blocker_profile_id=friend_profile.id and b.blocked_profile_id=a.id))) then 1 else 0 end friend_match,
      exists(select 1 from pref p where p.personalization_enabled and e.activity_type_id=any(p.activity_type_ids)) category_match,
      exists(select 1 from pref p where p.personalization_enabled and date_part('dow',e.starts_at at time zone e.timezone)::smallint=any(p.weekdays)) weekday_match,
      exists(select 1 from pref p where p.personalization_enabled and p.coarse_region_code is not null and e.venue_snapshot->>'coarse_region_code'=p.coarse_region_code) region_match,
      greatest(e.capacity - (select count(*)::integer from public.event_participants ep where ep.event_id=e.id and (ep.status='confirmed' or (ep.status='held' and ep.hold_expires_at>clock_timestamp()))),0) remaining
    from public.events e
    join public.activity_types at on at.id=e.activity_type_id
    cross join actor a
    where e.status='published' and e.visibility='public' and e.starts_at>clock_timestamp() and e.registration_closes_at>clock_timestamp()
      and not exists(select 1 from public.event_participants own_join where own_join.event_id=e.id and own_join.user_id=a.user_id and own_join.status in ('held','confirmed','attended','no_show'))
      and not exists(select 1 from public.social_blocks b where (b.blocker_profile_id=a.id and b.blocked_profile_id=e.organizer_profile_id) or (b.blocker_profile_id=e.organizer_profile_id and b.blocked_profile_id=a.id))
  ), ranked as (
    select c.*,(case when (select personalization_enabled from pref) then
        (case when c.category_match then 100 else 0 end)+(case when c.region_match then 20 else 0 end)+(case when c.weekday_match then 10 else 0 end)+(case when c.friend_match=1 then 15 else 0 end)
      else 0 end)::integer score,
      array_remove(array[
        case when c.category_match then 'Kategori pilihan' end,
        case when c.region_match then 'Area pilihan' end,
        case when c.weekday_match then 'Jadwal pilihan' end,
        case when c.friend_match=1 then 'Teman yang kamu ikuti juga ikut' end
      ],null)::text[] reasons
    from candidates c cross join pref p where not p.opted_out and c.remaining>0
  )
  select r.id,r.title,r.activity_type_name,r.starts_at,
    case when cardinality(r.reasons)=0 then array['Acara publik mendatang']::text[] else r.reasons end,
    r.score,r.remaining,1
  from ranked r
  order by r.score desc,r.starts_at asc,r.order_id asc
  limit least(greatest(p_limit,1),50);
$$;

revoke all on function public.get_recommendation_preferences(uuid),public.set_recommendation_preferences(uuid,boolean,boolean,uuid[],smallint[],text),public.get_event_recommendations(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_recommendation_preferences(uuid),public.set_recommendation_preferences(uuid,boolean,boolean,uuid[],smallint[],text),public.get_event_recommendations(uuid,integer) to service_role;
