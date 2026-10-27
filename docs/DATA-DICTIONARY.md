# Dolend data dictionary

Generated from the hosted public schema on 27 October 2026. No user data is included. All business tables have UUID primary keys and RLS enabled. Domain RPC execute is service-only; browser read scope is documented in DATABASE.md.

## activity_types

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| slug | text | NO | — |
| name | text | NO | — |
| active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `activity_types_slug_check`: CHECK ((slug ~ '^[a-z][a-z0-9-]*$'::text))
- `activity_types_pkey`: PRIMARY KEY (id)
- `activity_types_slug_key`: UNIQUE (slug)

## audit_logs

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| actor_type | text | NO | — |
| actor_id | uuid | YES | — |
| action | text | NO | — |
| entity_type | text | NO | — |
| entity_id | uuid | NO | — |
| redacted_changes | jsonb | NO | '{}'::jsonb |
| request_id | text | YES | — |
| created_at | timestamp with time zone | NO | now() |

Constraints:

- `audit_logs_pkey`: PRIMARY KEY (id)

## event_invites

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| token_hash | text | NO | — |
| expires_at | timestamp with time zone | YES | — |
| revoked_at | timestamp with time zone | YES | — |
| created_by | uuid | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `event_invites_token_hash_check`: CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))
- `event_invites_pkey`: PRIMARY KEY (id)
- `event_invites_token_hash_key`: UNIQUE (token_hash)
- `event_invites_event_id_fkey`: FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
- `event_invites_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT

## event_participants

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| person_id | uuid | NO | — |
| joined_as | text | NO | — |
| status | text | NO | — |
| hold_expires_at | timestamp with time zone | YES | — |
| confirmed_at | timestamp with time zone | YES | — |
| attendance_at | timestamp with time zone | YES | — |
| cancelled_at | timestamp with time zone | YES | — |
| cancellation_reason | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `event_participants_joined_as_check`: CHECK ((joined_as = ANY (ARRAY['guest'::text, 'member'::text])))
- `event_participants_status_check`: CHECK ((status = ANY (ARRAY['held'::text, 'confirmed'::text, 'attended'::text, 'no_show'::text, 'expired'::text, 'cancelled'::text])))
- `event_participants_check`: CHECK (((status <> 'held'::text) OR (hold_expires_at IS NOT NULL)))
- `event_participants_pkey`: PRIMARY KEY (id)
- `event_participants_event_id_person_id_key`: UNIQUE (event_id, person_id)
- `event_participants_event_id_fkey`: FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
- `event_participants_person_id_fkey`: FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT

## event_payment_methods

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| event_id | uuid | NO | — |
| method_type | text | NO | — |
| provider | text | YES | — |
| provider_method | text | YES | — |
| enabled | boolean | NO | true |
| instruction_snapshot | jsonb | NO | '{}'::jsonb |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `event_payment_methods_method_type_check`: CHECK ((method_type = ANY (ARRAY['manual_bank_transfer'::text, 'qris'::text, 'gateway'::text])))
- `event_payment_methods_instruction_snapshot_check`: CHECK ((jsonb_typeof(instruction_snapshot) = 'object'::text))
- `event_payment_methods_check`: CHECK (((method_type = 'manual_bank_transfer'::text) OR ((provider IS NOT NULL) AND (provider_method IS NOT NULL))))
- `event_payment_methods_pkey`: PRIMARY KEY (id)
- `event_payment_methods_event_id_fkey`: FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT

## events

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| organizer_profile_id | uuid | NO | — |
| activity_type_id | uuid | NO | — |
| venue_id | uuid | YES | — |
| venue_snapshot | jsonb | NO | '{}'::jsonb |
| title | text | NO | — |
| description | text | NO | ''::text |
| starts_at | timestamp with time zone | NO | — |
| ends_at | timestamp with time zone | NO | — |
| timezone | text | NO | 'Asia/Jakarta'::text |
| capacity | integer | NO | — |
| registration_closes_at | timestamp with time zone | NO | — |
| visibility | text | NO | 'unlisted'::text |
| status | text | NO | 'draft'::text |
| payment_mode | text | NO | 'free'::text |
| price_amount | bigint | NO | 0 |
| currency | text | NO | 'IDR'::text |
| payment_due_at | timestamp with time zone | YES | — |
| hold_minutes | integer | NO | 15 |
| manual_review_minutes | integer | NO | 1440 |
| cancellation_policy | jsonb | NO | '{}'::jsonb |
| version | integer | NO | 1 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `events_venue_snapshot_check`: CHECK ((jsonb_typeof(venue_snapshot) = 'object'::text))
- `events_title_check`: CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 200)))
- `events_description_check`: CHECK ((length(description) <= 10000))
- `events_capacity_check`: CHECK (((capacity >= 1) AND (capacity <= 100000)))
- `events_visibility_check`: CHECK ((visibility = ANY (ARRAY['public'::text, 'unlisted'::text])))
- `events_status_check`: CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'completed'::text, 'cancelled'::text])))
- `events_payment_mode_check`: CHECK ((payment_mode = ANY (ARRAY['free'::text, 'before_event'::text, 'after_event'::text])))
- `events_price_amount_check`: CHECK (((price_amount >= 0) AND (price_amount <= '1000000000000'::bigint)))
- `events_currency_check`: CHECK ((currency = 'IDR'::text))
- `events_hold_minutes_check`: CHECK (((hold_minutes >= 1) AND (hold_minutes <= 1440)))
- `events_manual_review_minutes_check`: CHECK (((manual_review_minutes >= 1) AND (manual_review_minutes <= 10080)))
- `events_cancellation_policy_check`: CHECK ((jsonb_typeof(cancellation_policy) = 'object'::text))
- `events_version_check`: CHECK ((version > 0))
- `events_check`: CHECK ((ends_at > starts_at))
- `events_check1`: CHECK ((registration_closes_at <= starts_at))
- `events_check2`: CHECK ((((payment_mode = 'free'::text) AND (price_amount = 0)) OR ((payment_mode <> 'free'::text) AND (price_amount > 0))))
- `events_check3`: CHECK (((payment_mode <> 'after_event'::text) OR ((payment_due_at IS NOT NULL) AND (payment_due_at >= ends_at))))
- `events_pkey`: PRIMARY KEY (id)
- `events_organizer_profile_id_fkey`: FOREIGN KEY (organizer_profile_id) REFERENCES profiles(id) ON DELETE RESTRICT
- `events_activity_type_id_fkey`: FOREIGN KEY (activity_type_id) REFERENCES activity_types(id) ON DELETE RESTRICT
- `events_venue_id_fkey`: FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE RESTRICT

## guest_sessions

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| person_id | uuid | NO | — |
| scope_event_id | uuid | NO | — |
| token_hash | text | NO | — |
| scope | text | NO | 'participation'::text |
| expires_at | timestamp with time zone | NO | — |
| revoked_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `guest_sessions_token_hash_check`: CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text))
- `guest_sessions_scope_check`: CHECK ((scope = 'participation'::text))
- `guest_sessions_pkey`: PRIMARY KEY (id)
- `guest_sessions_token_hash_key`: UNIQUE (token_hash)
- `guest_sessions_person_id_fkey`: FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
- `guest_sessions_scope_event_id_fkey`: FOREIGN KEY (scope_event_id) REFERENCES events(id) ON DELETE RESTRICT

## idempotency_records

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| actor_scope | text | NO | — |
| route | text | NO | — |
| key | text | NO | — |
| request_hash | text | NO | — |
| response | jsonb | NO | — |
| expires_at | timestamp with time zone | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `idempotency_records_pkey`: PRIMARY KEY (id)
- `idempotency_records_actor_scope_route_key_key`: UNIQUE (actor_scope, route, key)

## identity_claims

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| person_id | uuid | NO | — |
| auth_user_id | uuid | NO | — |
| challenge_id | uuid | NO | — |
| status | text | NO | 'pending'::text |
| expires_at | timestamp with time zone | NO | — |
| resolved_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `identity_claims_challenge_id_key`: UNIQUE (challenge_id)
- `identity_claims_person_id_fkey`: FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
- `identity_claims_auth_user_id_fkey`: FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
- `identity_claims_challenge_id_fkey`: FOREIGN KEY (challenge_id) REFERENCES verification_challenges(id) ON DELETE RESTRICT
- `identity_claims_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text, 'rejected'::text])))
- `identity_claims_pkey`: PRIMARY KEY (id)

## invoices

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| participant_id | uuid | NO | — |
| invoice_number | text | NO | ('DL-'::text \|\| (gen_random_uuid())::text) |
| amount_due | bigint | NO | — |
| currency | text | NO | 'IDR'::text |
| due_at | timestamp with time zone | NO | — |
| status | text | NO | 'open'::text |
| pricing_snapshot | jsonb | NO | — |
| waiver_reason | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `invoices_amount_due_check`: CHECK (((amount_due >= 1) AND (amount_due <= '1000000000000'::bigint)))
- `invoices_currency_check`: CHECK ((currency = 'IDR'::text))
- `invoices_status_check`: CHECK ((status = ANY (ARRAY['open'::text, 'paid'::text, 'void'::text, 'waived'::text])))
- `invoices_pricing_snapshot_check`: CHECK ((jsonb_typeof(pricing_snapshot) = 'object'::text))
- `invoices_pkey`: PRIMARY KEY (id)
- `invoices_participant_id_key`: UNIQUE (participant_id)
- `invoices_invoice_number_key`: UNIQUE (invoice_number)
- `invoices_participant_id_fkey`: FOREIGN KEY (participant_id) REFERENCES event_participants(id) ON DELETE RESTRICT

## outbox_jobs

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| kind | text | NO | — |
| aggregate_id | uuid | NO | — |
| dedupe_key | text | NO | — |
| payload | jsonb | NO | '{}'::jsonb |
| status | text | NO | 'pending'::text |
| attempts | integer | NO | 0 |
| next_attempt_at | timestamp with time zone | NO | now() |
| locked_until | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `outbox_jobs_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
- `outbox_jobs_attempts_check`: CHECK ((attempts >= 0))
- `outbox_jobs_pkey`: PRIMARY KEY (id)
- `outbox_jobs_dedupe_key_key`: UNIQUE (dedupe_key)

## participant_history

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| participant_id | uuid | NO | — |
| from_status | text | YES | — |
| to_status | text | NO | — |
| reason | text | YES | — |
| actor_type | text | NO | 'system'::text |
| actor_id | uuid | YES | — |
| created_at | timestamp with time zone | NO | now() |

Constraints:

- `participant_history_pkey`: PRIMARY KEY (id)
- `participant_history_participant_id_fkey`: FOREIGN KEY (participant_id) REFERENCES event_participants(id) ON DELETE RESTRICT

## payment_attempts

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| payment_method_id | uuid | NO | — |
| invoice_id | uuid | NO | — |
| method_type | text | NO | — |
| provider | text | YES | — |
| provider_reference | text | YES | — |
| amount | bigint | NO | — |
| currency | text | NO | 'IDR'::text |
| status | text | NO | 'created'::text |
| expires_at | timestamp with time zone | YES | — |
| review_deadline | timestamp with time zone | YES | — |
| idempotency_key | text | NO | — |
| checkout_url | text | YES | — |
| reviewed_by | uuid | YES | — |
| review_reason | text | YES | — |
| exception_reason | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `payment_attempts_method_type_check`: CHECK ((method_type = ANY (ARRAY['manual_bank_transfer'::text, 'qris'::text, 'gateway'::text])))
- `payment_attempts_amount_check`: CHECK (((amount >= 1) AND (amount <= '1000000000000'::bigint)))
- `payment_attempts_currency_check`: CHECK ((currency = 'IDR'::text))
- `payment_attempts_status_check`: CHECK ((status = ANY (ARRAY['created'::text, 'pending'::text, 'pending_review'::text, 'succeeded'::text, 'failed'::text, 'expired'::text, 'rejected'::text])))
- `payment_attempts_idempotency_key_check`: CHECK (((length(idempotency_key) >= 1) AND (length(idempotency_key) <= 200)))
- `payment_attempts_check`: CHECK (((status <> 'pending_review'::text) OR (review_deadline IS NOT NULL)))
- `payment_attempts_pkey`: PRIMARY KEY (id)
- `payment_attempts_invoice_id_idempotency_key_key`: UNIQUE (invoice_id, idempotency_key)
- `payment_attempts_provider_provider_reference_key`: UNIQUE (provider, provider_reference)
- `payment_attempts_payment_method_id_fkey`: FOREIGN KEY (payment_method_id) REFERENCES event_payment_methods(id) ON DELETE RESTRICT
- `payment_attempts_invoice_id_fkey`: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
- `payment_attempts_reviewed_by_fkey`: FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE RESTRICT

## payment_evidence

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| attempt_id | uuid | NO | — |
| storage_path | text | NO | — |
| mime_type | text | NO | — |
| size_bytes | bigint | NO | — |
| submitted_by | uuid | NO | — |
| reviewed_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `payment_evidence_mime_type_check`: CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'application/pdf'::text])))
- `payment_evidence_size_bytes_check`: CHECK (((size_bytes >= 1) AND (size_bytes <= 5242880)))
- `payment_evidence_pkey`: PRIMARY KEY (id)
- `payment_evidence_storage_path_key`: UNIQUE (storage_path)
- `payment_evidence_attempt_id_fkey`: FOREIGN KEY (attempt_id) REFERENCES payment_attempts(id) ON DELETE RESTRICT
- `payment_evidence_submitted_by_fkey`: FOREIGN KEY (submitted_by) REFERENCES people(id) ON DELETE RESTRICT

## payment_ledger

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| invoice_id | uuid | NO | — |
| attempt_id | uuid | YES | — |
| entry_type | text | NO | — |
| amount | bigint | NO | — |
| currency | text | NO | 'IDR'::text |
| source_reference | text | NO | — |
| occurred_at | timestamp with time zone | NO | now() |
| created_at | timestamp with time zone | NO | now() |

Constraints:

- `payment_ledger_entry_type_check`: CHECK ((entry_type = ANY (ARRAY['receipt'::text, 'refund'::text, 'adjustment'::text])))
- `payment_ledger_amount_check`: CHECK (((amount >= 1) AND (amount <= '1000000000000'::bigint)))
- `payment_ledger_currency_check`: CHECK ((currency = 'IDR'::text))
- `payment_ledger_pkey`: PRIMARY KEY (id)
- `payment_ledger_source_reference_key`: UNIQUE (source_reference)
- `payment_ledger_invoice_id_fkey`: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
- `payment_ledger_attempt_id_fkey`: FOREIGN KEY (attempt_id) REFERENCES payment_attempts(id) ON DELETE RESTRICT

## people

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| display_name | text | NO | — |
| phone_normalized | text | NO | — |
| phone_verified_at | timestamp with time zone | YES | — |
| state | text | NO | 'active'::text |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `people_display_name_check`: CHECK (((length(TRIM(BOTH FROM display_name)) >= 1) AND (length(TRIM(BOTH FROM display_name)) <= 120)))
- `people_phone_normalized_check`: CHECK ((phone_normalized ~ '^62[1-9][0-9]{6,12}$'::text))
- `people_state_check`: CHECK ((state = ANY (ARRAY['active'::text, 'suspended'::text, 'anonymized'::text])))
- `people_pkey`: PRIMARY KEY (id)
- `people_phone_normalized_key`: UNIQUE (phone_normalized)

## profiles

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | — |
| person_id | uuid | NO | — |
| avatar_path | text | YES | — |
| bio | text | YES | — |
| default_timezone | text | NO | 'Asia/Jakarta'::text |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `profiles_bio_check`: CHECK ((length(bio) <= 1000))
- `profiles_pkey`: PRIMARY KEY (id)
- `profiles_person_id_key`: UNIQUE (person_id)
- `profiles_id_fkey`: FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT
- `profiles_person_id_fkey`: FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT
- `profile_avatar_path_length`: CHECK ((length(avatar_path) <= 512))

## rate_limit_counters

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| bucket_key | text | NO | — |
| window_start | timestamp with time zone | NO | — |
| count | integer | NO | — |
| expires_at | timestamp with time zone | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `rate_limit_counters_bucket_key_window_start_key`: UNIQUE (bucket_key, window_start)
- `rate_limit_counters_count_check`: CHECK ((count >= 0))
- `rate_limit_counters_pkey`: PRIMARY KEY (id)

## refunds

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| invoice_id | uuid | NO | — |
| attempt_id | uuid | NO | — |
| amount | bigint | NO | — |
| status | text | NO | 'requested'::text |
| reason | text | NO | — |
| provider_reference | text | YES | — |
| evidence_path | text | YES | — |
| approved_by | uuid | YES | — |
| idempotency_key | text | NO | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `refunds_amount_check`: CHECK (((amount >= 1) AND (amount <= '1000000000000'::bigint)))
- `refunds_status_check`: CHECK ((status = ANY (ARRAY['requested'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
- `refunds_pkey`: PRIMARY KEY (id)
- `refunds_provider_reference_key`: UNIQUE (provider_reference)
- `refunds_invoice_id_idempotency_key_key`: UNIQUE (invoice_id, idempotency_key)
- `refunds_invoice_id_fkey`: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
- `refunds_attempt_id_fkey`: FOREIGN KEY (attempt_id) REFERENCES payment_attempts(id) ON DELETE RESTRICT
- `refunds_approved_by_fkey`: FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE RESTRICT

## venues

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| created_by | uuid | NO | — |
| name | text | NO | — |
| address | text | NO | — |
| city | text | NO | — |
| latitude | numeric | YES | — |
| longitude | numeric | YES | — |
| maps_url | text | NO | — |
| place_id | text | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `venues_latitude_check`: CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))
- `venues_longitude_check`: CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))
- `venues_maps_url_check`: CHECK ((maps_url ~ '^https://'::text))
- `venues_check`: CHECK (((latitude IS NULL) = (longitude IS NULL)))
- `venues_pkey`: PRIMARY KEY (id)
- `venues_created_by_fkey`: FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT

## verification_challenges

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| phone_normalized | text | NO | — |
| auth_user_id | uuid | YES | — |
| purpose | text | NO | — |
| provider_ref | text | YES | — |
| secret_hash | text | YES | — |
| attempts | integer | NO | 0 |
| verified_at | timestamp with time zone | YES | — |
| expires_at | timestamp with time zone | NO | — |
| consumed_at | timestamp with time zone | YES | — |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `verification_challenges_phone_normalized_check`: CHECK ((phone_normalized ~ '^62[1-9][0-9]{6,12}$'::text))
- `verification_challenges_purpose_check`: CHECK ((purpose = ANY (ARRAY['signup'::text, 'guest_join'::text, 'claim'::text, 'change_phone'::text])))
- `verification_challenges_attempts_check`: CHECK ((attempts >= 0))
- `verification_challenges_pkey`: PRIMARY KEY (id)
- `verification_challenges_auth_user_id_fkey`: FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT

## webhook_events

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| provider | text | NO | — |
| external_event_id | text | NO | — |
| payload_hash | text | NO | — |
| payload_private | jsonb | YES | — |
| processed_at | timestamp with time zone | YES | — |
| status | text | NO | 'pending'::text |
| retry_count | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

Constraints:

- `webhook_events_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'quarantined'::text])))
- `webhook_events_retry_count_check`: CHECK ((retry_count >= 0))
- `webhook_events_pkey`: PRIMARY KEY (id)
- `webhook_events_provider_external_event_id_key`: UNIQUE (provider, external_event_id)
