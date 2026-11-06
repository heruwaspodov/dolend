// Generated from the local Supabase public schema; regenerate after migrations.
export type Json = string | number | boolean | null | {
  [key: string]: Json | undefined;
} | Json[];

export type Database = {
  "public": {
    Tables: {
      "achievement_award_audit": {
        Row: {
          "achievement_id": string;
          "action": string;
          "award_id": string;
          "created_at": string;
          "evidence_event_ids": (string)[];
          "id": number;
          "profile_id": string;
          "reason": string;
          "rebuild_id": string;
          "rule_version": number;
        };
        ComputedFields: never;
        Insert: {
          "achievement_id": string;
          "action": string;
          "award_id": string;
          "created_at"?: string;
          "evidence_event_ids"?: (string)[];
          "id"?: never;
          "profile_id": string;
          "reason": string;
          "rebuild_id": string;
          "rule_version": number;
        };
        Update: {
          "achievement_id"?: string;
          "action"?: string;
          "award_id"?: string;
          "created_at"?: string;
          "evidence_event_ids"?: (string)[];
          "id"?: never;
          "profile_id"?: string;
          "reason"?: string;
          "rebuild_id"?: string;
          "rule_version"?: number;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_award_audit_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievement_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievement_award_audit_award_id_fkey";
            columns: ["award_id"];
            isOneToOne: false;
            referencedRelation: "achievement_awards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievement_award_audit_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "achievement_awards": {
        Row: {
          "achievement_id": string;
          "awarded_at": string;
          "evidence_event_ids": (string)[];
          "id": string;
          "profile_id": string;
          "revoked_at": string | null;
          "rule_version": number;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "achievement_id": string;
          "awarded_at"?: string;
          "evidence_event_ids"?: (string)[];
          "id"?: string;
          "profile_id": string;
          "revoked_at"?: string | null;
          "rule_version": number;
          "status": string;
          "updated_at"?: string;
        };
        Update: {
          "achievement_id"?: string;
          "awarded_at"?: string;
          "evidence_event_ids"?: (string)[];
          "id"?: string;
          "profile_id"?: string;
          "revoked_at"?: string | null;
          "rule_version"?: number;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_awards_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievement_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName:
              "achievement_awards_achievement_id_rule_version_fkey";
            columns: ["achievement_id", "rule_version"];
            isOneToOne: false;
            referencedRelation: "achievement_rule_versions";
            referencedColumns: ["achievement_id", "version"];
          },
          {
            foreignKeyName: "achievement_awards_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "achievement_definitions": {
        Row: {
          "active": boolean;
          "code": string;
          "created_at": string;
          "description": string;
          "id": string;
          "metric": string;
          "rule_version": number;
          "threshold": number;
          "title": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "active"?: boolean;
          "code": string;
          "created_at"?: string;
          "description"?: string;
          "id"?: string;
          "metric"?: string;
          "rule_version"?: number;
          "threshold": number;
          "title": string;
          "updated_at"?: string;
        };
        Update: {
          "active"?: boolean;
          "code"?: string;
          "created_at"?: string;
          "description"?: string;
          "id"?: string;
          "metric"?: string;
          "rule_version"?: number;
          "threshold"?: number;
          "title"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "achievement_rebuild_jobs": {
        Row: {
          "attempts": number;
          "available_at": string;
          "id": number;
          "locked_until": string | null;
          "profile_id": string;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "available_at"?: string;
          "id"?: never;
          "locked_until"?: string | null;
          "profile_id": string;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "attempts"?: number;
          "available_at"?: string;
          "id"?: never;
          "locked_until"?: string | null;
          "profile_id"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_rebuild_jobs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "achievement_rule_versions": {
        Row: {
          "achievement_id": string;
          "created_at": string;
          "rules": NonNullable<Json>;
          "version": number;
        };
        ComputedFields: never;
        Insert: {
          "achievement_id": string;
          "created_at"?: string;
          "rules": NonNullable<Json>;
          "version": number;
        };
        Update: {
          "achievement_id"?: string;
          "created_at"?: string;
          "rules"?: NonNullable<Json>;
          "version"?: number;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_rule_versions_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievement_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      "activities": {
        Row: {
          "author_profile_id": string;
          "body": string;
          "community_id": string | null;
          "created_at": string;
          "deleted_at": string | null;
          "id": string;
          "idempotency_key": string;
          "source_event_id": string | null;
          "updated_at": string;
          "visibility": string;
        };
        ComputedFields: never;
        Insert: {
          "author_profile_id": string;
          "body": string;
          "community_id"?: string | null;
          "created_at"?: string;
          "deleted_at"?: string | null;
          "id"?: string;
          "idempotency_key": string;
          "source_event_id"?: string | null;
          "updated_at"?: string;
          "visibility"?: string;
        };
        Update: {
          "author_profile_id"?: string;
          "body"?: string;
          "community_id"?: string | null;
          "created_at"?: string;
          "deleted_at"?: string | null;
          "id"?: string;
          "idempotency_key"?: string;
          "source_event_id"?: string | null;
          "updated_at"?: string;
          "visibility"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_author_profile_id_fkey";
            columns: ["author_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_source_event_id_fkey";
            columns: ["source_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_source_event_id_fkey";
            columns: ["source_event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
        ];
      };
      "activity_photo_moderators": {
        Row: {
          "granted_at": string;
          "granted_by": string | null;
          "profile_id": string;
        };
        ComputedFields: never;
        Insert: {
          "granted_at"?: string;
          "granted_by"?: string | null;
          "profile_id": string;
        };
        Update: {
          "granted_at"?: string;
          "granted_by"?: string | null;
          "profile_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_photo_moderators_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_photo_moderators_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "activity_photo_reports": {
        Row: {
          "created_at": string;
          "details": string;
          "id": string;
          "photo_id": string;
          "reason": string;
          "reporter_profile_id": string;
          "reviewed_at": string | null;
          "reviewed_by_profile_id": string | null;
          "status": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "photo_id": string;
          "reason": string;
          "reporter_profile_id": string;
          "reviewed_at"?: string | null;
          "reviewed_by_profile_id"?: string | null;
          "status"?: string;
        };
        Update: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "photo_id"?: string;
          "reason"?: string;
          "reporter_profile_id"?: string;
          "reviewed_at"?: string | null;
          "reviewed_by_profile_id"?: string | null;
          "status"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_photo_reports_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "activity_photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_photo_reports_reporter_profile_id_fkey";
            columns: ["reporter_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName:
              "activity_photo_reports_reviewed_by_profile_id_fkey";
            columns: ["reviewed_by_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "activity_photos": {
        Row: {
          "activity_id": string;
          "consented_at": string;
          "content_type": string;
          "created_at": string;
          "deleted_at": string | null;
          "height": number;
          "id": string;
          "moderation_status": string;
          "size_bytes": number;
          "storage_reference": string | null;
          "uploader_profile_id": string;
          "width": number;
        };
        ComputedFields: never;
        Insert: {
          "activity_id": string;
          "consented_at": string;
          "content_type": string;
          "created_at"?: string;
          "deleted_at"?: string | null;
          "height": number;
          "id"?: string;
          "moderation_status"?: string;
          "size_bytes": number;
          "storage_reference"?: string | null;
          "uploader_profile_id": string;
          "width": number;
        };
        Update: {
          "activity_id"?: string;
          "consented_at"?: string;
          "content_type"?: string;
          "created_at"?: string;
          "deleted_at"?: string | null;
          "height"?: number;
          "id"?: string;
          "moderation_status"?: string;
          "size_bytes"?: number;
          "storage_reference"?: string | null;
          "uploader_profile_id"?: string;
          "width"?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activity_photos_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_photos_storage_reference_fkey";
            columns: ["storage_reference"];
            isOneToOne: true;
            referencedRelation: "private_uploads";
            referencedColumns: ["storage_reference"];
          },
          {
            foreignKeyName: "activity_photos_uploader_profile_id_fkey";
            columns: ["uploader_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "activity_reports": {
        Row: {
          "activity_id": string;
          "created_at": string;
          "details": string;
          "id": string;
          "reason": string;
          "reporter_profile_id": string;
        };
        ComputedFields: never;
        Insert: {
          "activity_id": string;
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason": string;
          "reporter_profile_id": string;
        };
        Update: {
          "activity_id"?: string;
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason"?: string;
          "reporter_profile_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_reports_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_reports_reporter_profile_id_fkey";
            columns: ["reporter_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "activity_types": {
        Row: {
          "active": boolean;
          "created_at": string;
          "id": string;
          "name": string;
          "slug": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "active"?: boolean;
          "created_at"?: string;
          "id"?: string;
          "name": string;
          "slug": string;
          "updated_at"?: string;
        };
        Update: {
          "active"?: boolean;
          "created_at"?: string;
          "id"?: string;
          "name"?: string;
          "slug"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "audit_logs": {
        Row: {
          "action": string;
          "actor_id": string | null;
          "actor_type": string;
          "created_at": string;
          "entity_id": string;
          "entity_type": string;
          "id": string;
          "redacted_changes": NonNullable<Json>;
          "request_id": string | null;
        };
        ComputedFields: never;
        Insert: {
          "action": string;
          "actor_id"?: string | null;
          "actor_type": string;
          "created_at"?: string;
          "entity_id": string;
          "entity_type": string;
          "id"?: string;
          "redacted_changes"?: NonNullable<Json>;
          "request_id"?: string | null;
        };
        Update: {
          "action"?: string;
          "actor_id"?: string | null;
          "actor_type"?: string;
          "created_at"?: string;
          "entity_id"?: string;
          "entity_type"?: string;
          "id"?: string;
          "redacted_changes"?: NonNullable<Json>;
          "request_id"?: string | null;
        };
        Relationships: [];
      };
      "challenge_members": {
        Row: {
          "challenge_id": string;
          "completed_at": string | null;
          "joined_at": string;
          "profile_id": string;
          "progress": number;
          "recalculated_at": string | null;
          "status": string;
        };
        ComputedFields: never;
        Insert: {
          "challenge_id": string;
          "completed_at"?: string | null;
          "joined_at"?: string;
          "profile_id": string;
          "progress"?: number;
          "recalculated_at"?: string | null;
          "status"?: string;
        };
        Update: {
          "challenge_id"?: string;
          "completed_at"?: string | null;
          "joined_at"?: string;
          "profile_id"?: string;
          "progress"?: number;
          "recalculated_at"?: string | null;
          "status"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "challenge_progress_jobs": {
        Row: {
          "attempts": number;
          "available_at": string;
          "challenge_id": string;
          "id": number;
          "locked_until": string | null;
          "profile_id": string;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "available_at"?: string;
          "challenge_id": string;
          "id"?: never;
          "locked_until"?: string | null;
          "profile_id": string;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "attempts"?: number;
          "available_at"?: string;
          "challenge_id"?: string;
          "id"?: never;
          "locked_until"?: string | null;
          "profile_id"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_progress_jobs_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_progress_jobs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "challenge_rule_versions": {
        Row: {
          "challenge_id": string;
          "created_at": string;
          "created_by": string;
          "rules": NonNullable<Json>;
          "version": number;
        };
        ComputedFields: never;
        Insert: {
          "challenge_id": string;
          "created_at"?: string;
          "created_by": string;
          "rules": NonNullable<Json>;
          "version": number;
        };
        Update: {
          "challenge_id"?: string;
          "created_at"?: string;
          "created_by"?: string;
          "rules"?: NonNullable<Json>;
          "version"?: number;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_rule_versions_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_rule_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "challenges": {
        Row: {
          "created_at": string;
          "description": string;
          "eligibility": NonNullable<Json>;
          "ends_on": string;
          "id": string;
          "metric": string;
          "owner_profile_id": string;
          "rule_version": number;
          "starts_on": string;
          "status": string;
          "target": number;
          "timezone": string;
          "title": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "description"?: string;
          "eligibility"?: NonNullable<Json>;
          "ends_on": string;
          "id"?: string;
          "metric"?: string;
          "owner_profile_id": string;
          "rule_version"?: number;
          "starts_on": string;
          "status"?: string;
          "target": number;
          "timezone": string;
          "title": string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "description"?: string;
          "eligibility"?: NonNullable<Json>;
          "ends_on"?: string;
          "id"?: string;
          "metric"?: string;
          "owner_profile_id"?: string;
          "rule_version"?: number;
          "starts_on"?: string;
          "status"?: string;
          "target"?: number;
          "timezone"?: string;
          "title"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenges_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "client_navigation_flags": {
        Row: {
          "enabled": boolean;
          "flag_key": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "enabled"?: boolean;
          "flag_key": string;
          "updated_at"?: string;
        };
        Update: {
          "enabled"?: boolean;
          "flag_key"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "communities": {
        Row: {
          "avatar_path": string | null;
          "created_at": string;
          "description": string;
          "id": string;
          "name": string;
          "owner_profile_id": string;
          "slug": string;
          "updated_at": string;
          "visibility": string;
        };
        ComputedFields: never;
        Insert: {
          "avatar_path"?: string | null;
          "created_at"?: string;
          "description"?: string;
          "id"?: string;
          "name": string;
          "owner_profile_id": string;
          "slug": string;
          "updated_at"?: string;
          "visibility"?: string;
        };
        Update: {
          "avatar_path"?: string | null;
          "created_at"?: string;
          "description"?: string;
          "id"?: string;
          "name"?: string;
          "owner_profile_id"?: string;
          "slug"?: string;
          "updated_at"?: string;
          "visibility"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communities_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "community_members": {
        Row: {
          "community_id": string;
          "created_at": string;
          "profile_id": string;
          "role": string;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "community_id": string;
          "created_at"?: string;
          "profile_id": string;
          "role"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "community_id"?: string;
          "created_at"?: string;
          "profile_id"?: string;
          "role"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "contribution_ledger": {
        Row: {
          "actor_id": string;
          "amount": number;
          "charge_id": string;
          "created_at": string;
          "entry_type": string;
          "id": string;
          "idempotency_key": string;
          "payment_id": string | null;
          "reason": string;
        };
        ComputedFields: never;
        Insert: {
          "actor_id": string;
          "amount": number;
          "charge_id": string;
          "created_at"?: string;
          "entry_type": string;
          "id"?: string;
          "idempotency_key": string;
          "payment_id"?: string | null;
          "reason": string;
        };
        Update: {
          "actor_id"?: string;
          "amount"?: number;
          "charge_id"?: string;
          "created_at"?: string;
          "entry_type"?: string;
          "id"?: string;
          "idempotency_key"?: string;
          "payment_id"?: string | null;
          "reason"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contribution_ledger_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contribution_ledger_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: false;
            referencedRelation: "participant_charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contribution_ledger_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: true;
            referencedRelation: "manual_payment_records";
            referencedColumns: ["id"];
          },
        ];
      };
      "event_invites": {
        Row: {
          "created_at": string;
          "created_by": string;
          "event_id": string;
          "expires_at": string | null;
          "id": string;
          "revoked_at": string | null;
          "token_hash": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "created_by": string;
          "event_id": string;
          "expires_at"?: string | null;
          "id"?: string;
          "revoked_at"?: string | null;
          "token_hash": string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "created_by"?: string;
          "event_id"?: string;
          "expires_at"?: string | null;
          "id"?: string;
          "revoked_at"?: string | null;
          "token_hash"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_invites_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_invites_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
        ];
      };
      "event_organizers": {
        Row: {
          "created_at": string;
          "event_id": string;
          "profile_id": string;
          "role": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "event_id": string;
          "profile_id": string;
          "role": string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "event_id"?: string;
          "profile_id"?: string;
          "role"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_organizers_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_organizers_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_organizers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "event_participants": {
        Row: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "attendance_at"?: string | null;
          "cancellation_reason"?: string | null;
          "cancelled_at"?: string | null;
          "chargeable"?: boolean;
          "confirmed_at"?: string | null;
          "created_at"?: string;
          "event_id": string;
          "hold_expires_at"?: string | null;
          "id"?: string;
          "joined_as": string;
          "status": string;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "attendance_at"?: string | null;
          "cancellation_reason"?: string | null;
          "cancelled_at"?: string | null;
          "chargeable"?: boolean;
          "confirmed_at"?: string | null;
          "created_at"?: string;
          "event_id"?: string;
          "hold_expires_at"?: string | null;
          "id"?: string;
          "joined_as"?: string;
          "status"?: string;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participants_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      "event_payment_methods": {
        Row: {
          "created_at": string;
          "enabled": boolean;
          "event_id": string;
          "id": string;
          "instruction_snapshot": NonNullable<Json>;
          "method_type": string;
          "provider": string | null;
          "provider_method": string | null;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "enabled"?: boolean;
          "event_id": string;
          "id"?: string;
          "instruction_snapshot"?: NonNullable<Json>;
          "method_type": string;
          "provider"?: string | null;
          "provider_method"?: string | null;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "enabled"?: boolean;
          "event_id"?: string;
          "id"?: string;
          "instruction_snapshot"?: NonNullable<Json>;
          "method_type"?: string;
          "provider"?: string | null;
          "provider_method"?: string | null;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_payment_methods_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_payment_methods_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
        ];
      };
      "events": {
        Row: {
          "activity_type_id": string;
          "archived_at": string | null;
          "cancellation_policy": NonNullable<Json>;
          "capacity": number;
          "community_id": string | null;
          "contribution_mode": string;
          "contributions_locked_at": string | null;
          "contributions_locked_by": string | null;
          "created_at": string;
          "currency": string;
          "description": string;
          "ends_at": string;
          "estimated_total_cost": number;
          "hold_minutes": number;
          "id": string;
          "manual_review_minutes": number;
          "organizer_profile_id": string;
          "payment_due_at": string | null;
          "payment_mode": string;
          "payment_timing": string;
          "price_amount": number;
          "registration_closes_at": string;
          "starts_at": string;
          "status": string;
          "timezone": string;
          "title": string;
          "updated_at": string;
          "venue_booking_status": string;
          "venue_id": string | null;
          "venue_snapshot": NonNullable<Json>;
          "version": number;
          "visibility": string;
          "workspace_id": string;
        };
        ComputedFields: never;
        Insert: {
          "activity_type_id": string;
          "archived_at"?: string | null;
          "cancellation_policy"?: NonNullable<Json>;
          "capacity": number;
          "community_id"?: string | null;
          "contribution_mode"?: string;
          "contributions_locked_at"?: string | null;
          "contributions_locked_by"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "description"?: string;
          "ends_at": string;
          "estimated_total_cost"?: number;
          "hold_minutes"?: number;
          "id"?: string;
          "manual_review_minutes"?: number;
          "organizer_profile_id": string;
          "payment_due_at"?: string | null;
          "payment_mode"?: string;
          "payment_timing"?: string;
          "price_amount"?: number;
          "registration_closes_at": string;
          "starts_at": string;
          "status"?: string;
          "timezone"?: string;
          "title": string;
          "updated_at"?: string;
          "venue_booking_status"?: string;
          "venue_id"?: string | null;
          "venue_snapshot"?: NonNullable<Json>;
          "version"?: number;
          "visibility"?: string;
          "workspace_id": string;
        };
        Update: {
          "activity_type_id"?: string;
          "archived_at"?: string | null;
          "cancellation_policy"?: NonNullable<Json>;
          "capacity"?: number;
          "community_id"?: string | null;
          "contribution_mode"?: string;
          "contributions_locked_at"?: string | null;
          "contributions_locked_by"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "description"?: string;
          "ends_at"?: string;
          "estimated_total_cost"?: number;
          "hold_minutes"?: number;
          "id"?: string;
          "manual_review_minutes"?: number;
          "organizer_profile_id"?: string;
          "payment_due_at"?: string | null;
          "payment_mode"?: string;
          "payment_timing"?: string;
          "price_amount"?: number;
          "registration_closes_at"?: string;
          "starts_at"?: string;
          "status"?: string;
          "timezone"?: string;
          "title"?: string;
          "updated_at"?: string;
          "venue_booking_status"?: string;
          "venue_id"?: string | null;
          "venue_snapshot"?: NonNullable<Json>;
          "version"?: number;
          "visibility"?: string;
          "workspace_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_activity_type_id_fkey";
            columns: ["activity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_contributions_locked_by_fkey";
            columns: ["contributions_locked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_organizer_profile_id_fkey";
            columns: ["organizer_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      "guest_sessions": {
        Row: {
          "created_at": string;
          "expires_at": string;
          "id": string;
          "revoked_at": string | null;
          "scope": string;
          "scope_event_id": string;
          "token_hash": string;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "expires_at": string;
          "id"?: string;
          "revoked_at"?: string | null;
          "scope"?: string;
          "scope_event_id": string;
          "token_hash": string;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "created_at"?: string;
          "expires_at"?: string;
          "id"?: string;
          "revoked_at"?: string | null;
          "scope"?: string;
          "scope_event_id"?: string;
          "token_hash"?: string;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_sessions_scope_event_id_fkey";
            columns: ["scope_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guest_sessions_scope_event_id_fkey";
            columns: ["scope_event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guest_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      "idempotency_records": {
        Row: {
          "actor_scope": string;
          "created_at": string;
          "expires_at": string;
          "id": string;
          "key": string;
          "request_hash": string;
          "response": NonNullable<Json>;
          "route": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "actor_scope": string;
          "created_at"?: string;
          "expires_at": string;
          "id"?: string;
          "key": string;
          "request_hash": string;
          "response": NonNullable<Json>;
          "route": string;
          "updated_at"?: string;
        };
        Update: {
          "actor_scope"?: string;
          "created_at"?: string;
          "expires_at"?: string;
          "id"?: string;
          "key"?: string;
          "request_hash"?: string;
          "response"?: NonNullable<Json>;
          "route"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "identity_claims": {
        Row: {
          "auth_user_id": string;
          "challenge_id": string;
          "created_at": string;
          "expires_at": string;
          "id": string;
          "resolved_at": string | null;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "auth_user_id": string;
          "challenge_id": string;
          "created_at"?: string;
          "expires_at": string;
          "id"?: string;
          "resolved_at"?: string | null;
          "status"?: string;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "auth_user_id"?: string;
          "challenge_id"?: string;
          "created_at"?: string;
          "expires_at"?: string;
          "id"?: string;
          "resolved_at"?: string | null;
          "status"?: string;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identity_claims_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: true;
            referencedRelation: "verification_challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "identity_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      "invoices": {
        Row: {
          "amount_due": number;
          "created_at": string;
          "currency": string;
          "due_at": string;
          "id": string;
          "invoice_number": string;
          "participant_id": string;
          "pricing_snapshot": NonNullable<Json>;
          "status": string;
          "updated_at": string;
          "waiver_reason": string | null;
        };
        ComputedFields: never;
        Insert: {
          "amount_due": number;
          "created_at"?: string;
          "currency"?: string;
          "due_at": string;
          "id"?: string;
          "invoice_number"?: string;
          "participant_id": string;
          "pricing_snapshot": NonNullable<Json>;
          "status"?: string;
          "updated_at"?: string;
          "waiver_reason"?: string | null;
        };
        Update: {
          "amount_due"?: number;
          "created_at"?: string;
          "currency"?: string;
          "due_at"?: string;
          "id"?: string;
          "invoice_number"?: string;
          "participant_id"?: string;
          "pricing_snapshot"?: NonNullable<Json>;
          "status"?: string;
          "updated_at"?: string;
          "waiver_reason"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: true;
            referencedRelation: "event_participants";
            referencedColumns: ["id"];
          },
        ];
      };
      "manual_event_methods": {
        Row: {
          "enabled": boolean;
          "event_id": string;
          "method_id": string;
        };
        ComputedFields: never;
        Insert: {
          "enabled"?: boolean;
          "event_id": string;
          "method_id": string;
        };
        Update: {
          "enabled"?: boolean;
          "event_id"?: string;
          "method_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_event_methods_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_event_methods_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_event_methods_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "organizer_payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      "manual_payment_records": {
        Row: {
          "amount": number;
          "charge_id": string;
          "created_at": string;
          "id": string;
          "idempotency_key": string;
          "method_id": string;
          "paid_at": string;
          "proof_storage_path": string | null;
          "reason": string | null;
          "recorded_by": string | null;
          "status": string;
          "verified_at": string | null;
          "verified_by": string | null;
        };
        ComputedFields: never;
        Insert: {
          "amount": number;
          "charge_id": string;
          "created_at"?: string;
          "id"?: string;
          "idempotency_key": string;
          "method_id": string;
          "paid_at"?: string;
          "proof_storage_path"?: string | null;
          "reason"?: string | null;
          "recorded_by"?: string | null;
          "status"?: string;
          "verified_at"?: string | null;
          "verified_by"?: string | null;
        };
        Update: {
          "amount"?: number;
          "charge_id"?: string;
          "created_at"?: string;
          "id"?: string;
          "idempotency_key"?: string;
          "method_id"?: string;
          "paid_at"?: string;
          "proof_storage_path"?: string | null;
          "reason"?: string | null;
          "recorded_by"?: string | null;
          "status"?: string;
          "verified_at"?: string | null;
          "verified_by"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "manual_payment_records_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: false;
            referencedRelation: "participant_charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_payment_records_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "organizer_payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_payment_records_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "manual_payment_records_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "organizer_payment_methods": {
        Row: {
          "bank_details": Json | null;
          "created_at": string;
          "id": string;
          "is_active": boolean;
          "organizer_id": string;
          "recipient_name": string;
          "storage_path": string | null;
          "type": string;
        };
        ComputedFields: never;
        Insert: {
          "bank_details"?: Json | null;
          "created_at"?: string;
          "id"?: string;
          "is_active"?: boolean;
          "organizer_id": string;
          "recipient_name": string;
          "storage_path"?: string | null;
          "type": string;
        };
        Update: {
          "bank_details"?: Json | null;
          "created_at"?: string;
          "id"?: string;
          "is_active"?: boolean;
          "organizer_id"?: string;
          "recipient_name"?: string;
          "storage_path"?: string | null;
          "type"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizer_payment_methods_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "outbox_jobs": {
        Row: {
          "aggregate_id": string;
          "attempts": number;
          "created_at": string;
          "dedupe_key": string;
          "id": string;
          "kind": string;
          "locked_until": string | null;
          "next_attempt_at": string;
          "payload": NonNullable<Json>;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "aggregate_id": string;
          "attempts"?: number;
          "created_at"?: string;
          "dedupe_key": string;
          "id"?: string;
          "kind": string;
          "locked_until"?: string | null;
          "next_attempt_at"?: string;
          "payload"?: NonNullable<Json>;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "aggregate_id"?: string;
          "attempts"?: number;
          "created_at"?: string;
          "dedupe_key"?: string;
          "id"?: string;
          "kind"?: string;
          "locked_until"?: string | null;
          "next_attempt_at"?: string;
          "payload"?: NonNullable<Json>;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "participant_charges": {
        Row: {
          "amount": number;
          "currency": string;
          "id": string;
          "locked_at": string;
          "locked_by": string;
          "participant_id": string;
        };
        ComputedFields: never;
        Insert: {
          "amount": number;
          "currency"?: string;
          "id"?: string;
          "locked_at"?: string;
          "locked_by": string;
          "participant_id": string;
        };
        Update: {
          "amount"?: number;
          "currency"?: string;
          "id"?: string;
          "locked_at"?: string;
          "locked_by"?: string;
          "participant_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participant_charges_locked_by_fkey";
            columns: ["locked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "participant_charges_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: true;
            referencedRelation: "event_participants";
            referencedColumns: ["id"];
          },
        ];
      };
      "participant_history": {
        Row: {
          "actor_id": string | null;
          "actor_type": string;
          "created_at": string;
          "from_status": string | null;
          "id": string;
          "participant_id": string;
          "reason": string | null;
          "to_status": string;
        };
        ComputedFields: never;
        Insert: {
          "actor_id"?: string | null;
          "actor_type"?: string;
          "created_at"?: string;
          "from_status"?: string | null;
          "id"?: string;
          "participant_id": string;
          "reason"?: string | null;
          "to_status": string;
        };
        Update: {
          "actor_id"?: string | null;
          "actor_type"?: string;
          "created_at"?: string;
          "from_status"?: string | null;
          "id"?: string;
          "participant_id"?: string;
          "reason"?: string | null;
          "to_status"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participant_history_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "event_participants";
            referencedColumns: ["id"];
          },
        ];
      };
      "payment_attempts": {
        Row: {
          "amount": number;
          "checkout_url": string | null;
          "created_at": string;
          "currency": string;
          "exception_reason": string | null;
          "expires_at": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider": string | null;
          "provider_reference": string | null;
          "review_deadline": string | null;
          "review_reason": string | null;
          "reviewed_by": string | null;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "amount": number;
          "checkout_url"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "exception_reason"?: string | null;
          "expires_at"?: string | null;
          "id"?: string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider"?: string | null;
          "provider_reference"?: string | null;
          "review_deadline"?: string | null;
          "review_reason"?: string | null;
          "reviewed_by"?: string | null;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "amount"?: number;
          "checkout_url"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "exception_reason"?: string | null;
          "expires_at"?: string | null;
          "id"?: string;
          "idempotency_key"?: string;
          "invoice_id"?: string;
          "method_type"?: string;
          "payment_method_id"?: string;
          "provider"?: string | null;
          "provider_reference"?: string | null;
          "review_deadline"?: string | null;
          "review_reason"?: string | null;
          "reviewed_by"?: string | null;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_attempts_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_attempts_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "event_payment_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_attempts_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "payment_evidence": {
        Row: {
          "attempt_id": string;
          "created_at": string;
          "id": string;
          "mime_type": string;
          "reviewed_at": string | null;
          "size_bytes": number;
          "storage_path": string;
          "submitted_by_user_id": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "attempt_id": string;
          "created_at"?: string;
          "id"?: string;
          "mime_type": string;
          "reviewed_at"?: string | null;
          "size_bytes": number;
          "storage_path": string;
          "submitted_by_user_id": string;
          "updated_at"?: string;
        };
        Update: {
          "attempt_id"?: string;
          "created_at"?: string;
          "id"?: string;
          "mime_type"?: string;
          "reviewed_at"?: string | null;
          "size_bytes"?: number;
          "storage_path"?: string;
          "submitted_by_user_id"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_evidence_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "payment_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_evidence_submitted_by_user_id_fkey";
            columns: ["submitted_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      "payment_ledger": {
        Row: {
          "amount": number;
          "attempt_id": string | null;
          "created_at": string;
          "currency": string;
          "entry_type": string;
          "id": string;
          "invoice_id": string;
          "occurred_at": string;
          "source_reference": string;
        };
        ComputedFields: never;
        Insert: {
          "amount": number;
          "attempt_id"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "entry_type": string;
          "id"?: string;
          "invoice_id": string;
          "occurred_at"?: string;
          "source_reference": string;
        };
        Update: {
          "amount"?: number;
          "attempt_id"?: string | null;
          "created_at"?: string;
          "currency"?: string;
          "entry_type"?: string;
          "id"?: string;
          "invoice_id"?: string;
          "occurred_at"?: string;
          "source_reference"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_ledger_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "payment_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_ledger_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      "private_uploads": {
        Row: {
          "attached_at": string | null;
          "attachment_id": string | null;
          "attachment_type": string | null;
          "charge_id": string | null;
          "cleanup_attempts": number;
          "cleanup_started_at": string | null;
          "content_type": string | null;
          "created_at": string;
          "expires_at": string;
          "owner_profile_id": string | null;
          "purpose": string;
          "size_bytes": number | null;
          "storage_reference": string;
        };
        ComputedFields: never;
        Insert: {
          "attached_at"?: string | null;
          "attachment_id"?: string | null;
          "attachment_type"?: string | null;
          "charge_id"?: string | null;
          "cleanup_attempts"?: number;
          "cleanup_started_at"?: string | null;
          "content_type"?: string | null;
          "created_at"?: string;
          "expires_at"?: string;
          "owner_profile_id"?: string | null;
          "purpose": string;
          "size_bytes"?: number | null;
          "storage_reference": string;
        };
        Update: {
          "attached_at"?: string | null;
          "attachment_id"?: string | null;
          "attachment_type"?: string | null;
          "charge_id"?: string | null;
          "cleanup_attempts"?: number;
          "cleanup_started_at"?: string | null;
          "content_type"?: string | null;
          "created_at"?: string;
          "expires_at"?: string;
          "owner_profile_id"?: string | null;
          "purpose"?: string;
          "size_bytes"?: number | null;
          "storage_reference"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "private_uploads_charge_id_fkey";
            columns: ["charge_id"];
            isOneToOne: false;
            referencedRelation: "participant_charges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "private_uploads_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "profile_stats": {
        Row: {
          "computed_at": string;
          "metric_key": string;
          "metric_value": number;
          "period_days": number;
          "period_start": string;
          "profile_id": string;
          "rule_version": number;
          "timezone": string;
        };
        ComputedFields: never;
        Insert: {
          "computed_at"?: string;
          "metric_key": string;
          "metric_value": number;
          "period_days": number;
          "period_start": string;
          "profile_id": string;
          "rule_version": number;
          "timezone": string;
        };
        Update: {
          "computed_at"?: string;
          "metric_key"?: string;
          "metric_value"?: number;
          "period_days"?: number;
          "period_start"?: string;
          "profile_id"?: string;
          "rule_version"?: number;
          "timezone"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_stats_metric_key_rule_version_fkey";
            columns: ["metric_key", "rule_version"];
            isOneToOne: false;
            referencedRelation: "stats_metric_definitions";
            referencedColumns: ["metric_key", "rule_version"];
          },
          {
            foreignKeyName: "profile_stats_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "profiles": {
        Row: {
          "auth_provider": string;
          "avatar_path": string | null;
          "bio": string | null;
          "created_at": string;
          "default_timezone": string;
          "id": string;
          "is_private": boolean;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "auth_provider"?: string;
          "avatar_path"?: string | null;
          "bio"?: string | null;
          "created_at"?: string;
          "default_timezone"?: string;
          "id": string;
          "is_private"?: boolean;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "auth_provider"?: string;
          "avatar_path"?: string | null;
          "bio"?: string | null;
          "created_at"?: string;
          "default_timezone"?: string;
          "id"?: string;
          "is_private"?: boolean;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      "rate_limit_counters": {
        Row: {
          "bucket_key": string;
          "count": number;
          "created_at": string;
          "expires_at": string;
          "id": string;
          "updated_at": string;
          "window_start": string;
        };
        ComputedFields: never;
        Insert: {
          "bucket_key": string;
          "count": number;
          "created_at"?: string;
          "expires_at": string;
          "id"?: string;
          "updated_at"?: string;
          "window_start": string;
        };
        Update: {
          "bucket_key"?: string;
          "count"?: number;
          "created_at"?: string;
          "expires_at"?: string;
          "id"?: string;
          "updated_at"?: string;
          "window_start"?: string;
        };
        Relationships: [];
      };
      "recommendation_feedback_events": {
        Row: {
          "action": string;
          "created_at": string;
          "event_id": string;
          "id": string;
          "idempotency_key": string;
          "profile_id": string;
          "ranking_version": number;
        };
        ComputedFields: never;
        Insert: {
          "action": string;
          "created_at"?: string;
          "event_id": string;
          "id"?: string;
          "idempotency_key": string;
          "profile_id": string;
          "ranking_version": number;
        };
        Update: {
          "action"?: string;
          "created_at"?: string;
          "event_id"?: string;
          "id"?: string;
          "idempotency_key"?: string;
          "profile_id"?: string;
          "ranking_version"?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_feedback_events_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "public_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_feedback_events_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "recommendation_preferences": {
        Row: {
          "activity_type_ids": (string)[];
          "coarse_region_code": string | null;
          "consented_at": string | null;
          "opted_out": boolean;
          "personalization_enabled": boolean;
          "profile_id": string;
          "updated_at": string;
          "weekdays": (number)[];
        };
        ComputedFields: never;
        Insert: {
          "activity_type_ids"?: (string)[];
          "coarse_region_code"?: string | null;
          "consented_at"?: string | null;
          "opted_out"?: boolean;
          "personalization_enabled"?: boolean;
          "profile_id": string;
          "updated_at"?: string;
          "weekdays"?: (number)[];
        };
        Update: {
          "activity_type_ids"?: (string)[];
          "coarse_region_code"?: string | null;
          "consented_at"?: string | null;
          "opted_out"?: boolean;
          "personalization_enabled"?: boolean;
          "profile_id"?: string;
          "updated_at"?: string;
          "weekdays"?: (number)[];
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "refunds": {
        Row: {
          "amount": number;
          "approved_by": string | null;
          "attempt_id": string;
          "created_at": string;
          "evidence_path": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "provider_reference": string | null;
          "reason": string;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "amount": number;
          "approved_by"?: string | null;
          "attempt_id": string;
          "created_at"?: string;
          "evidence_path"?: string | null;
          "id"?: string;
          "idempotency_key": string;
          "invoice_id": string;
          "provider_reference"?: string | null;
          "reason": string;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "amount"?: number;
          "approved_by"?: string | null;
          "attempt_id"?: string;
          "created_at"?: string;
          "evidence_path"?: string | null;
          "id"?: string;
          "idempotency_key"?: string;
          "invoice_id"?: string;
          "provider_reference"?: string | null;
          "reason"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "payment_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      "social_blocks": {
        Row: {
          "blocked_profile_id": string;
          "blocker_profile_id": string;
          "created_at": string;
        };
        ComputedFields: never;
        Insert: {
          "blocked_profile_id": string;
          "blocker_profile_id": string;
          "created_at"?: string;
        };
        Update: {
          "blocked_profile_id"?: string;
          "blocker_profile_id"?: string;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_blocks_blocked_profile_id_fkey";
            columns: ["blocked_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_blocks_blocker_profile_id_fkey";
            columns: ["blocker_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "social_follows": {
        Row: {
          "created_at": string;
          "followed_profile_id": string;
          "follower_profile_id": string;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "followed_profile_id": string;
          "follower_profile_id": string;
          "status": string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "followed_profile_id"?: string;
          "follower_profile_id"?: string;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_follows_followed_profile_id_fkey";
            columns: ["followed_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_follows_follower_profile_id_fkey";
            columns: ["follower_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "social_reports": {
        Row: {
          "created_at": string;
          "details": string;
          "id": string;
          "reason": string;
          "reported_profile_id": string;
          "reporter_profile_id": string;
          "status": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason": string;
          "reported_profile_id": string;
          "reporter_profile_id": string;
          "status"?: string;
        };
        Update: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason"?: string;
          "reported_profile_id"?: string;
          "reporter_profile_id"?: string;
          "status"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_reports_reported_profile_id_fkey";
            columns: ["reported_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_reports_reporter_profile_id_fkey";
            columns: ["reporter_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "stats_metric_definitions": {
        Row: {
          "created_at": string;
          "label": string;
          "metric_key": string;
          "rule_version": number;
          "source_kind": string;
          "source_table": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "label": string;
          "metric_key": string;
          "rule_version": number;
          "source_kind": string;
          "source_table": string;
        };
        Update: {
          "created_at"?: string;
          "label"?: string;
          "metric_key"?: string;
          "rule_version"?: number;
          "source_kind"?: string;
          "source_table"?: string;
        };
        Relationships: [];
      };
      "users": {
        Row: {
          "created_at": string;
          "display_name": string;
          "id": string;
          "phone_normalized": string | null;
          "phone_verified_at": string | null;
          "state": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "display_name": string;
          "id"?: string;
          "phone_normalized"?: string | null;
          "phone_verified_at"?: string | null;
          "state"?: string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "display_name"?: string;
          "id"?: string;
          "phone_normalized"?: string | null;
          "phone_verified_at"?: string | null;
          "state"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "venues": {
        Row: {
          "address": string;
          "city": string;
          "created_at": string;
          "created_by": string;
          "id": string;
          "latitude": number | null;
          "longitude": number | null;
          "maps_url": string;
          "name": string;
          "place_id": string | null;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "address": string;
          "city": string;
          "created_at"?: string;
          "created_by": string;
          "id"?: string;
          "latitude"?: number | null;
          "longitude"?: number | null;
          "maps_url": string;
          "name": string;
          "place_id"?: string | null;
          "updated_at"?: string;
        };
        Update: {
          "address"?: string;
          "city"?: string;
          "created_at"?: string;
          "created_by"?: string;
          "id"?: string;
          "latitude"?: number | null;
          "longitude"?: number | null;
          "maps_url"?: string;
          "name"?: string;
          "place_id"?: string | null;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "verification_challenges": {
        Row: {
          "attempts": number;
          "auth_user_id": string | null;
          "consumed_at": string | null;
          "created_at": string;
          "expires_at": string;
          "id": string;
          "phone_normalized": string;
          "provider_ref": string | null;
          "purpose": string;
          "secret_hash": string | null;
          "updated_at": string;
          "verified_at": string | null;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "auth_user_id"?: string | null;
          "consumed_at"?: string | null;
          "created_at"?: string;
          "expires_at": string;
          "id"?: string;
          "phone_normalized": string;
          "provider_ref"?: string | null;
          "purpose": string;
          "secret_hash"?: string | null;
          "updated_at"?: string;
          "verified_at"?: string | null;
        };
        Update: {
          "attempts"?: number;
          "auth_user_id"?: string | null;
          "consumed_at"?: string | null;
          "created_at"?: string;
          "expires_at"?: string;
          "id"?: string;
          "phone_normalized"?: string;
          "provider_ref"?: string | null;
          "purpose"?: string;
          "secret_hash"?: string | null;
          "updated_at"?: string;
          "verified_at"?: string | null;
        };
        Relationships: [];
      };
      "webhook_events": {
        Row: {
          "created_at": string;
          "external_event_id": string;
          "id": string;
          "payload_hash": string;
          "payload_private": Json | null;
          "processed_at": string | null;
          "provider": string;
          "retry_count": number;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "external_event_id": string;
          "id"?: string;
          "payload_hash": string;
          "payload_private"?: Json | null;
          "processed_at"?: string | null;
          "provider": string;
          "retry_count"?: number;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "external_event_id"?: string;
          "id"?: string;
          "payload_hash"?: string;
          "payload_private"?: Json | null;
          "processed_at"?: string | null;
          "provider"?: string;
          "retry_count"?: number;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "workspace_members": {
        Row: {
          "created_at": string;
          "profile_id": string;
          "role": string;
          "updated_at": string;
          "workspace_id": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "profile_id": string;
          "role": string;
          "updated_at"?: string;
          "workspace_id": string;
        };
        Update: {
          "created_at"?: string;
          "profile_id"?: string;
          "role"?: string;
          "updated_at"?: string;
          "workspace_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      "workspaces": {
        Row: {
          "created_at": string;
          "created_by_profile_id": string;
          "id": string;
          "name": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "created_by_profile_id": string;
          "id"?: string;
          "name": string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "created_by_profile_id"?: string;
          "id"?: string;
          "name"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_profile_id_fkey";
            columns: ["created_by_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      "public_events": {
        Row: {
          "activity_type_id": string;
          "capacity": number;
          "currency": string;
          "description": string;
          "ends_at": string;
          "id": string;
          "participants_count": number | null;
          "price_amount": number;
          "starts_at": string;
          "status": string;
          "timezone": string;
          "title": string;
          "venue": Json | null;
        };
        ComputedFields: never;
        Insert: {
          "activity_type_id"?: string | null;
          "capacity"?: number | null;
          "currency"?: string | null;
          "description"?: string | null;
          "ends_at"?: string | null;
          "id"?: string | null;
          "participants_count"?: never;
          "price_amount"?: number | null;
          "starts_at"?: string | null;
          "status"?: string | null;
          "timezone"?: string | null;
          "title"?: string | null;
          "venue"?: never;
        };
        Update: {
          "activity_type_id"?: string | null;
          "capacity"?: number | null;
          "currency"?: string | null;
          "description"?: string | null;
          "ends_at"?: string | null;
          "id"?: string | null;
          "participants_count"?: never;
          "price_amount"?: number | null;
          "starts_at"?: string | null;
          "status"?: string | null;
          "timezone"?: string | null;
          "title"?: string | null;
          "venue"?: never;
        };
        Relationships: [
          {
            foreignKeyName: "events_activity_type_id_fkey";
            columns: ["activity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_types";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      "activity_photo_moderation_queue": {
        Args: { "p_actor": string; "p_limit"?: number };
        Returns: Json[];
      };
      "adjust_contribution": {
        Args: {
          "p_actor": string;
          "p_amount": number;
          "p_charge": string;
          "p_key": string;
          "p_reason": string;
          "p_type": string;
        };
        Returns: {
          "actor_id": string;
          "amount": number;
          "charge_id": string;
          "created_at": string;
          "entry_type": string;
          "id": string;
          "idempotency_key": string;
          "payment_id": string | null;
          "reason": string;
        };
        SetofOptions: {
          from: "*";
          to: "contribution_ledger";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "apply_provider_payment": {
        Args: {
          "p_amount": number;
          "p_attempt_id": string;
          "p_currency": string;
          "p_provider": string;
          "p_provider_reference": string;
        };
        Returns: {
          "amount": number;
          "checkout_url": string | null;
          "created_at": string;
          "currency": string;
          "exception_reason": string | null;
          "expires_at": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider": string | null;
          "provider_reference": string | null;
          "review_deadline": string | null;
          "review_reason": string | null;
          "reviewed_by": string | null;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "payment_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "approve_manual_payment": {
        Args: {
          "p_actor_profile_id": string;
          "p_attempt_id": string;
          "p_decision": string;
          "p_reason": string;
        };
        Returns: {
          "amount": number;
          "checkout_url": string | null;
          "created_at": string;
          "currency": string;
          "exception_reason": string | null;
          "expires_at": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider": string | null;
          "provider_reference": string | null;
          "review_deadline": string | null;
          "review_reason": string | null;
          "reviewed_by": string | null;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "payment_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "assert_community_event_creator": {
        Args: { "p_actor": string; "p_community": string };
        Returns: undefined;
      };
      "assign_contribution": {
        Args: {
          "p_actor": string;
          "p_amount": number;
          "p_participant": string;
        };
        Returns: {
          "amount": number;
          "currency": string;
          "id": string;
          "locked_at": string;
          "locked_by": string;
          "participant_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "participant_charges";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "attach_activity_photo": {
        Args: {
          "p_activity": string;
          "p_actor": string;
          "p_consented_at": string;
          "p_content_type": string;
          "p_height": number;
          "p_size": number;
          "p_upload": string;
          "p_width": number;
        };
        Returns: {
          "activity_id": string;
          "consented_at": string;
          "content_type": string;
          "created_at": string;
          "deleted_at": string | null;
          "height": number;
          "id": string;
          "moderation_status": string;
          "size_bytes": number;
          "storage_reference": string | null;
          "uploader_profile_id": string;
          "width": number;
        };
        SetofOptions: {
          from: "*";
          to: "activity_photos";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "bootstrap_google_profile": {
        Args: Record<PropertyKey, never>;
        Returns: {
          "auth_provider": string;
          "avatar_path": string | null;
          "bio": string | null;
          "created_at": string;
          "default_timezone": string;
          "id": string;
          "is_private": boolean;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "can_view_activity": {
        Args: { "p_activity": string; "p_actor": string };
        Returns: boolean;
      };
      "cancel_dynamic_event": {
        Args: {
          "p_actor": string;
          "p_event": string;
          "p_key": string;
          "p_policy": string;
          "p_reason": string;
        };
        Returns: undefined;
      };
      "cancel_dynamic_participant": {
        Args: {
          "p_actor": string;
          "p_guest_hash": string;
          "p_key": string;
          "p_participant": string;
          "p_policy": string;
          "p_reason": string;
        };
        Returns: undefined;
      };
      "cancel_event": {
        Args: {
          "p_actor_profile_id": string;
          "p_event_id": string;
          "p_reason": string;
        };
        Returns: undefined;
      };
      "cancel_own_dynamic_participation": {
        Args: {
          "p_actor": string;
          "p_event": string;
          "p_guest_hash": string;
          "p_reason": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "cancel_participation": {
        Args: {
          "p_actor_profile_id"?: string;
          "p_guest_session_hash"?: string;
          "p_participant_id": string;
          "p_reason": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "claim_expired_private_uploads": {
        Args: { "p_limit"?: number };
        Returns: {
          "attached_at": string | null;
          "attachment_id": string | null;
          "attachment_type": string | null;
          "charge_id": string | null;
          "cleanup_attempts": number;
          "cleanup_started_at": string | null;
          "content_type": string | null;
          "created_at": string;
          "expires_at": string;
          "owner_profile_id": string | null;
          "purpose": string;
          "size_bytes": number | null;
          "storage_reference": string;
        }[];
        SetofOptions: {
          from: "*";
          to: "private_uploads";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      "claim_guest_identity": {
        Args: { "p_auth_user_id": string; "p_challenge_id": string };
        Returns: {
          "auth_provider": string;
          "avatar_path": string | null;
          "bio": string | null;
          "created_at": string;
          "default_timezone": string;
          "id": string;
          "is_private": boolean;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "close_expired_challenges": {
        Args: { "p_limit"?: number };
        Returns: number;
      };
      "consume_guest_booking_limits": {
        Args: {
          "p_contact_hash": string;
          "p_event": string;
          "p_ip_hash": string;
        };
        Returns: {
          "allowed": boolean;
          "retry_after_seconds": number;
        }[];
      };
      "create_achievement_definition": {
        Args: {
          "p_code": string;
          "p_description": string;
          "p_threshold": number;
          "p_title": string;
        };
        Returns: {
          "active": boolean;
          "code": string;
          "created_at": string;
          "description": string;
          "id": string;
          "metric": string;
          "rule_version": number;
          "threshold": number;
          "title": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "achievement_definitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_billed_event": {
        Args: {
          "p_activity_type": string;
          "p_actor": string;
          "p_capacity": number;
          "p_description": string;
          "p_ends_at": string;
          "p_hold_minutes"?: number;
          "p_payment_due_at"?: string;
          "p_payment_method"?: string;
          "p_payment_mode": string;
          "p_price_amount": number;
          "p_registration_closes_at": string;
          "p_starts_at": string;
          "p_timezone": string;
          "p_title": string;
          "p_venue_snapshot": Json;
          "p_visibility": string;
          "p_workspace": string;
        };
        Returns: {
          "activity_type_id": string;
          "archived_at": string | null;
          "cancellation_policy": NonNullable<Json>;
          "capacity": number;
          "community_id": string | null;
          "contribution_mode": string;
          "contributions_locked_at": string | null;
          "contributions_locked_by": string | null;
          "created_at": string;
          "currency": string;
          "description": string;
          "ends_at": string;
          "estimated_total_cost": number;
          "hold_minutes": number;
          "id": string;
          "manual_review_minutes": number;
          "organizer_profile_id": string;
          "payment_due_at": string | null;
          "payment_mode": string;
          "payment_timing": string;
          "price_amount": number;
          "registration_closes_at": string;
          "starts_at": string;
          "status": string;
          "timezone": string;
          "title": string;
          "updated_at": string;
          "venue_booking_status": string;
          "venue_id": string | null;
          "venue_snapshot": NonNullable<Json>;
          "version": number;
          "visibility": string;
          "workspace_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_challenge": {
        Args: {
          "p_actor": string;
          "p_description": string;
          "p_eligibility"?: Json;
          "p_ends_on": string;
          "p_starts_on": string;
          "p_target": number;
          "p_timezone": string;
          "p_title": string;
        };
        Returns: {
          "created_at": string;
          "description": string;
          "eligibility": NonNullable<Json>;
          "ends_on": string;
          "id": string;
          "metric": string;
          "owner_profile_id": string;
          "rule_version": number;
          "starts_on": string;
          "status": string;
          "target": number;
          "timezone": string;
          "title": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "challenges";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_community": {
        Args: {
          "p_actor": string;
          "p_description": string;
          "p_name": string;
          "p_slug": string;
          "p_visibility": string;
        };
        Returns: Json;
      };
      "create_event_invite": {
        Args: {
          "p_actor": string;
          "p_event": string;
          "p_expires_at"?: string;
          "p_token_hash": string;
        };
        Returns: {
          "created_at": string;
          "created_by": string;
          "event_id": string;
          "expires_at": string | null;
          "id": string;
          "revoked_at": string | null;
          "token_hash": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_invites";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_guest_booking": {
        Args: {
          "p_display_name": string;
          "p_event": string;
          "p_phone_normalized": string;
          "p_token_hash": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_organizer_payment_method": {
        Args: {
          "p_actor": string;
          "p_bank_details"?: Json;
          "p_recipient_name": string;
          "p_storage_reference"?: string;
          "p_type": string;
        };
        Returns: {
          "bank_details": Json | null;
          "created_at": string;
          "id": string;
          "is_active": boolean;
          "organizer_id": string;
          "recipient_name": string;
          "storage_path": string | null;
          "type": string;
        };
        SetofOptions: {
          from: "*";
          to: "organizer_payment_methods";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "create_payment_attempt": {
        Args: {
          "p_actor_profile_id"?: string;
          "p_guest_session_hash"?: string;
          "p_invoice_id": string;
          "p_key": string;
          "p_method_id": string;
        };
        Returns: {
          "amount": number;
          "checkout_url": string | null;
          "created_at": string;
          "currency": string;
          "exception_reason": string | null;
          "expires_at": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider": string | null;
          "provider_reference": string | null;
          "review_deadline": string | null;
          "review_reason": string | null;
          "reviewed_by": string | null;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "payment_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "delete_activity": {
        Args: { "p_activity": string; "p_actor": string };
        Returns: boolean;
      };
      "delete_activity_photo": {
        Args: { "p_activity": string; "p_actor": string; "p_photo": string };
        Returns: boolean;
      };
      "discover_communities": { Args: { "p_actor"?: string }; Returns: Json[] };
      "edit_activity": {
        Args: {
          "p_activity": string;
          "p_actor": string;
          "p_body": string;
          "p_community"?: string;
          "p_visibility": string;
        };
        Returns: Json;
      };
      "expire_holds": { Args: { "p_event_id": string }; Returns: number };
      "get_activity_feed": {
        Args: {
          "p_actor": string;
          "p_before_created_at"?: string;
          "p_before_id"?: string;
          "p_limit"?: number;
        };
        Returns: Json[];
      };
      "get_activity_photos": {
        Args: { "p_activity": string; "p_actor": string };
        Returns: Json[];
      };
      "get_challenge_progress": {
        Args: { "p_actor": string; "p_challenge": string };
        Returns: {
          "challenge_id": string;
          "completed_at": string | null;
          "joined_at": string;
          "profile_id": string;
          "progress": number;
          "recalculated_at": string | null;
          "status": string;
        };
        SetofOptions: {
          from: "*";
          to: "challenge_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "get_challenges": {
        Args: { "p_actor": string; "p_before"?: string; "p_limit"?: number };
        Returns: Json[];
      };
      "get_community": {
        Args: { "p_actor": string; "p_slug": string };
        Returns: Json;
      };
      "get_event_recommendations": {
        Args: { "p_limit"?: number; "p_profile": string };
        Returns: {
          "activity_type_name": string;
          "capacity_remaining": number;
          "event_id": string;
          "rank_score": number;
          "ranking_version": number;
          "reason_labels": (string)[];
          "starts_at": string;
          "title": string;
        }[];
      };
      "get_guest_booking": {
        Args: { "p_event": string; "p_token_hash": string };
        Returns: {
          "confirmed_at": string;
          "hold_expires_at": string;
          "participant_id": string;
          "status": string;
          "updated_at": string;
        }[];
      };
      "get_profile_achievements": {
        Args: { "p_target": string; "p_viewer": string };
        Returns: Json[];
      };
      "get_profile_stats": {
        Args: {
          "p_period_days"?: number;
          "p_period_start": string;
          "p_profile": string;
        };
        Returns: {
          "computed_at": string;
          "label": string;
          "metric_key": string;
          "metric_value": number;
          "period_days": number;
          "period_start": string;
          "rule_version": number;
          "source_kind": string;
          "timezone": string;
        }[];
      };
      "get_recommendation_preferences": {
        Args: { "p_profile": string };
        Returns: Json;
      };
      "invite_community_member": {
        Args: { "p_actor": string; "p_community": string; "p_target": string };
        Returns: undefined;
      };
      "join_challenge": {
        Args: { "p_actor": string; "p_challenge": string };
        Returns: {
          "challenge_id": string;
          "completed_at": string | null;
          "joined_at": string;
          "profile_id": string;
          "progress": number;
          "recalculated_at": string | null;
          "status": string;
        };
        SetofOptions: {
          from: "*";
          to: "challenge_members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "join_community": {
        Args: { "p_actor": string; "p_community": string };
        Returns: string;
      };
      "join_event": {
        Args: {
          "p_actor_profile_id"?: string;
          "p_event_id": string;
          "p_guest_session_hash"?: string;
          "p_user_id": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "leave_challenge": {
        Args: { "p_actor": string; "p_challenge": string };
        Returns: boolean;
      };
      "leave_community": {
        Args: { "p_actor": string; "p_community": string };
        Returns: undefined;
      };
      "link_community_event": {
        Args: { "p_actor": string; "p_community": string; "p_event": string };
        Returns: undefined;
      };
      "lock_contributions": {
        Args: { "p_actor": string; "p_event": string };
        Returns: number;
      };
      "manual_event_access": {
        Args: { "p_actor": string; "p_event": string };
        Returns: undefined;
      };
      "publish_activity": {
        Args: {
          "p_actor": string;
          "p_body": string;
          "p_community"?: string;
          "p_key": string;
          "p_source_event"?: string;
          "p_visibility": string;
        };
        Returns: Json;
      };
      "rebuild_achievement_awards": {
        Args: { "p_profile_ids": (string)[] };
        Returns: Json;
      };
      "rebuild_challenge_progress": {
        Args: {
          "p_after_profile"?: string;
          "p_challenge": string;
          "p_limit"?: number;
        };
        Returns: Json;
      };
      "rebuild_profile_stats": {
        Args: {
          "p_period_days"?: number;
          "p_period_start": string;
          "p_profile": string;
        };
        Returns: undefined;
      };
      "record_event_attendance": {
        Args: {
          "p_actor": string;
          "p_participant": string;
          "p_status": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "record_recommendation_feedback": {
        Args: {
          "p_action": string;
          "p_event": string;
          "p_idempotency_key": string;
          "p_profile": string;
          "p_ranking_version": number;
        };
        Returns: Json;
      };
      "record_refund": {
        Args: {
          "p_actor_profile_id": string;
          "p_evidence_path"?: string;
          "p_reference": string;
          "p_refund_id": string;
        };
        Returns: {
          "amount": number;
          "approved_by": string | null;
          "attempt_id": string;
          "created_at": string;
          "evidence_path": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "provider_reference": string | null;
          "reason": string;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "refunds";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "report_activity": {
        Args: {
          "p_activity": string;
          "p_actor": string;
          "p_details"?: string;
          "p_reason": string;
        };
        Returns: boolean;
      };
      "report_activity_photo": {
        Args: {
          "p_activity": string;
          "p_actor": string;
          "p_details"?: string;
          "p_photo": string;
          "p_reason": string;
        };
        Returns: boolean;
      };
      "report_manual_payment": {
        Args: {
          "p_actor"?: string;
          "p_amount": number;
          "p_charge": string;
          "p_guest_hash"?: string;
          "p_key": string;
          "p_method": string;
          "p_proof"?: string;
        };
        Returns: {
          "amount": number;
          "charge_id": string;
          "created_at": string;
          "id": string;
          "idempotency_key": string;
          "method_id": string;
          "paid_at": string;
          "proof_storage_path": string | null;
          "reason": string | null;
          "recorded_by": string | null;
          "status": string;
          "verified_at": string | null;
          "verified_by": string | null;
        };
        SetofOptions: {
          from: "*";
          to: "manual_payment_records";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "request_refund": {
        Args: {
          "p_actor_profile_id": string;
          "p_amount": number;
          "p_attempt_id": string;
          "p_key": string;
          "p_reason": string;
        };
        Returns: {
          "amount": number;
          "approved_by": string | null;
          "attempt_id": string;
          "created_at": string;
          "evidence_path": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "provider_reference": string | null;
          "reason": string;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "refunds";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "respond_community_invite": {
        Args: { "p_accept": boolean; "p_actor": string; "p_community": string };
        Returns: undefined;
      };
      "review_activity_photo": {
        Args: { "p_action": string; "p_actor": string; "p_photo": string };
        Returns: boolean;
      };
      "review_community_request": {
        Args: {
          "p_actor": string;
          "p_approve": boolean;
          "p_community": string;
          "p_target": string;
        };
        Returns: undefined;
      };
      "review_manual_payment": {
        Args: {
          "p_actor": string;
          "p_decision": string;
          "p_payment": string;
          "p_reason": string;
        };
        Returns: {
          "amount": number;
          "charge_id": string;
          "created_at": string;
          "id": string;
          "idempotency_key": string;
          "method_id": string;
          "paid_at": string;
          "proof_storage_path": string | null;
          "reason": string | null;
          "recorded_by": string | null;
          "status": string;
          "verified_at": string | null;
          "verified_by": string | null;
        };
        SetofOptions: {
          from: "*";
          to: "manual_payment_records";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "revoke_event_invite": {
        Args: { "p_actor": string; "p_invite": string };
        Returns: {
          "created_at": string;
          "created_by": string;
          "event_id": string;
          "expires_at": string | null;
          "id": string;
          "revoked_at": string | null;
          "token_hash": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_invites";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "rotate_guest_booking_token": {
        Args: {
          "p_actor": string;
          "p_participant": string;
          "p_token_hash": string;
        };
        Returns: {
          "attendance_at": string | null;
          "cancellation_reason": string | null;
          "cancelled_at": string | null;
          "chargeable": boolean;
          "confirmed_at": string | null;
          "created_at": string;
          "event_id": string;
          "hold_expires_at": string | null;
          "id": string;
          "joined_as": string;
          "status": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "run_achievement_maintenance": {
        Args: { "p_limit"?: number };
        Returns: Json;
      };
      "run_challenge_maintenance": {
        Args: { "p_limit"?: number };
        Returns: Json;
      };
      "run_payment_maintenance": {
        Args: { "p_limit"?: number };
        Returns: {
          "events_processed": number;
          "participants_expired": number;
        }[];
      };
      "set_community_role": {
        Args: {
          "p_actor": string;
          "p_community": string;
          "p_role": string;
          "p_target": string;
        };
        Returns: undefined;
      };
      "set_organizer_event_archive": {
        Args: {
          "p_actor": string;
          "p_archived": boolean;
          "p_event": string;
        };
        Returns: string;
      };
      "set_recommendation_preferences": {
        Args: {
          "p_activity_type_ids"?: (string)[];
          "p_coarse_region_code"?: string;
          "p_opted_out": boolean;
          "p_personalization_enabled": boolean;
          "p_profile": string;
          "p_weekdays"?: (number)[];
        };
        Returns: Json;
      };
      "social_block": {
        Args: { "p_actor": string; "p_target": string };
        Returns: boolean;
      };
      "social_follow": {
        Args: { "p_actor": string; "p_target": string };
        Returns: string;
      };
      "social_list": {
        Args: {
          "p_actor": string;
          "p_before"?: string;
          "p_kind": string;
          "p_limit"?: number;
        };
        Returns: {
          "avatar_path": string;
          "bio": string;
          "created_at": string;
          "display_name": string;
          "profile_id": string;
          "status": string;
        }[];
      };
      "social_profile": {
        Args: { "p_actor": string; "p_target": string };
        Returns: {
          "avatar_path": string;
          "bio": string;
          "display_name": string;
          "follow_status": string;
          "is_private": boolean;
          "profile_id": string;
        }[];
      };
      "social_report": {
        Args: {
          "p_actor": string;
          "p_details"?: string;
          "p_reason": string;
          "p_target": string;
        };
        Returns: string;
      };
      "social_respond_request": {
        Args: { "p_accept": boolean; "p_actor": string; "p_follower": string };
        Returns: boolean;
      };
      "social_set_privacy": {
        Args: { "p_actor": string; "p_private": boolean };
        Returns: boolean;
      };
      "social_unblock": {
        Args: { "p_actor": string; "p_target": string };
        Returns: boolean;
      };
      "social_unfollow": {
        Args: { "p_actor": string; "p_target": string };
        Returns: boolean;
      };
      "submit_manual_evidence": {
        Args: {
          "p_actor_profile_id"?: string;
          "p_attempt_id": string;
          "p_guest_session_hash"?: string;
          "p_mime": string;
          "p_size": number;
          "p_storage_path": string;
        };
        Returns: {
          "amount": number;
          "checkout_url": string | null;
          "created_at": string;
          "currency": string;
          "exception_reason": string | null;
          "expires_at": string | null;
          "id": string;
          "idempotency_key": string;
          "invoice_id": string;
          "method_type": string;
          "payment_method_id": string;
          "provider": string | null;
          "provider_reference": string | null;
          "review_deadline": string | null;
          "review_reason": string | null;
          "reviewed_by": string | null;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "payment_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "transfer_community_ownership": {
        Args: { "p_actor": string; "p_community": string; "p_target": string };
        Returns: undefined;
      };
      "update_achievement_definition": {
        Args: {
          "p_active": boolean;
          "p_code": string;
          "p_description": string;
          "p_threshold": number;
          "p_title": string;
        };
        Returns: {
          "active": boolean;
          "code": string;
          "created_at": string;
          "description": string;
          "id": string;
          "metric": string;
          "rule_version": number;
          "threshold": number;
          "title": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "achievement_definitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "update_billed_event": {
        Args: {
          "p_actor": string;
          "p_capacity"?: number;
          "p_description"?: string;
          "p_ends_at"?: string;
          "p_event": string;
          "p_expected_version": number;
          "p_registration_closes_at"?: string;
          "p_starts_at"?: string;
          "p_status"?: string;
          "p_title"?: string;
          "p_venue_booking_status"?: string;
          "p_venue_snapshot"?: Json;
        };
        Returns: {
          "activity_type_id": string;
          "archived_at": string | null;
          "cancellation_policy": NonNullable<Json>;
          "capacity": number;
          "community_id": string | null;
          "contribution_mode": string;
          "contributions_locked_at": string | null;
          "contributions_locked_by": string | null;
          "created_at": string;
          "currency": string;
          "description": string;
          "ends_at": string;
          "estimated_total_cost": number;
          "hold_minutes": number;
          "id": string;
          "manual_review_minutes": number;
          "organizer_profile_id": string;
          "payment_due_at": string | null;
          "payment_mode": string;
          "payment_timing": string;
          "price_amount": number;
          "registration_closes_at": string;
          "starts_at": string;
          "status": string;
          "timezone": string;
          "title": string;
          "updated_at": string;
          "venue_booking_status": string;
          "venue_id": string | null;
          "venue_snapshot": NonNullable<Json>;
          "version": number;
          "visibility": string;
          "workspace_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "update_challenge": {
        Args: {
          "p_actor": string;
          "p_challenge": string;
          "p_description": string;
          "p_eligibility"?: Json;
          "p_ends_on": string;
          "p_expected_version": number;
          "p_starts_on": string;
          "p_target": number;
          "p_timezone": string;
          "p_title": string;
        };
        Returns: {
          "created_at": string;
          "description": string;
          "eligibility": NonNullable<Json>;
          "ends_on": string;
          "id": string;
          "metric": string;
          "owner_profile_id": string;
          "rule_version": number;
          "starts_on": string;
          "status": string;
          "target": number;
          "timezone": string;
          "title": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "challenges";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "update_dynamic_event": {
        Args: {
          "p_actor": string;
          "p_capacity"?: number;
          "p_description"?: string;
          "p_ends_at"?: string;
          "p_estimated_total_cost"?: number;
          "p_event": string;
          "p_expected_version": number;
          "p_payment_timing"?: string;
          "p_registration_closes_at"?: string;
          "p_starts_at"?: string;
          "p_status"?: string;
          "p_timezone"?: string;
          "p_title"?: string;
          "p_venue_booking_status"?: string;
          "p_venue_snapshot"?: Json;
        };
        Returns: {
          "activity_type_id": string;
          "archived_at": string | null;
          "cancellation_policy": NonNullable<Json>;
          "capacity": number;
          "community_id": string | null;
          "contribution_mode": string;
          "contributions_locked_at": string | null;
          "contributions_locked_by": string | null;
          "created_at": string;
          "currency": string;
          "description": string;
          "ends_at": string;
          "estimated_total_cost": number;
          "hold_minutes": number;
          "id": string;
          "manual_review_minutes": number;
          "organizer_profile_id": string;
          "payment_due_at": string | null;
          "payment_mode": string;
          "payment_timing": string;
          "price_amount": number;
          "registration_closes_at": string;
          "starts_at": string;
          "status": string;
          "timezone": string;
          "title": string;
          "updated_at": string;
          "venue_booking_status": string;
          "venue_id": string | null;
          "venue_snapshot": NonNullable<Json>;
          "version": number;
          "visibility": string;
          "workspace_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "verify_event_invite": {
        Args: { "p_event": string; "p_token_hash": string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals } ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[
      DefaultSchemaTableNameOrOptions
    ] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  "public": {
    Enums: {},
  },
} as const;
