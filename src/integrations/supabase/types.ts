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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          child_id: string | null
          competency_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          diagnostic_attempt_id: string | null
          education_level_id: string | null
          ends_at: string
          id: string
          learning_domain_id: string | null
          learning_plan_id: string | null
          learning_plan_item_id: string | null
          meeting_url: string | null
          notes: string | null
          parent_user_id: string | null
          payment_status: string
          price_amount: number | null
          price_cents: number
          skill_area_label: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string | null
          subject_id: string | null
          timezone: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          competency_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnostic_attempt_id?: string | null
          education_level_id?: string | null
          ends_at: string
          id?: string
          learning_domain_id?: string | null
          learning_plan_id?: string | null
          learning_plan_item_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          parent_user_id?: string | null
          payment_status?: string
          price_amount?: number | null
          price_cents?: number
          skill_area_label?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string | null
          subject_id?: string | null
          timezone?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          competency_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnostic_attempt_id?: string | null
          education_level_id?: string | null
          ends_at?: string
          id?: string
          learning_domain_id?: string | null
          learning_plan_id?: string | null
          learning_plan_item_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          parent_user_id?: string | null
          payment_status?: string
          price_amount?: number | null
          price_cents?: number
          skill_area_label?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string | null
          subject_id?: string | null
          timezone?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_diagnostic_attempt_id_fkey"
            columns: ["diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_learning_plan_id_fkey"
            columns: ["learning_plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_learning_plan_item_id_fkey"
            columns: ["learning_plan_item_id"]
            isOneToOne: false
            referencedRelation: "learning_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      child_kc_mastery: {
        Row: {
          algorithm_version: string | null
          child_id: string
          competency_id: string | null
          confidence: number
          confidence_reason: string | null
          created_at: string
          education_level_id: string | null
          evidence: Json
          id: string
          kc_id: string
          last_updated: string
          learning_domain_id: string | null
          mastery_prob: number
          skill_area_label: string | null
          source: string
        }
        Insert: {
          algorithm_version?: string | null
          child_id: string
          competency_id?: string | null
          confidence?: number
          confidence_reason?: string | null
          created_at?: string
          education_level_id?: string | null
          evidence?: Json
          id?: string
          kc_id: string
          last_updated?: string
          learning_domain_id?: string | null
          mastery_prob?: number
          skill_area_label?: string | null
          source?: string
        }
        Update: {
          algorithm_version?: string | null
          child_id?: string
          competency_id?: string | null
          confidence?: number
          confidence_reason?: string | null
          created_at?: string
          education_level_id?: string | null
          evidence?: Json
          id?: string
          kc_id?: string
          last_updated?: string
          learning_domain_id?: string | null
          mastery_prob?: number
          skill_area_label?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_kc_mastery_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_kc_mastery_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_kc_mastery_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_kc_mastery_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_kc_mastery_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          joined_at: string
          role: Database["public"]["Enums"]["circle_role"]
          user_id: string
        }
        Insert: {
          circle_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_role"]
          user_id: string
        }
        Update: {
          circle_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          max_members: number
          name: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          max_members?: number
          name: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          max_members?: number
          name?: string
          topic?: string | null
        }
        Relationships: []
      }
      competencies: {
        Row: {
          bloom_level: string | null
          code: string
          created_at: string
          description_en: string | null
          description_es: string | null
          description_pl: string | null
          difficulty_level: number
          domain_id: string
          education_level_id: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_es: string | null
          name_pl: string
          parent_competency_id: string | null
          review_status: string
          source_type: string
          updated_at: string
        }
        Insert: {
          bloom_level?: string | null
          code: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          difficulty_level?: number
          domain_id: string
          education_level_id?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl: string
          parent_competency_id?: string | null
          review_status?: string
          source_type?: string
          updated_at?: string
        }
        Update: {
          bloom_level?: string | null
          code?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          difficulty_level?: number
          domain_id?: string
          education_level_id?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl?: string
          parent_competency_id?: string | null
          review_status?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencies_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencies_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencies_parent_competency_id_fkey"
            columns: ["parent_competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_prerequisites: {
        Row: {
          created_at: string
          from_competency_id: string
          id: string
          rationale: string | null
          strength: number
          to_competency_id: string
        }
        Insert: {
          created_at?: string
          from_competency_id: string
          id?: string
          rationale?: string | null
          strength?: number
          to_competency_id: string
        }
        Update: {
          created_at?: string
          from_competency_id?: string
          id?: string
          rationale?: string | null
          strength?: number
          to_competency_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competency_prerequisites_from_competency_id_fkey"
            columns: ["from_competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_prerequisites_to_competency_id_fkey"
            columns: ["to_competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_source_mappings: {
        Row: {
          competency_id: string
          confidence: number
          created_at: string
          id: string
          source_id: string
          source_ref: string | null
        }
        Insert: {
          competency_id: string
          confidence?: number
          created_at?: string
          id?: string
          source_id: string
          source_ref?: string | null
        }
        Update: {
          competency_id?: string
          confidence?: number
          created_at?: string
          id?: string
          source_id?: string
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competency_source_mappings_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_source_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          accepted_at: string | null
          child_id: string | null
          consent_type: string
          consent_version: string
          content_snapshot: Json
          created_at: string
          id: string
          ip_metadata: Json
          status: string
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          child_id?: string | null
          consent_type: string
          consent_version?: string
          content_snapshot?: Json
          created_at?: string
          id?: string
          ip_metadata?: Json
          status?: string
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          child_id?: string | null
          consent_type?: string
          consent_version?: string
          content_snapshot?: Json
          created_at?: string
          id?: string
          ip_metadata?: Json
          status?: string
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_sources: {
        Row: {
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          publisher: string | null
          source_type: string
          title: string
          url: string | null
          valid_from: string | null
          valid_to: string | null
          version: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          publisher?: string | null
          source_type: string
          title: string
          url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          publisher?: string | null
          source_type?: string
          title?: string
          url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
        }
        Relationships: []
      }
      diagnostic_attempts: {
        Row: {
          algorithm_version: string | null
          child_id: string | null
          completed_at: string | null
          correct_items: number
          created_at: string
          domain: string | null
          education_level_id: string | null
          education_system_id: string | null
          id: string
          language: string
          learning_domain_id: string | null
          level: string | null
          mode: string
          prompt_version: string | null
          score: number | null
          started_at: string
          started_by: string | null
          status: string
          subject_id: string | null
          summary: Json | null
          taxonomy_payload: Json
          total_items: number
          user_id: string | null
        }
        Insert: {
          algorithm_version?: string | null
          child_id?: string | null
          completed_at?: string | null
          correct_items?: number
          created_at?: string
          domain?: string | null
          education_level_id?: string | null
          education_system_id?: string | null
          id?: string
          language?: string
          learning_domain_id?: string | null
          level?: string | null
          mode?: string
          prompt_version?: string | null
          score?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          subject_id?: string | null
          summary?: Json | null
          taxonomy_payload?: Json
          total_items?: number
          user_id?: string | null
        }
        Update: {
          algorithm_version?: string | null
          child_id?: string | null
          completed_at?: string | null
          correct_items?: number
          created_at?: string
          domain?: string | null
          education_level_id?: string | null
          education_system_id?: string | null
          id?: string
          language?: string
          learning_domain_id?: string | null
          level?: string | null
          mode?: string
          prompt_version?: string | null
          score?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          subject_id?: string | null
          summary?: Json | null
          taxonomy_payload?: Json
          total_items?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_attempts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_attempts_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_attempts_education_system_id_fkey"
            columns: ["education_system_id"]
            isOneToOne: false
            referencedRelation: "education_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_attempts_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_attempts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_items: {
        Row: {
          approved_by_admin: boolean
          attempt_id: string | null
          choices: Json
          code: string
          correct_choice: string
          created_at: string
          difficulty_level: number
          domain: string | null
          explanation: string | null
          generated_by: string | null
          id: string
          is_active: boolean
          kc_id: string | null
          kc_label: string | null
          language: string
          level: string | null
          question: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          approved_by_admin?: boolean
          attempt_id?: string | null
          choices: Json
          code: string
          correct_choice: string
          created_at?: string
          difficulty_level?: number
          domain?: string | null
          explanation?: string | null
          generated_by?: string | null
          id?: string
          is_active?: boolean
          kc_id?: string | null
          kc_label?: string | null
          language?: string
          level?: string | null
          question: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_by_admin?: boolean
          attempt_id?: string | null
          choices?: Json
          code?: string
          correct_choice?: string
          created_at?: string
          difficulty_level?: number
          domain?: string | null
          explanation?: string | null
          generated_by?: string | null
          id?: string
          is_active?: boolean
          kc_id?: string | null
          kc_label?: string | null
          language?: string
          level?: string | null
          question?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_items_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_responses: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          item_id: string
          selected_choice: string | null
          time_ms: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          item_id: string
          selected_choice?: string | null
          time_ms?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          item_id?: string
          selected_choice?: string | null
          time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_items"
            referencedColumns: ["id"]
          },
        ]
      }
      education_levels: {
        Row: {
          age_max: number | null
          age_min: number | null
          code: string
          created_at: string
          description_en: string | null
          description_es: string | null
          description_pl: string | null
          education_system_id: string
          id: string
          is_active: boolean
          name_en: string | null
          name_es: string | null
          name_pl: string
          order_index: number
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          code: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          education_system_id: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl: string
          order_index?: number
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          code?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          education_system_id?: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "education_levels_education_system_id_fkey"
            columns: ["education_system_id"]
            isOneToOne: false
            referencedRelation: "education_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      education_systems: {
        Row: {
          code: string
          country_code: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          description_pl: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_es: string | null
          name_pl: string
          updated_at: string
        }
        Insert: {
          code: string
          country_code?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl: string
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expert_review_items: {
        Row: {
          ai_value: Json
          competency_id: string | null
          confidence: number | null
          correction_note: string | null
          created_at: string
          expert_review_id: string
          expert_value: Json
          id: string
          item_type: string
          skill_area_label: string | null
          updated_at: string
          verdict: string
        }
        Insert: {
          ai_value?: Json
          competency_id?: string | null
          confidence?: number | null
          correction_note?: string | null
          created_at?: string
          expert_review_id: string
          expert_value?: Json
          id?: string
          item_type: string
          skill_area_label?: string | null
          updated_at?: string
          verdict?: string
        }
        Update: {
          ai_value?: Json
          competency_id?: string | null
          confidence?: number | null
          correction_note?: string | null
          created_at?: string
          expert_review_id?: string
          expert_value?: Json
          id?: string
          item_type?: string
          skill_area_label?: string | null
          updated_at?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_review_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_review_items_expert_review_id_fkey"
            columns: ["expert_review_id"]
            isOneToOne: false
            referencedRelation: "expert_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_reviews: {
        Row: {
          agreement_score: number | null
          ai_summary: Json
          algorithm_version: string
          checkpoint_id: string | null
          child_id: string | null
          correction_summary: Json
          created_at: string
          diagnostic_attempt_id: string | null
          expert_assessment: Json
          id: string
          learning_plan_id: string | null
          notes: string | null
          owner_type: string
          review_type: string
          reviewer_id: string
          reviewer_role: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agreement_score?: number | null
          ai_summary?: Json
          algorithm_version?: string
          checkpoint_id?: string | null
          child_id?: string | null
          correction_summary?: Json
          created_at?: string
          diagnostic_attempt_id?: string | null
          expert_assessment?: Json
          id?: string
          learning_plan_id?: string | null
          notes?: string | null
          owner_type: string
          review_type: string
          reviewer_id: string
          reviewer_role?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agreement_score?: number | null
          ai_summary?: Json
          algorithm_version?: string
          checkpoint_id?: string | null
          child_id?: string | null
          correction_summary?: Json
          created_at?: string
          diagnostic_attempt_id?: string | null
          expert_assessment?: Json
          id?: string
          learning_plan_id?: string | null
          notes?: string | null
          owner_type?: string
          review_type?: string
          reviewer_id?: string
          reviewer_role?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_reviews_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "learning_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_diagnostic_attempt_id_fkey"
            columns: ["diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_learning_plan_id_fkey"
            columns: ["learning_plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          due_at: string | null
          ease: number | null
          front: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          due_at?: string | null
          ease?: number | null
          front: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          due_at?: string | null
          ease?: number | null
          front?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      karma_events: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      kc_prerequisites: {
        Row: {
          created_at: string
          from_kc_id: string
          id: string
          strength: number
          subject_id: string
          to_kc_id: string
        }
        Insert: {
          created_at?: string
          from_kc_id: string
          id?: string
          strength?: number
          subject_id: string
          to_kc_id: string
        }
        Update: {
          created_at?: string
          from_kc_id?: string
          id?: string
          strength?: number
          subject_id?: string
          to_kc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kc_prerequisites_from_kc_id_fkey"
            columns: ["from_kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_prerequisites_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_prerequisites_to_kc_id_fkey"
            columns: ["to_kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          circle_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          circle_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_components: {
        Row: {
          code: string
          competency_id: string | null
          created_at: string
          description_en: string | null
          description_pl: string | null
          difficulty_level: number
          grade_level: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_pl: string
          order_index: number
          parent_kc_id: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          code: string
          competency_id?: string | null
          created_at?: string
          description_en?: string | null
          description_pl?: string | null
          difficulty_level?: number
          grade_level?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_pl: string
          order_index?: number
          parent_kc_id?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          competency_id?: string | null
          created_at?: string
          description_en?: string | null
          description_pl?: string | null
          difficulty_level?: number
          grade_level?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_pl?: string
          order_index?: number
          parent_kc_id?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_components_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_components_parent_kc_id_fkey"
            columns: ["parent_kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_components_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_checkpoints: {
        Row: {
          algorithm_version: string
          baseline_diagnostic_attempt_id: string | null
          baseline_score: number | null
          checkpoint_diagnostic_attempt_id: string | null
          checkpoint_score: number | null
          child_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          learning_plan_id: string | null
          mastery_delta: Json
          owner_type: string
          score_delta: number | null
          status: string
          summary: Json
          trigger_reason: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          algorithm_version?: string
          baseline_diagnostic_attempt_id?: string | null
          baseline_score?: number | null
          checkpoint_diagnostic_attempt_id?: string | null
          checkpoint_score?: number | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          learning_plan_id?: string | null
          mastery_delta?: Json
          owner_type: string
          score_delta?: number | null
          status?: string
          summary?: Json
          trigger_reason?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          algorithm_version?: string
          baseline_diagnostic_attempt_id?: string | null
          baseline_score?: number | null
          checkpoint_diagnostic_attempt_id?: string | null
          checkpoint_score?: number | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          learning_plan_id?: string | null
          mastery_delta?: Json
          owner_type?: string
          score_delta?: number | null
          status?: string
          summary?: Json
          trigger_reason?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_checkpoints_baseline_diagnostic_attempt_id_fkey"
            columns: ["baseline_diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_checkpoints_checkpoint_diagnostic_attempt_id_fkey"
            columns: ["checkpoint_diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_checkpoints_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_checkpoints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_checkpoints_learning_plan_id_fkey"
            columns: ["learning_plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_checkpoints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_domains: {
        Row: {
          code: string
          created_at: string
          description_en: string | null
          description_es: string | null
          description_pl: string | null
          domain_type: string
          id: string
          is_active: boolean
          name_en: string | null
          name_es: string | null
          name_pl: string
        }
        Insert: {
          code: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          domain_type?: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl: string
        }
        Update: {
          code?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          description_pl?: string | null
          domain_type?: string
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_es?: string | null
          name_pl?: string
        }
        Relationships: []
      }
      learning_goals: {
        Row: {
          child_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          status: string
          subject_id: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          child_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          subject_id?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string
          subject_id?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_goals_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plan_items: {
        Row: {
          algorithm_version: string | null
          competency_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          difficulty_level: number | null
          education_level_id: string | null
          estimated_minutes: number | null
          evidence_ref: Json
          id: string
          kind: string
          learning_domain_id: string | null
          order_index: number
          plan_id: string
          rationale: string | null
          skill_area: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          algorithm_version?: string | null
          competency_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          education_level_id?: string | null
          estimated_minutes?: number | null
          evidence_ref?: Json
          id?: string
          kind?: string
          learning_domain_id?: string | null
          order_index: number
          plan_id: string
          rationale?: string | null
          skill_area?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          algorithm_version?: string | null
          competency_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: number | null
          education_level_id?: string | null
          estimated_minutes?: number | null
          evidence_ref?: Json
          id?: string
          kind?: string
          learning_domain_id?: string | null
          order_index?: number
          plan_id?: string
          rationale?: string | null
          skill_area?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_plan_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plan_items_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plan_items_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plans: {
        Row: {
          algorithm_version: string
          approved_at: string | null
          archived_at: string | null
          child_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          diagnostic_attempt_id: string | null
          domain: string | null
          education_level_id: string | null
          education_system_id: string | null
          evidence: Json
          generated_at: string | null
          generated_by: string
          id: string
          learning_domain_id: string | null
          level: string | null
          owner_type: string
          prompt_version: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          algorithm_version?: string
          approved_at?: string | null
          archived_at?: string | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_attempt_id?: string | null
          domain?: string | null
          education_level_id?: string | null
          education_system_id?: string | null
          evidence?: Json
          generated_at?: string | null
          generated_by?: string
          id?: string
          learning_domain_id?: string | null
          level?: string | null
          owner_type: string
          prompt_version?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          algorithm_version?: string
          approved_at?: string | null
          archived_at?: string | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_attempt_id?: string | null
          domain?: string | null
          education_level_id?: string | null
          education_system_id?: string | null
          evidence?: Json
          generated_at?: string | null
          generated_by?: string
          id?: string
          learning_domain_id?: string | null
          level?: string | null
          owner_type?: string
          prompt_version?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_plans_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_diagnostic_attempt_id_fkey"
            columns: ["diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_education_system_id_fkey"
            columns: ["education_system_id"]
            isOneToOne: false
            referencedRelation: "education_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          body: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          metadata: Json
          read_at: string | null
          scheduled_for: string | null
          severity: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          scheduled_for?: string | null
          severity?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          scheduled_for?: string | null
          severity?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          member_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          status: Database["public"]["Enums"]["org_invite_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          status?: Database["public"]["Enums"]["org_invite_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id?: string
          status?: Database["public"]["Enums"]["org_invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          member_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_verified: boolean
          logo_url: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          owner_id: string
          slug: string
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          owner_id: string
          slug: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          owner_id?: string
          slug?: string
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      parent_children: {
        Row: {
          consent_signed_at: string
          consent_version: string
          created_at: string
          display_name: string
          dob: string | null
          email: string | null
          grade_level: string | null
          id: string
          parent_id: string
          primary_subject: string | null
          relation: string
          status: string
          updated_at: string
        }
        Insert: {
          consent_signed_at?: string
          consent_version?: string
          created_at?: string
          display_name: string
          dob?: string | null
          email?: string | null
          grade_level?: string | null
          id?: string
          parent_id: string
          primary_subject?: string | null
          relation?: string
          status?: string
          updated_at?: string
        }
        Update: {
          consent_signed_at?: string
          consent_version?: string
          created_at?: string
          display_name?: string
          dob?: string | null
          email?: string | null
          grade_level?: string | null
          id?: string
          parent_id?: string
          primary_subject?: string | null
          relation?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          consent_doc_url: string | null
          consent_signed_at: string | null
          consent_version: string | null
          created_at: string
          id: string
          parent_id: string
          relation: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          consent_doc_url?: string | null
          consent_signed_at?: string | null
          consent_version?: string | null
          created_at?: string
          id?: string
          parent_id: string
          relation?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          consent_doc_url?: string | null
          consent_signed_at?: string | null
          consent_version?: string | null
          created_at?: string
          id?: string
          parent_id?: string
          relation?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          booking_id: string
          confirmed_at: string | null
          created_at: string
          currency: string
          disputed_at: string | null
          id: string
          marked_paid_at: string | null
          method: string
          payer_user_id: string | null
          proof_url: string | null
          status: string
          tutor_user_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          disputed_at?: string | null
          id?: string
          marked_paid_at?: string | null
          method?: string
          payer_user_id?: string | null
          proof_url?: string | null
          status?: string
          tutor_user_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          disputed_at?: string | null
          id?: string
          marked_paid_at?: string | null
          method?: string
          payer_user_id?: string | null
          proof_url?: string | null
          status?: string
          tutor_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_tutor_user_id_fkey"
            columns: ["tutor_user_id"]
            isOneToOne: false
            referencedRelation: "tutor_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string
          confirmed_at: string | null
          created_at: string
          currency: string
          id: string
          marked_paid_at: string | null
          method_details: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          notes: string | null
          proof_url: string | null
          reference_code: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          marked_paid_at?: string | null
          method_details: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          notes?: string | null
          proof_url?: string | null
          reference_code: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          marked_paid_at?: string | null
          method_details?: string
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          notes?: string | null
          proof_url?: string | null
          reference_code?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_requests: {
        Row: {
          created_at: string
          description: string | null
          helper_id: string | null
          id: string
          requester_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["peer_request_status"]
          subject_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          helper_id?: string | null
          id?: string
          requester_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["peer_request_status"]
          subject_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          helper_id?: string | null
          id?: string
          requester_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["peer_request_status"]
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_cohorts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          status: string
          target_group: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status?: string
          target_group?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: string
          target_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_participants: {
        Row: {
          child_id: string | null
          cohort_id: string
          completed_at: string | null
          created_at: string
          id: string
          joined_at: string
          metadata: Json
          participant_type: string
          status: string
          user_id: string
        }
        Insert: {
          child_id?: string | null
          cohort_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          metadata?: Json
          participant_type?: string
          status?: string
          user_id: string
        }
        Update: {
          child_id?: string | null
          cohort_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          metadata?: Json
          participant_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_participants_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_participants_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "pilot_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          karma_points: number
          onboarded_at: string | null
          timezone: string
          ui_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          karma_points?: number
          onboarded_at?: string | null
          timezone?: string
          ui_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          karma_points?: number
          onboarded_at?: string | null
          timezone?: string
          ui_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      session_emotions: {
        Row: {
          boredom: number | null
          confusion: number | null
          engagement: number | null
          id: string
          joy: number | null
          raw: Json | null
          recorded_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          boredom?: number | null
          confusion?: number | null
          engagement?: number | null
          id?: string
          joy?: number | null
          raw?: Json | null
          recorded_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          boredom?: number | null
          confusion?: number | null
          engagement?: number | null
          id?: string
          joy?: number | null
          raw?: Json | null
          recorded_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_emotions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          booking_id: string
          child_id: string | null
          covered_skill_areas: string[]
          created_at: string
          id: string
          learner_user_id: string | null
          notes: string
          recommended_next_step: string | null
          tutor_user_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          child_id?: string | null
          covered_skill_areas?: string[]
          created_at?: string
          id?: string
          learner_user_id?: string | null
          notes?: string
          recommended_next_step?: string | null
          tutor_user_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          child_id?: string | null
          covered_skill_areas?: string[]
          created_at?: string
          id?: string
          learner_user_id?: string | null
          notes?: string
          recommended_next_step?: string | null
          tutor_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_learner_user_id_fkey"
            columns: ["learner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reports: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_timeline: Json | null
          flashcards: Json | null
          homework: Json | null
          id: string
          session_id: string | null
          strengths: string | null
          summary: string | null
          weaknesses: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_timeline?: Json | null
          flashcards?: Json | null
          homework?: Json | null
          id?: string
          session_id?: string | null
          strengths?: string | null
          summary?: string | null
          weaknesses?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_timeline?: Json | null
          flashcards?: Json | null
          homework?: Json | null
          id?: string
          session_id?: string | null
          strengths?: string | null
          summary?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_transcripts: {
        Row: {
          created_at: string
          ends_at_ms: number
          id: string
          session_id: string
          speaker_id: string | null
          speaker_label: string | null
          starts_at_ms: number
          text: string
        }
        Insert: {
          created_at?: string
          ends_at_ms?: number
          id?: string
          session_id: string
          speaker_id?: string | null
          speaker_label?: string | null
          starts_at_ms?: number
          text: string
        }
        Update: {
          created_at?: string
          ends_at_ms?: number
          id?: string
          session_id?: string
          speaker_id?: string | null
          speaker_label?: string | null
          starts_at_ms?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          booking_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          recording_url: string | null
          room_name: string
          started_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          recording_url?: string | null
          room_name: string
          started_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          recording_url?: string | null
          room_name?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_evidence_events: {
        Row: {
          algorithm_version: string | null
          child_id: string | null
          created_at: string
          created_by: string | null
          diagnostic_attempt_id: string | null
          event_type: string
          id: string
          input_summary: Json
          learning_plan_id: string | null
          metrics: Json
          output_summary: Json
          owner_type: string | null
          user_id: string | null
        }
        Insert: {
          algorithm_version?: string | null
          child_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnostic_attempt_id?: string | null
          event_type: string
          id?: string
          input_summary?: Json
          learning_plan_id?: string | null
          metrics?: Json
          output_summary?: Json
          owner_type?: string | null
          user_id?: string | null
        }
        Update: {
          algorithm_version?: string | null
          child_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnostic_attempt_id?: string | null
          event_type?: string
          id?: string
          input_summary?: Json
          learning_plan_id?: string | null
          metrics?: Json
          output_summary?: Json
          owner_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_evidence_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_evidence_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_evidence_events_diagnostic_attempt_id_fkey"
            columns: ["diagnostic_attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_evidence_events_learning_plan_id_fkey"
            columns: ["learning_plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_evidence_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent_links: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invited_at: string
          invited_email: string | null
          pairing_code: string | null
          parent_id: string | null
          revoked_at: string | null
          scopes: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_email?: string | null
          pairing_code?: string | null
          parent_id?: string | null
          revoked_at?: string | null
          scopes?: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_email?: string | null
          pairing_code?: string | null
          parent_id?: string | null
          revoked_at?: string | null
          scopes?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string | null
          code: string
          created_at: string
          description_en: string | null
          description_pl: string | null
          domain_id: string | null
          education_level_id: string | null
          id: string
          is_active: boolean
          level: string | null
          name_en: string
          name_pl: string
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          description_en?: string | null
          description_pl?: string | null
          domain_id?: string | null
          education_level_id?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          name_en: string
          name_pl: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          description_en?: string | null
          description_pl?: string | null
          domain_id?: string | null
          education_level_id?: string | null
          id?: string
          is_active?: boolean
          level?: string | null
          name_en?: string
          name_pl?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tutor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_minute: number
          id: string
          start_minute: number
          tutor_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_minute: number
          id?: string
          start_minute: number
          tutor_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_minute?: number
          id?: string
          start_minute?: number
          tutor_id?: string
        }
        Relationships: []
      }
      tutor_availability_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_recurring: boolean
          start_time: string
          timezone: string
          tutor_user_id: string
          valid_from: string | null
          valid_to: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_recurring?: boolean
          start_time: string
          timezone?: string
          tutor_user_id: string
          valid_from?: string | null
          valid_to?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_recurring?: boolean
          start_time?: string
          timezone?: string
          tutor_user_id?: string
          valid_from?: string | null
          valid_to?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_slots_tutor_user_id_fkey"
            columns: ["tutor_user_id"]
            isOneToOne: false
            referencedRelation: "tutor_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_competencies: {
        Row: {
          competency_id: string | null
          confidence_level: string
          created_at: string
          education_level_id: string | null
          id: string
          learning_domain_id: string | null
          skill_area_label: string | null
          tutor_user_id: string
          years_experience: number | null
        }
        Insert: {
          competency_id?: string | null
          confidence_level?: string
          created_at?: string
          education_level_id?: string | null
          id?: string
          learning_domain_id?: string | null
          skill_area_label?: string | null
          tutor_user_id: string
          years_experience?: number | null
        }
        Update: {
          competency_id?: string | null
          confidence_level?: string
          created_at?: string
          education_level_id?: string | null
          id?: string
          learning_domain_id?: string | null
          skill_area_label?: string | null
          tutor_user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_competencies_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_competencies_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_competencies_tutor_user_id_fkey"
            columns: ["tutor_user_id"]
            isOneToOne: false
            referencedRelation: "tutor_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_payment_methods: {
        Row: {
          created_at: string
          details: string
          id: string
          is_default: boolean
          label: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          tutor_id: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          is_default?: boolean
          label: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          tutor_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          is_default?: boolean
          label?: string
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_payment_methods_tutor_id_profiles_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_profiles: {
        Row: {
          bio: string | null
          created_at: string
          currency: string
          description: string | null
          display_name: string | null
          education_levels: string[]
          headline: string | null
          hourly_rate: number | null
          hourly_rate_cents: number
          intro_video_url: string | null
          is_published: boolean
          is_verified: boolean
          languages: string[]
          payment_reliability: number | null
          profile_photo_url: string | null
          rating: number | null
          reviews_count: number
          sessions_completed: number
          teaching_domains: string[]
          updated_at: string
          user_id: string
          verification_notes: string | null
          verification_status: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string | null
          education_levels?: string[]
          headline?: string | null
          hourly_rate?: number | null
          hourly_rate_cents?: number
          intro_video_url?: string | null
          is_published?: boolean
          is_verified?: boolean
          languages?: string[]
          payment_reliability?: number | null
          profile_photo_url?: string | null
          rating?: number | null
          reviews_count?: number
          sessions_completed?: number
          teaching_domains?: string[]
          updated_at?: string
          user_id: string
          verification_notes?: string | null
          verification_status?: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string | null
          education_levels?: string[]
          headline?: string | null
          hourly_rate?: number | null
          hourly_rate_cents?: number
          intro_video_url?: string | null
          is_published?: boolean
          is_verified?: boolean
          languages?: string[]
          payment_reliability?: number | null
          profile_photo_url?: string | null
          rating?: number | null
          reviews_count?: number
          sessions_completed?: number
          teaching_domains?: string[]
          updated_at?: string
          user_id?: string
          verification_notes?: string | null
          verification_status?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_profiles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subjects: {
        Row: {
          level: string | null
          subject_id: string
          tutor_id: string
        }
        Insert: {
          level?: string | null
          subject_id: string
          tutor_id: string
        }
        Update: {
          level?: string | null
          subject_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_tutor_id_profiles_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_competency_mastery: {
        Row: {
          algorithm_version: string | null
          competency_id: string | null
          confidence: number
          created_at: string
          education_level_id: string | null
          evidence: Json
          id: string
          last_updated: string
          learning_domain_id: string | null
          mastery_prob: number
          skill_area_label: string | null
          source: string
          user_id: string
        }
        Insert: {
          algorithm_version?: string | null
          competency_id?: string | null
          confidence?: number
          created_at?: string
          education_level_id?: string | null
          evidence?: Json
          id?: string
          last_updated?: string
          learning_domain_id?: string | null
          mastery_prob?: number
          skill_area_label?: string | null
          source?: string
          user_id: string
        }
        Update: {
          algorithm_version?: string | null
          competency_id?: string | null
          confidence?: number
          created_at?: string
          education_level_id?: string | null
          evidence?: Json
          id?: string
          last_updated?: string
          learning_domain_id?: string | null
          mastery_prob?: number
          skill_area_label?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_competency_mastery_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_competency_mastery_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_competency_mastery_learning_domain_id_fkey"
            columns: ["learning_domain_id"]
            isOneToOne: false
            referencedRelation: "learning_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_competency_mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          child_id: string | null
          context_id: string | null
          context_type: string
          created_at: string
          feedback_text: string | null
          id: string
          metadata: Json
          rating: number | null
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          context_id?: string | null
          context_type: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          metadata?: Json
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          context_id?: string | null
          context_type?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          metadata?: Json
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "parent_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string }
      accept_student_parent_link: { Args: { _code: string }; Returns: string }
      accept_student_parent_link_by_id: {
        Args: { _link_id: string }
        Returns: string
      }
      admin_verify_tutor: {
        Args: { _approve: boolean; _notes?: string; _tutor_user_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_booking_participant: {
        Args: { _booking: string; _user: string }
        Returns: boolean
      }
      is_circle_member: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      is_linked_parent_of: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_parent_of_child: {
        Args: { _child_id: string; _parent_id: string }
        Returns: boolean
      }
      is_pilot_participant: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      is_session_participant: {
        Args: { _session: string; _user: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "student"
        | "tutor"
        | "admin"
        | "parent"
        | "school"
        | "training_company"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      circle_role: "owner" | "mentor" | "member"
      org_invite_status: "pending" | "accepted" | "revoked" | "expired"
      org_member_role: "owner" | "admin" | "teacher" | "student" | "observer"
      org_type: "school" | "training_company"
      payment_method_type: "blik" | "iban" | "revolut" | "paypal" | "other"
      payment_status: "pending" | "marked_paid" | "confirmed" | "disputed"
      peer_request_status: "open" | "matched" | "resolved" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "student",
        "tutor",
        "admin",
        "parent",
        "school",
        "training_company",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      circle_role: ["owner", "mentor", "member"],
      org_invite_status: ["pending", "accepted", "revoked", "expired"],
      org_member_role: ["owner", "admin", "teacher", "student", "observer"],
      org_type: ["school", "training_company"],
      payment_method_type: ["blik", "iban", "revolut", "paypal", "other"],
      payment_status: ["pending", "marked_paid", "confirmed", "disputed"],
      peer_request_status: ["open", "matched", "resolved", "cancelled"],
    },
  },
} as const
