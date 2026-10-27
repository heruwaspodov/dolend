// Generated from Supabase public schema; regenerate after migrations.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          redacted_changes: Json
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          redacted_changes?: Json
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          redacted_changes?: Json
          request_id?: string | null
        }
        Relationships: []
      }
      event_invites: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          expires_at: string | null
          id: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          attendance_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          hold_expires_at: string | null
          id: string
          joined_as: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_id: string
          hold_expires_at?: string | null
          id?: string
          joined_as: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_id?: string
          hold_expires_at?: string | null
          id?: string
          joined_as?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payment_methods: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          id: string
          instruction_snapshot: Json
          method_type: string
          provider: string | null
          provider_method: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          id?: string
          instruction_snapshot?: Json
          method_type: string
          provider?: string | null
          provider_method?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          id?: string
          instruction_snapshot?: Json
          method_type?: string
          provider?: string | null
          provider_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payment_methods_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payment_methods_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "public_events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          activity_type_id: string
          cancellation_policy: Json
          capacity: number
          created_at: string
          currency: string
          description: string
          ends_at: string
          hold_minutes: number
          id: string
          manual_review_minutes: number
          organizer_profile_id: string
          payment_due_at: string | null
          payment_mode: string
          price_amount: number
          registration_closes_at: string
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          venue_id: string | null
          venue_snapshot: Json
          version: number
          visibility: string
        }
        Insert: {
          activity_type_id: string
          cancellation_policy?: Json
          capacity: number
          created_at?: string
          currency?: string
          description?: string
          ends_at: string
          hold_minutes?: number
          id?: string
          manual_review_minutes?: number
          organizer_profile_id: string
          payment_due_at?: string | null
          payment_mode?: string
          price_amount?: number
          registration_closes_at: string
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          venue_id?: string | null
          venue_snapshot?: Json
          version?: number
          visibility?: string
        }
        Update: {
          activity_type_id?: string
          cancellation_policy?: Json
          capacity?: number
          created_at?: string
          currency?: string
          description?: string
          ends_at?: string
          hold_minutes?: number
          id?: string
          manual_review_minutes?: number
          organizer_profile_id?: string
          payment_due_at?: string | null
          payment_mode?: string
          price_amount?: number
          registration_closes_at?: string
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          venue_id?: string | null
          venue_snapshot?: Json
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_profile_id_fkey"
            columns: ["organizer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          scope: string
          scope_event_id: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          scope?: string
          scope_event_id: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          scope?: string
          scope_event_id?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_sessions_scope_event_id_fkey"
            columns: ["scope_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sessions_scope_event_id_fkey"
            columns: ["scope_event_id"]
            isOneToOne: false
            referencedRelation: "public_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          actor_scope: string
          created_at: string
          expires_at: string
          id: string
          key: string
          request_hash: string
          response: Json
          route: string
          updated_at: string
        }
        Insert: {
          actor_scope: string
          created_at?: string
          expires_at: string
          id?: string
          key: string
          request_hash: string
          response: Json
          route: string
          updated_at?: string
        }
        Update: {
          actor_scope?: string
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          request_hash?: string
          response?: Json
          route?: string
          updated_at?: string
        }
        Relationships: []
      }
      identity_claims: {
        Row: {
          auth_user_id: string
          challenge_id: string
          created_at: string
          expires_at: string
          id: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_user_id: string
          challenge_id: string
          created_at?: string
          expires_at: string
          id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_user_id?: string
          challenge_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: true
            referencedRelation: "verification_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          created_at: string
          currency: string
          due_at: string
          id: string
          invoice_number: string
          participant_id: string
          pricing_snapshot: Json
          status: string
          updated_at: string
          waiver_reason: string | null
        }
        Insert: {
          amount_due: number
          created_at?: string
          currency?: string
          due_at: string
          id?: string
          invoice_number?: string
          participant_id: string
          pricing_snapshot: Json
          status?: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Update: {
          amount_due?: number
          created_at?: string
          currency?: string
          due_at?: string
          id?: string
          invoice_number?: string
          participant_id?: string
          pricing_snapshot?: Json
          status?: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "event_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_jobs: {
        Row: {
          aggregate_id: string
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          locked_until: string | null
          next_attempt_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          locked_until?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          locked_until?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      participant_history: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          from_status: string | null
          id: string
          participant_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          participant_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          participant_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_history_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          exception_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider: string | null
          provider_reference: string | null
          review_deadline: string | null
          review_reason: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          exception_reason?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider?: string | null
          provider_reference?: string | null
          review_deadline?: string | null
          review_reason?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          exception_reason?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          method_type?: string
          payment_method_id?: string
          provider?: string | null
          provider_reference?: string | null
          review_deadline?: string | null
          review_reason?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "event_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_evidence: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          mime_type: string
          reviewed_at: string | null
          size_bytes: number
          storage_path: string
          submitted_by_user_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          mime_type: string
          reviewed_at?: string | null
          size_bytes: number
          storage_path: string
          submitted_by_user_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          reviewed_at?: string | null
          size_bytes?: number
          storage_path?: string
          submitted_by_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_evidence_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_evidence_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_ledger: {
        Row: {
          amount: number
          attempt_id: string | null
          created_at: string
          currency: string
          entry_type: string
          id: string
          invoice_id: string
          occurred_at: string
          source_reference: string
        }
        Insert: {
          amount: number
          attempt_id?: string | null
          created_at?: string
          currency?: string
          entry_type: string
          id?: string
          invoice_id: string
          occurred_at?: string
          source_reference: string
        }
        Update: {
          amount?: number
          attempt_id?: string | null
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          invoice_id?: string
          occurred_at?: string
          source_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_ledger_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          default_timezone: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          default_timezone?: string
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          default_timezone?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket_key: string
          count: number
          created_at: string
          expires_at: string
          id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count: number
          created_at?: string
          expires_at: string
          id?: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          approved_by: string | null
          attempt_id: string
          created_at: string
          evidence_path: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          attempt_id: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          provider_reference?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          attempt_id?: string
          created_at?: string
          evidence_path?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          provider_reference?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone_normalized: string
          phone_verified_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          phone_normalized: string
          phone_verified_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone_normalized?: string
          phone_verified_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          city: string
          created_at: string
          created_by: string
          id: string
          latitude: number | null
          longitude: number | null
          maps_url: string
          name: string
          place_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          created_by: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url: string
          name: string
          place_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          maps_url?: string
          name?: string
          place_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_challenges: {
        Row: {
          attempts: number
          auth_user_id: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_normalized: string
          provider_ref: string | null
          purpose: string
          secret_hash: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_normalized: string
          provider_ref?: string | null
          purpose: string
          secret_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_normalized?: string
          provider_ref?: string | null
          purpose?: string
          secret_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          external_event_id: string
          id: string
          payload_hash: string
          payload_private: Json | null
          processed_at: string | null
          provider: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_event_id: string
          id?: string
          payload_hash: string
          payload_private?: Json | null
          processed_at?: string | null
          provider: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_event_id?: string
          id?: string
          payload_hash?: string
          payload_private?: Json | null
          processed_at?: string | null
          provider?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_events: {
        Row: {
          activity_type_id: string | null
          capacity: number | null
          currency: string | null
          description: string | null
          ends_at: string | null
          id: string | null
          participants_count: number | null
          price_amount: number | null
          starts_at: string | null
          status: string | null
          timezone: string | null
          title: string | null
          venue: Json | null
        }
        Insert: {
          activity_type_id?: string | null
          capacity?: number | null
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string | null
          participants_count?: never
          price_amount?: number | null
          starts_at?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          venue?: never
        }
        Update: {
          activity_type_id?: string | null
          capacity?: number | null
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string | null
          participants_count?: never
          price_amount?: number | null
          starts_at?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          venue?: never
        }
        Relationships: [
          {
            foreignKeyName: "events_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_provider_payment: {
        Args: {
          p_amount: number
          p_attempt_id: string
          p_currency: string
          p_provider: string
          p_provider_reference: string
        }
        Returns: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          exception_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider: string | null
          provider_reference: string | null
          review_deadline: string | null
          review_reason: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_manual_payment: {
        Args: {
          p_actor_profile_id: string
          p_attempt_id: string
          p_decision: string
          p_reason: string
        }
        Returns: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          exception_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider: string | null
          provider_reference: string | null
          review_deadline: string | null
          review_reason: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_event: {
        Args: {
          p_actor_profile_id: string
          p_event_id: string
          p_reason: string
        }
        Returns: undefined
      }
      cancel_participation: {
        Args: {
          p_actor_profile_id?: string
          p_guest_session_hash?: string
          p_participant_id: string
          p_reason: string
        }
        Returns: {
          attendance_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          hold_expires_at: string | null
          id: string
          joined_as: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_guest_identity: {
        Args: { p_auth_user_id: string; p_challenge_id: string }
        Returns: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          default_timezone: string
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payment_attempt: {
        Args: {
          p_actor_profile_id?: string
          p_guest_session_hash?: string
          p_invoice_id: string
          p_key: string
          p_method_id: string
        }
        Returns: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          exception_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider: string | null
          provider_reference: string | null
          review_deadline: string | null
          review_reason: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_holds: { Args: { p_event_id: string }; Returns: number }
      join_event: {
        Args: {
          p_actor_profile_id?: string
          p_event_id: string
          p_guest_session_hash?: string
          p_user_id: string
        }
        Returns: {
          attendance_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          event_id: string
          hold_expires_at: string | null
          id: string
          joined_as: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_refund: {
        Args: {
          p_actor_profile_id: string
          p_evidence_path?: string
          p_reference: string
          p_refund_id: string
        }
        Returns: {
          amount: number
          approved_by: string | null
          attempt_id: string
          created_at: string
          evidence_path: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_refund: {
        Args: {
          p_actor_profile_id: string
          p_amount: number
          p_attempt_id: string
          p_key: string
          p_reason: string
        }
        Returns: {
          amount: number
          approved_by: string | null
          attempt_id: string
          created_at: string
          evidence_path: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          provider_reference: string | null
          reason: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_manual_evidence: {
        Args: {
          p_actor_profile_id?: string
          p_attempt_id: string
          p_guest_session_hash?: string
          p_mime: string
          p_size: number
          p_storage_path: string
        }
        Returns: {
          amount: number
          checkout_url: string | null
          created_at: string
          currency: string
          exception_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method_type: string
          payment_method_id: string
          provider: string | null
          provider_reference: string | null
          review_deadline: string | null
          review_reason: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
