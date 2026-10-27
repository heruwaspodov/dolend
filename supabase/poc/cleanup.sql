-- Delete only the dedicated fixture objects/bucket using the SDK before running this.
begin;
drop policy if exists dolend_poc_storage_insert on storage.objects;
drop policy if exists dolend_poc_storage_select on storage.objects;
drop function if exists public.dolend_poc_increment(uuid);
drop table if exists public.dolend_poc_counters;
drop table if exists public.dolend_poc_webhooks;
notify pgrst, 'reload schema';
commit;
