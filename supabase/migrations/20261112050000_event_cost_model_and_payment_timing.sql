begin;

alter table public.events
  add column cost_model text generated always as (
    case
      when contribution_mode = 'dynamic' then 'dynamic'
      when payment_mode = 'free' then 'free'
      else 'fixed'
    end
  ) stored not null,
  alter column payment_timing drop not null;

-- Preserve event versions and timestamps during the legacy backfill.
alter table public.events disable trigger guard_event;
alter table public.events disable trigger touch_updated_at;
update public.events
set payment_timing = nullif(payment_mode, 'free')
where contribution_mode = 'legacy'
  and payment_timing is distinct from nullif(payment_mode, 'free');
alter table public.events enable trigger touch_updated_at;
alter table public.events enable trigger guard_event;

create function dolend_private.sync_legacy_event_payment_timing()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.contribution_mode = 'legacy' then
    new.payment_timing := nullif(new.payment_mode, 'free');
  end if;
  return new;
end;
$$;

create trigger sync_legacy_event_payment_timing
before insert or update of payment_mode, contribution_mode on public.events
for each row execute function dolend_private.sync_legacy_event_payment_timing();

alter table public.events add constraint events_cost_model_payment_timing_check
check (
  (cost_model = 'free' and payment_timing is null)
  or (cost_model = 'fixed' and payment_timing is not distinct from payment_mode)
  or (cost_model = 'dynamic' and payment_timing is not null)
);

commit;
