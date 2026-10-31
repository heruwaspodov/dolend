-- Fixed-window counters are shared across Edge Function instances. Bucket keys
-- contain only server-side HMAC digests, never raw phone numbers or IP addresses.
create or replace function dolend_private.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
) returns table(current_count integer,retry_after_seconds integer)
language plpgsql security definer set search_path='' as $$
declare
  now_at timestamptz:=clock_timestamp();
  starts_at timestamptz;
begin
  if length(p_bucket_key) not between 1 and 512
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  starts_at=to_timestamp(floor(extract(epoch from now_at)/p_window_seconds)*p_window_seconds);
  insert into public.rate_limit_counters(bucket_key,window_start,count,expires_at)
  values(p_bucket_key,starts_at,1,starts_at+make_interval(secs=>p_window_seconds*2))
  on conflict(bucket_key,window_start) do update
    set count=public.rate_limit_counters.count+1,
        expires_at=excluded.expires_at
  returning public.rate_limit_counters.count into current_count;

  retry_after_seconds=greatest(1,ceil(extract(epoch from starts_at+make_interval(secs=>p_window_seconds)-now_at))::integer);
  return next;
end;
$$;

create or replace function public.consume_guest_booking_limits(
  p_event uuid,
  p_contact_hash text,
  p_ip_hash text
) returns table(allowed boolean,retry_after_seconds integer)
language plpgsql security definer set search_path='' as $$
declare
  contact_count integer;
  contact_retry integer;
  ip_count integer;
  ip_retry integer;
begin
  if p_contact_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_RATE_LIMIT_KEY';
  end if;
  if not exists(select 1 from public.events where id=p_event) then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select r.current_count,r.retry_after_seconds into contact_count,contact_retry
  from dolend_private.consume_rate_limit('guest-booking:contact:'||p_event::text||':'||p_contact_hash,5,900) r;
  select r.current_count,r.retry_after_seconds into ip_count,ip_retry
  from dolend_private.consume_rate_limit('guest-booking:ip:'||p_event::text||':'||p_ip_hash,30,900) r;

  allowed=contact_count<=5 and ip_count<=30;
  retry_after_seconds=case when allowed then 0 else greatest(contact_retry,ip_retry) end;
  return next;
end;
$$;

revoke all on function dolend_private.consume_rate_limit(text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.consume_guest_booking_limits(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_guest_booking_limits(uuid,text,text) to service_role;
