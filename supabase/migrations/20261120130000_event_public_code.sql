create or replace function dolend_private.generate_event_public_code() returns text
language plpgsql volatile set search_path='' as $$
declare
 alphabet constant text:='23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 random_value bytea;
 generated_code text;
 byte_index integer;
begin
 random_value:=pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
 generated_code:='';
 for byte_index in 0..9 loop
  generated_code:=generated_code||pg_catalog.substr(alphabet,(pg_catalog.get_byte(random_value,byte_index)%pg_catalog.length(alphabet))+1,1);
 end loop;
 return generated_code;
end; $$;
revoke all on function dolend_private.generate_event_public_code() from public,anon,authenticated;
grant execute on function dolend_private.generate_event_public_code() to service_role;

alter table public.events add column public_code text not null default dolend_private.generate_event_public_code();
alter table public.events add constraint events_public_code_format_check
 check(public_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{10}$');
create unique index events_public_code_uidx on public.events(public_code);
