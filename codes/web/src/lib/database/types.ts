export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LeadStatus =
  | "NEW"
  | "RESEARCHING"
  | "RESEARCHED"
  | "REVIEW_REQUIRED"
  | "QUALIFIED"
  | "PREVIEW_READY"
  | "CONTACTED"
  | "WON"
  | "LOST"
  | "SKIPPED";

export type SourceType =
  | "OFFICIAL_WEBSITE"
  | "GOVERNMENT_DIRECTORY"
  | "MANUAL"
  | "OTHER";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED";

export type TemplateKey = "clinic" | "specialty" | "multispecialty";

export type ContentStatus =
  | "DRAFT"
  | "EN_REVIEW_REQUIRED"
  | "EN_APPROVED"
  | "KN_REVIEW_REQUIRED"
  | "KN_APPROVED"
  | "VALIDATED"
  | "BLOCKED";

export type PreviewStatus = "DRAFT" | "READY" | "DEPLOYED" | "STALE" | "REMOVED";

export type JobType =
  | "collectSources"
  | "extractFacts"
  | "auditWebsite"
  | "scoreLead"
  | "generateContent"
  | "translateContent"
  | "validateClaims"
  | "renderPreview"
  | "deployPreview"
  | "captureScreenshots"
  | "generateOutreachDraft";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export type AnalyticsEvent =
  | "preview_opened"
  | "page_viewed"
  | "call_clicked"
  | "whatsapp_clicked"
  | "directions_clicked"
  | "contact_clicked";

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          hospital_name: string;
          normalized_name: string;
          district: string;
          city: string | null;
          normalized_city: string | null;
          known_phone: string | null;
          known_email: string | null;
          known_website: string | null;
          source_type: SourceType;
          seed_source_url: string | null;
          import_fingerprint: string;
          duplicate_group: string | null;
          duplicate_of: string | null;
          status: LeadStatus;
          digital_gap_score: number | null;
          preview_readiness_score: number | null;
          score_breakdown: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_name: string;
          normalized_name: string;
          district?: string;
          city?: string | null;
          normalized_city?: string | null;
          known_phone?: string | null;
          known_email?: string | null;
          known_website?: string | null;
          source_type?: SourceType;
          seed_source_url?: string | null;
          import_fingerprint: string;
          duplicate_group?: string | null;
          duplicate_of?: string | null;
          status?: LeadStatus;
          digital_gap_score?: number | null;
          preview_readiness_score?: number | null;
          score_breakdown?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          lead_id: string;
          url: string | null;
          source_type: SourceType;
          retrieved_at: string | null;
          http_status: number | null;
          content_hash: string | null;
          raw_text: string | null;
          raw_html: string | null;
          title: string | null;
          raw_text_expires_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          url?: string | null;
          source_type: SourceType;
          retrieved_at?: string | null;
          http_status?: number | null;
          content_hash?: string | null;
          raw_text?: string | null;
          raw_html?: string | null;
          title?: string | null;
          raw_text_expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sources_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      hospital_facts: {
        Row: {
          id: string;
          lead_id: string;
          source_id: string | null;
          fact_type: string;
          value: Json;
          risk_tier: RiskTier;
          source_excerpt: string | null;
          verification_status: VerificationStatus;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          source_id?: string | null;
          fact_type: string;
          value: Json;
          risk_tier: RiskTier;
          source_excerpt?: string | null;
          verification_status?: VerificationStatus;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["hospital_facts"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "hospital_facts_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hospital_facts_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      website_audits: {
        Row: {
          id: string;
          lead_id: string;
          audit_run_id: string;
          website_url: string | null;
          checks: Json;
          digital_gap_score: number;
          preview_readiness_score: number;
          score_breakdown: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          audit_run_id: string;
          website_url?: string | null;
          checks?: Json;
          digital_gap_score?: number;
          preview_readiness_score?: number;
          score_breakdown?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["website_audits"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "website_audits_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_content: {
        Row: {
          id: string;
          lead_id: string;
          template_key: TemplateKey;
          content_en: Json | null;
          content_kn: Json | null;
          status: ContentStatus;
          validation_report: Json;
          en_approved_by: string | null;
          en_approved_at: string | null;
          kn_approved_by: string | null;
          kn_approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          template_key: TemplateKey;
          content_en?: Json | null;
          content_kn?: Json | null;
          status?: ContentStatus;
          validation_report?: Json;
          en_approved_by?: string | null;
          en_approved_at?: string | null;
          kn_approved_by?: string | null;
          kn_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generated_content"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "generated_content_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      previews: {
        Row: {
          id: string;
          lead_id: string;
          generated_content_id: string | null;
          slug: string;
          disclaimer_en: string;
          disclaimer_kn: string | null;
          noindex: boolean;
          deployed_at: string | null;
          stale_after: string | null;
          status: PreviewStatus;
          desktop_screenshot_path: string | null;
          mobile_screenshot_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          generated_content_id?: string | null;
          slug: string;
          disclaimer_en: string;
          disclaimer_kn?: string | null;
          noindex?: boolean;
          deployed_at?: string | null;
          stale_after?: string | null;
          status?: PreviewStatus;
          desktop_screenshot_path?: string | null;
          mobile_screenshot_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["previews"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "previews_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "previews_generated_content_id_fkey";
            columns: ["generated_content_id"];
            isOneToOne: false;
            referencedRelation: "generated_content";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_events: {
        Row: {
          id: string;
          lead_id: string | null;
          preview_id: string | null;
          event: AnalyticsEvent;
          device_category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          preview_id?: string | null;
          event: AnalyticsEvent;
          device_category?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "analytics_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_preview_id_fkey";
            columns: ["preview_id"];
            isOneToOne: false;
            referencedRelation: "previews";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          lead_id: string | null;
          job_type: JobType;
          status: JobStatus;
          started_at: string | null;
          completed_at: string | null;
          error: string | null;
          model: string | null;
          tokens: number | null;
          estimated_cost: number | null;
          result: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          job_type: JobType;
          status?: JobStatus;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
          model?: string | null;
          tokens?: number | null;
          estimated_cost?: number | null;
          result?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "jobs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

