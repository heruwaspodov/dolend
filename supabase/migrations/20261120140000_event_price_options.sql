create table public.event_price_options (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80),
 amount bigint not null check(amount between 1 and 1000000000000),
 quota integer not null check(quota between 1 and 100000),
 sort_order integer not null default 0 check(sort_order >= 0),
 created_at timestamptz not null default now(),
 unique(event_id,id)
);
create unique index event_price_options_name_idx on public.event_price_options(event_id,lower(name));
create index event_price_options_event_idx on public.event_price_options(event_id,sort_order,id);
alter table public.event_price_options enable row level security;
revoke all on public.event_price_options from public,anon,authenticated;
grant select,insert on public.event_price_options to service_role;

alter table public.event_participants add column price_option_id uuid;
alter table public.event_participants add constraint event_participants_price_option_fk
 foreign key(event_id,price_option_id) references public.event_price_options(event_id,id);

create function dolend_private.guard_participant_price_option() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.price_option_id is not null and new.price_option_id is distinct from old.price_option_id then raise exception 'PRICE_OPTION_LOCKED'; end if;
 return new;
end; $$;
create trigger event_participants_price_option_immutable before update of price_option_id on public.event_participants
 for each row execute function dolend_private.guard_participant_price_option();

create function public.create_billed_event_with_options(
 p_actor uuid,p_workspace uuid,p_activity_type uuid,p_title text,p_description text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_registration_closes_at timestamptz,
 p_timezone text,p_capacity integer,p_visibility text,p_venue_snapshot jsonb,
 p_payment_mode text,p_price_amount bigint,p_payment_due_at timestamptz,
 p_hold_minutes integer,p_payment_method uuid,p_options jsonb
) returns public.events language plpgsql security definer set search_path='' as $$
declare e public.events; item jsonb; option_count integer:=0; quota_sum integer:=0; min_amount bigint;
begin
 if jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options) not between 2 and 20 then raise exception 'INVALID_PRICE_OPTIONS'; end if;
 for item in select value from jsonb_array_elements(p_options) loop
  if jsonb_typeof(item)<>'object' or coalesce(length(trim(item->>'name')),0) not between 1 and 80
    or coalesce(item->>'amount','') !~ '^[1-9][0-9]{0,12}$'
    or coalesce(item->>'quota','') !~ '^[1-9][0-9]{0,5}$' then raise exception 'INVALID_PRICE_OPTIONS'; end if;
  option_count:=option_count+1;
  quota_sum:=quota_sum+(item->>'quota')::integer;
  min_amount:=least(coalesce(min_amount,(item->>'amount')::bigint),(item->>'amount')::bigint);
 end loop;
 if exists(select 1 from (select lower(trim(value->>'name')) name from jsonb_array_elements(p_options)) names group by name having count(*)>1)
   or quota_sum<>p_capacity then raise exception 'INVALID_PRICE_OPTIONS'; end if;
 e:=public.create_billed_event(p_actor,p_workspace,p_activity_type,p_title,p_description,p_starts_at,p_ends_at,
  p_registration_closes_at,p_timezone,p_capacity,p_visibility,p_venue_snapshot,p_payment_mode,min_amount,
  p_payment_due_at,p_hold_minutes,p_payment_method);
 for item in select value from jsonb_array_elements(p_options) loop
  insert into public.event_price_options(event_id,name,amount,quota,sort_order)
  values(e.id,trim(item->>'name'),(item->>'amount')::bigint,(item->>'quota')::integer,
   coalesce((select max(sort_order)+1 from public.event_price_options where event_id=e.id),0));
 end loop;
 return e;
end; $$;
revoke all on function public.create_billed_event_with_options(uuid,uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,text,integer,text,jsonb,text,bigint,timestamptz,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_billed_event_with_options(uuid,uuid,uuid,text,text,timestamptz,timestamptz,timestamptz,text,integer,text,jsonb,text,bigint,timestamptz,integer,uuid,jsonb) to service_role;

create function public.join_event_with_price_option(p_event_id uuid,p_user_id uuid,p_actor_profile_id uuid,p_guest_session_hash text,p_price_option_id uuid)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare e public.events; p public.event_participants; i public.invoices; selected_option public.event_price_options;
 target_status text; hold_until timestamptz; charge_amount bigint; snapshot jsonb;
begin
 select * into strict e from public.events where id=p_event_id for update;
 perform dolend_private.assert_user(p_user_id,e.id,p_actor_profile_id,p_guest_session_hash);
 select * into p from public.event_participants where event_id=e.id and user_id=p_user_id for update;
 if p.id is not null and p.price_option_id is not null and p.price_option_id is distinct from p_price_option_id then raise exception 'PRICE_OPTION_LOCKED'; end if;
 if p.id is not null and (p.status in ('confirmed','attended','no_show') or (p.status='held' and p.hold_expires_at>clock_timestamp())) then
  if p.price_option_id is distinct from p_price_option_id then raise exception 'PRICE_OPTION_LOCKED'; end if;
  return p;
 end if;
 if e.status not in ('published','recruiting','confirmed') or clock_timestamp()>=e.registration_closes_at or clock_timestamp()>=e.starts_at then raise exception 'REGISTRATION_CLOSED'; end if;
 if e.payment_mode<>'free' and not exists(select 1 from public.event_payment_methods where event_id=e.id and enabled) then raise exception 'PAYMENT_METHOD_REQUIRED'; end if;
 if exists(select 1 from public.event_price_options where event_id=e.id) then
  if p_price_option_id is null then raise exception 'PRICE_OPTION_REQUIRED'; end if;
  select * into selected_option from public.event_price_options where id=p_price_option_id and event_id=e.id;
  if selected_option.id is null then raise exception 'INVALID_PRICE_OPTION'; end if;
  if (select count(*) from public.event_participants where event_id=e.id and price_option_id=selected_option.id
    and (status in ('confirmed','attended','no_show') or (status='held' and hold_expires_at>clock_timestamp())))>=selected_option.quota then raise exception 'PRICE_OPTION_FULL'; end if;
  charge_amount:=selected_option.amount;
  snapshot:=jsonb_build_object('amount',selected_option.amount,'currency',e.currency,'mode',e.payment_mode,'option_id',selected_option.id,'option_name',selected_option.name);
 else
  if p_price_option_id is not null then raise exception 'INVALID_PRICE_OPTION'; end if;
  charge_amount:=e.price_amount;
  snapshot:=jsonb_build_object('amount',e.price_amount,'currency',e.currency,'mode',e.payment_mode);
 end if;
 if dolend_private.occupancy(e.id,p.id)>=e.capacity then raise exception 'EVENT_FULL'; end if;
 target_status:=case when e.payment_mode='before_event' then 'held' else 'confirmed' end;
 hold_until:=least(e.starts_at,clock_timestamp()+make_interval(mins=>e.hold_minutes));
 if p.id is null then
  insert into public.event_participants(event_id,user_id,joined_as,status,hold_expires_at,confirmed_at,price_option_id)
  values(e.id,p_user_id,case when p_actor_profile_id is null then 'guest' else 'member' end,target_status,
   case when target_status='held' then hold_until end,case when target_status='confirmed' then clock_timestamp() end,p_price_option_id) returning * into p;
 else
  select * into i from public.invoices where participant_id=p.id for update;
  if i.id is not null and exists(select 1 from public.payment_ledger where invoice_id=i.id and entry_type='receipt') then raise exception 'PAID_REJOIN_REQUIRES_REVIEW'; end if;
  update public.event_participants set status=target_status,hold_expires_at=case when target_status='held' then hold_until end,
   confirmed_at=case when target_status='confirmed' then clock_timestamp() end,cancelled_at=null,cancellation_reason=null,price_option_id=p_price_option_id
   where id=p.id returning * into p;
 end if;
 if e.payment_mode<>'free' then
  insert into public.invoices(participant_id,amount_due,currency,due_at,pricing_snapshot)
  values(p.id,charge_amount,e.currency,case when e.payment_mode='before_event' then hold_until else e.payment_due_at end,snapshot)
  on conflict(participant_id) do update set status='open',due_at=excluded.due_at,amount_due=excluded.amount_due,pricing_snapshot=excluded.pricing_snapshot;
 end if;
 perform dolend_private.audit(p_actor_profile_id,'participant.join','participant',p.id);
 return p;
end; $$;
revoke all on function public.join_event_with_price_option(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.join_event_with_price_option(uuid,uuid,uuid,text,uuid) to service_role;

create or replace function public.join_event(p_event_id uuid,p_user_id uuid,p_actor_profile_id uuid default null,p_guest_session_hash text default null)
returns public.event_participants language sql security definer set search_path='' as $$
 select public.join_event_with_price_option(p_event_id,p_user_id,p_actor_profile_id,p_guest_session_hash,null);
$$;

create function public.create_guest_booking_with_price_option(p_event uuid,p_display_name text,p_phone_normalized text,p_token_hash text,p_price_option_id uuid)
returns public.event_participants language plpgsql security definer set search_path='' as $$
declare event_row public.events; domain_user public.users; participant public.event_participants;
begin
 if length(trim(p_display_name)) not between 1 and 120 then raise exception 'INVALID_GUEST_NAME'; end if;
 if p_phone_normalized !~ '^62[1-9][0-9]{6,12}$' then raise exception 'INVALID_GUEST_PHONE'; end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_GUEST_TOKEN'; end if;
 select * into strict event_row from public.events where id=p_event for update;
 if event_row.status not in ('published','recruiting','confirmed') or event_row.registration_closes_at<=clock_timestamp()
   or event_row.starts_at<=clock_timestamp() then raise exception 'EVENT_NOT_OPEN'; end if;
 insert into public.users(display_name,phone_normalized) values(trim(p_display_name),p_phone_normalized) on conflict(phone_normalized) do nothing;
 select * into strict domain_user from public.users where phone_normalized=p_phone_normalized for update;
 if domain_user.state<>'active' then raise exception 'GUEST_NOT_ACTIVE' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where user_id=domain_user.id) then
  raise exception 'GUEST_ACCOUNT_REQUIRED' using errcode='42501';
 end if;
 if exists(select 1 from public.event_participants where event_id=p_event and user_id=domain_user.id) then raise exception 'BOOKING_ALREADY_EXISTS' using errcode='23505'; end if;
 insert into public.guest_sessions(user_id,scope_event_id,token_hash,expires_at)
 values(domain_user.id,p_event,p_token_hash,greatest(event_row.ends_at+interval '30 days',clock_timestamp()+interval '24 hours'));
 participant:=public.join_event_with_price_option(p_event,domain_user.id,null,p_token_hash,p_price_option_id);
 perform dolend_private.audit(null,'guest.booking_create','event_participant',participant.id);
 return participant;
end; $$;
revoke all on function public.create_guest_booking_with_price_option(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_guest_booking_with_price_option(uuid,text,text,text,uuid) to service_role;

create or replace function public.create_guest_booking(p_event uuid,p_display_name text,p_phone_normalized text,p_token_hash text)
returns public.event_participants language sql security definer set search_path='' as $$
 select public.create_guest_booking_with_price_option(p_event,p_display_name,p_phone_normalized,p_token_hash,null);
$$;
