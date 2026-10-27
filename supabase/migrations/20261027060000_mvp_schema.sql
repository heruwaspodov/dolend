-- Dolend MVP schema. No business rows or external provider credentials are seeded.
create schema dolend_private;
revoke all on schema dolend_private from public;
grant usage on schema dolend_private to authenticated, service_role;
create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  phone_normalized text not null unique check (phone_normalized ~ '^62[1-9][0-9]{6,12}$'),
  phone_verified_at timestamptz,
  state text not null default 'active' check (state in ('active','suspended','anonymized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.people enable row level security;
revoke all on public.people from anon, authenticated;
grant all on public.people to service_role;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  person_id uuid not null unique references public.people(id) on delete restrict,
  avatar_path text, bio text check (length(bio)<=1000), default_timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;
create table public.verification_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text not null check (phone_normalized ~ '^62[1-9][0-9]{6,12}$'),
  auth_user_id uuid references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('signup','guest_join','claim','change_phone')),
  provider_ref text, secret_hash text, attempts integer not null default 0 check (attempts>=0),
  verified_at timestamptz, expires_at timestamptz not null, consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.verification_challenges enable row level security;
revoke all on public.verification_challenges from anon, authenticated;
grant all on public.verification_challenges to service_role;
create table public.identity_claims (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  challenge_id uuid not null unique references public.verification_challenges(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','resolved','rejected')),
  expires_at timestamptz not null, resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.identity_claims enable row level security;
revoke all on public.identity_claims from anon, authenticated;
grant all on public.identity_claims to service_role;
create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]*$'), name text not null, active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.activity_types enable row level security;
revoke all on public.activity_types from anon, authenticated;
grant all on public.activity_types to service_role;
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null, address text not null, city text not null,
  latitude numeric check (latitude between -90 and 90), longitude numeric check (longitude between -180 and 180),
  maps_url text not null check (maps_url ~ '^https://'), place_id text,
  check ((latitude is null) = (longitude is null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venues enable row level security;
revoke all on public.venues from anon, authenticated;
grant all on public.venues to service_role;
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_profile_id uuid not null references public.profiles(id) on delete restrict,
  activity_type_id uuid not null references public.activity_types(id) on delete restrict,
  venue_id uuid references public.venues(id) on delete restrict,
  venue_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(venue_snapshot)='object'),
  title text not null check (length(trim(title)) between 1 and 200), description text not null default '' check (length(description)<=10000),
  starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null default 'Asia/Jakarta',
  capacity integer not null check (capacity between 1 and 100000), registration_closes_at timestamptz not null,
  visibility text not null default 'unlisted' check (visibility in ('public','unlisted')),
  status text not null default 'draft' check (status in ('draft','published','completed','cancelled')),
  payment_mode text not null default 'free' check (payment_mode in ('free','before_event','after_event')),
  price_amount bigint not null default 0 check (price_amount between 0 and 1000000000000), currency text not null default 'IDR' check (currency='IDR'),
  payment_due_at timestamptz, hold_minutes integer not null default 15 check (hold_minutes between 1 and 1440),
  manual_review_minutes integer not null default 1440 check (manual_review_minutes between 1 and 10080),
  cancellation_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(cancellation_policy)='object'),
  version integer not null default 1 check (version>0),
  check (ends_at>starts_at), check (registration_closes_at<=starts_at),
  check ((payment_mode='free' and price_amount=0) or (payment_mode<>'free' and price_amount>0)),
  check (payment_mode<>'after_event' or (payment_due_at is not null and payment_due_at>=ends_at)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant all on public.events to service_role;
create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  scope_event_id uuid not null references public.events(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  scope text not null default 'participation' check (scope='participation'), expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guest_sessions enable row level security;
revoke all on public.guest_sessions from anon, authenticated;
grant all on public.guest_sessions to service_role;
create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz, revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_invites enable row level security;
revoke all on public.event_invites from anon, authenticated;
grant all on public.event_invites to service_role;
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  joined_as text not null check (joined_as in ('guest','member')),
  status text not null check (status in ('held','confirmed','attended','no_show','expired','cancelled')),
  hold_expires_at timestamptz, confirmed_at timestamptz, attendance_at timestamptz, cancelled_at timestamptz, cancellation_reason text,
  unique(event_id,person_id), check (status<>'held' or hold_expires_at is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_participants enable row level security;
revoke all on public.event_participants from anon, authenticated;
grant all on public.event_participants to service_role;
create table public.participant_history (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.event_participants(id) on delete restrict,
  from_status text, to_status text not null, reason text,
  actor_type text not null default 'system', actor_id uuid,
  created_at timestamptz not null default now()
);
alter table public.participant_history enable row level security;
revoke all on public.participant_history from anon, authenticated;
grant select, insert on public.participant_history to service_role;
create table public.event_payment_methods (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  method_type text not null check (method_type in ('manual_bank_transfer','qris','gateway')),
  provider text, provider_method text, enabled boolean not null default true,
  instruction_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(instruction_snapshot)='object'),
  check (method_type='manual_bank_transfer' or (provider is not null and provider_method is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_payment_methods enable row level security;
revoke all on public.event_payment_methods from anon, authenticated;
grant all on public.event_payment_methods to service_role;
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.event_participants(id) on delete restrict,
  invoice_number text not null unique default ('DL-' || gen_random_uuid()::text),
  amount_due bigint not null check (amount_due between 1 and 1000000000000), currency text not null default 'IDR' check (currency='IDR'),
  due_at timestamptz not null, status text not null default 'open' check (status in ('open','paid','void','waived')),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot)='object'), waiver_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant all on public.invoices to service_role;
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_method_id uuid not null references public.event_payment_methods(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  method_type text not null check (method_type in ('manual_bank_transfer','qris','gateway')),
  provider text, provider_reference text, amount bigint not null check (amount between 1 and 1000000000000), currency text not null default 'IDR' check (currency='IDR'),
  status text not null default 'created' check (status in ('created','pending','pending_review','succeeded','failed','expired','rejected')),
  expires_at timestamptz, review_deadline timestamptz, idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  checkout_url text, reviewed_by uuid references public.profiles(id) on delete restrict, review_reason text,
  exception_reason text, unique(invoice_id,idempotency_key),
  unique(provider,provider_reference), check (status<>'pending_review' or review_deadline is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;
grant all on public.payment_attempts to service_role;
create table public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  storage_path text not null unique, mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  submitted_by uuid not null references public.people(id) on delete restrict, reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_evidence enable row level security;
revoke all on public.payment_evidence from anon, authenticated;
grant all on public.payment_evidence to service_role;
create table public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  attempt_id uuid references public.payment_attempts(id) on delete restrict,
  entry_type text not null check (entry_type in ('receipt','refund','adjustment')),
  amount bigint not null check (amount between 1 and 1000000000000), currency text not null default 'IDR' check (currency='IDR'),
  source_reference text not null unique, occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.payment_ledger enable row level security;
revoke all on public.payment_ledger from anon, authenticated;
grant select, insert on public.payment_ledger to service_role;
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  amount bigint not null check (amount between 1 and 1000000000000), status text not null default 'requested' check (status in ('requested','processing','succeeded','failed')),
  reason text not null, provider_reference text unique, evidence_path text,
  approved_by uuid references public.profiles(id) on delete restrict, idempotency_key text not null,
  unique(invoice_id,idempotency_key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.refunds enable row level security;
revoke all on public.refunds from anon, authenticated;
grant all on public.refunds to service_role;
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null, external_event_id text not null, payload_hash text not null,
  payload_private jsonb, processed_at timestamptz, status text not null default 'pending' check (status in ('pending','processed','failed','quarantined')),
  retry_count integer not null default 0 check (retry_count>=0), unique(provider,external_event_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events to service_role;
create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_scope text not null, route text not null, key text not null, request_hash text not null,
  response jsonb not null, expires_at timestamptz not null, unique(actor_scope,route,key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.idempotency_records enable row level security;
revoke all on public.idempotency_records from anon, authenticated;
grant all on public.idempotency_records to service_role;
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null, actor_id uuid, action text not null,
  entity_type text not null, entity_id uuid not null, redacted_changes jsonb not null default '{}'::jsonb, request_id text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select, insert on public.audit_logs to service_role;
create table public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null, aggregate_id uuid not null, dedupe_key text not null unique, payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts>=0), next_attempt_at timestamptz not null default now(), locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outbox_jobs enable row level security;
revoke all on public.outbox_jobs from anon, authenticated;
grant all on public.outbox_jobs to service_role;
create table public.rate_limit_counters (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null, window_start timestamptz not null, count integer not null check (count>=0), expires_at timestamptz not null,
  unique(bucket_key,window_start),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from anon, authenticated;
grant all on public.rate_limit_counters to service_role;
create function dolend_private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end; $$;
revoke all on function dolend_private.touch_updated_at() from public;
create trigger touch_updated_at before update on public.people for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.profiles for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.verification_challenges for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.identity_claims for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.activity_types for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.venues for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.events for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.guest_sessions for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.event_invites for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.event_participants for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.event_payment_methods for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.invoices for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.payment_attempts for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.payment_evidence for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.refunds for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.webhook_events for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.idempotency_records for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.outbox_jobs for each row execute function dolend_private.touch_updated_at();
create trigger touch_updated_at before update on public.rate_limit_counters for each row execute function dolend_private.touch_updated_at();
create index profiles_person_id_idx on public.profiles(person_id);
create index verification_challenges_auth_user_id_idx on public.verification_challenges(auth_user_id);
create index identity_claims_person_id_idx on public.identity_claims(person_id);
create index identity_claims_auth_user_id_idx on public.identity_claims(auth_user_id);
create index identity_claims_challenge_id_idx on public.identity_claims(challenge_id);
create index venues_created_by_idx on public.venues(created_by);
create index events_organizer_profile_id_idx on public.events(organizer_profile_id);
create index events_activity_type_id_idx on public.events(activity_type_id);
create index events_venue_id_idx on public.events(venue_id);
create index guest_sessions_person_id_idx on public.guest_sessions(person_id);
create index guest_sessions_scope_event_id_idx on public.guest_sessions(scope_event_id);
create index event_invites_event_id_idx on public.event_invites(event_id);
create index event_invites_created_by_idx on public.event_invites(created_by);
create index event_participants_event_id_idx on public.event_participants(event_id);
create index event_participants_person_id_idx on public.event_participants(person_id);
create index participant_history_participant_id_idx on public.participant_history(participant_id);
create index event_payment_methods_event_id_idx on public.event_payment_methods(event_id);
create index invoices_participant_id_idx on public.invoices(participant_id);
create index payment_attempts_invoice_id_idx on public.payment_attempts(invoice_id);
create index payment_attempts_reviewed_by_idx on public.payment_attempts(reviewed_by);
create index payment_evidence_attempt_id_idx on public.payment_evidence(attempt_id);
create index payment_evidence_submitted_by_idx on public.payment_evidence(submitted_by);
create index payment_ledger_invoice_id_idx on public.payment_ledger(invoice_id);
create index payment_ledger_attempt_id_idx on public.payment_ledger(attempt_id);
create index refunds_invoice_id_idx on public.refunds(invoice_id);
create index refunds_attempt_id_idx on public.refunds(attempt_id);
create index refunds_approved_by_idx on public.refunds(approved_by);
create index events_status_starts_idx on public.events(status,starts_at);
create index events_organizer_starts_idx on public.events(organizer_profile_id,starts_at);
create index events_activity_starts_idx on public.events(activity_type_id,starts_at);
create index participants_occupancy_idx on public.event_participants(event_id,status,hold_expires_at);
create index participants_person_created_idx on public.event_participants(person_id,created_at);
create index invoices_due_idx on public.invoices(status,due_at);
create index attempts_invoice_created_idx on public.payment_attempts(invoice_id,created_at);
create index outbox_ready_idx on public.outbox_jobs(status,next_attempt_at);
create index webhook_pending_idx on public.webhook_events(status,created_at);
create index challenges_expiry_idx on public.verification_challenges(expires_at);
create index sessions_expiry_idx on public.guest_sessions(expires_at);
create index idempotency_expiry_idx on public.idempotency_records(expires_at);
create index rate_limits_expiry_idx on public.rate_limit_counters(expires_at);
create unique index event_payment_method_unique on public.event_payment_methods(event_id,method_type,coalesce(provider,''),coalesce(provider_method,''));
create index attempts_method_idx on public.payment_attempts(payment_method_id);
