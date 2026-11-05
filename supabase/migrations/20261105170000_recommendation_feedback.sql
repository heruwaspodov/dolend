create table public.recommendation_feedback_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  ranking_version integer not null check (ranking_version > 0),
  action text not null check (action in ('open','dismiss')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default now(),
  unique(profile_id,idempotency_key)
);
create index recommendation_feedback_event_idx on public.recommendation_feedback_events(event_id,ranking_version,action);
alter table public.recommendation_feedback_events enable row level security;
revoke all on public.recommendation_feedback_events from public,anon,authenticated;
grant all on public.recommendation_feedback_events to service_role;

create function public.record_recommendation_feedback(
  p_profile uuid,p_event uuid,p_action text,p_ranking_version integer,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.recommendation_feedback_events;
begin
  if p_action not in ('open','dismiss') or p_ranking_version<>1 or length(p_idempotency_key) not between 8 and 128 then
    raise exception 'INVALID_RECOMMENDATION_FEEDBACK';
  end if;
  if not exists(select 1 from public.profiles where id=p_profile) then raise exception 'PROFILE_NOT_FOUND'; end if;
  if exists(select 1 from public.recommendation_preferences where profile_id=p_profile and opted_out) then raise exception 'RECOMMENDATION_OPTOUT'; end if;
  if not exists(select 1 from public.get_event_recommendations(p_profile,50) r where r.event_id=p_event) then raise exception 'EVENT_NOT_RECOMMENDABLE'; end if;

  insert into public.recommendation_feedback_events(profile_id,event_id,action,ranking_version,idempotency_key)
  values(p_profile,p_event,p_action,p_ranking_version,p_idempotency_key)
  on conflict(profile_id,idempotency_key) do nothing returning * into v_row;
  if not found then
    select * into strict v_row from public.recommendation_feedback_events where profile_id=p_profile and idempotency_key=p_idempotency_key;
    if v_row.event_id<>p_event or v_row.action<>p_action or v_row.ranking_version<>p_ranking_version then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return jsonb_build_object('feedback_id',v_row.id,'recorded',false);
  end if;
  return jsonb_build_object('feedback_id',v_row.id,'recorded',true);
end; $$;

revoke all on function public.record_recommendation_feedback(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_recommendation_feedback(uuid,uuid,text,integer,text) to service_role;
