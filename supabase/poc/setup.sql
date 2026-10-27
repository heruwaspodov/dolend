-- Temporary compatibility fixtures only; not business migrations.
begin;
create table public.dolend_poc_counters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  value integer not null default 0 check (value >= 0),
  primary key (owner_id, run_id)
);
alter table public.dolend_poc_counters enable row level security;
revoke all on public.dolend_poc_counters from anon, authenticated;
grant select, insert, update on public.dolend_poc_counters to authenticated;
create policy dolend_poc_owner on public.dolend_poc_counters
  to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create function public.dolend_poc_increment(p_run_id uuid) returns integer
language sql security invoker set search_path = '' as $$
  insert into public.dolend_poc_counters(owner_id, run_id, value)
  values(auth.uid(), p_run_id, 1)
  on conflict(owner_id, run_id) do update set value = public.dolend_poc_counters.value + 1
  returning value;
$$;
revoke all on function public.dolend_poc_increment(uuid) from public, anon;
grant execute on function public.dolend_poc_increment(uuid) to authenticated;

create table public.dolend_poc_webhooks (
  event_id uuid primary key,
  payload_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.dolend_poc_webhooks enable row level security;
revoke all on public.dolend_poc_webhooks from anon, authenticated;
grant all on public.dolend_poc_webhooks to service_role;

create policy dolend_poc_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dolend-compat-poc' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy dolend_poc_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'dolend-compat-poc' and (storage.foldername(name))[1] = (select auth.uid())::text);
notify pgrst, 'reload schema';
commit;
