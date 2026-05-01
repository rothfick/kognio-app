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
          created_at: string
          currency: string
          ends_at: string
          id: string
          notes: string | null
          price_cents: number
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          subject_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          ends_at: string
          id?: string
          notes?: string | null
          price_cents?: number
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          subject_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
          subject_id?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
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
          child_id: string
          confidence: number
          created_at: string
          evidence: Json
          id: string
          kc_id: string
          last_updated: string
          mastery_prob: number
          source: string
        }
        Insert: {
          child_id: string
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          kc_id: string
          last_updated?: string
          mastery_prob?: number
          source?: string
        }
        Update: {
          child_id?: string
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          kc_id?: string
          last_updated?: string
          mastery_prob?: number
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
            foreignKeyName: "child_kc_mastery_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_components"
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
      diagnostic_attempts: {
        Row: {
          child_id: string
          completed_at: string | null
          correct_items: number
          created_at: string
          id: string
          score: number | null
          started_at: string
          started_by: string | null
          status: string
          subject_id: string
          total_items: number
        }
        Insert: {
          child_id: string
          completed_at?: string | null
          correct_items?: number
          created_at?: string
          id?: string
          score?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          subject_id: string
          total_items?: number
        }
        Update: {
          child_id?: string
          completed_at?: string | null
          correct_items?: number
          created_at?: string
          id?: string
          score?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          subject_id?: string
          total_items?: number
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
          choices: Json
          code: string
          correct_choice: string
          created_at: string
          difficulty_level: number
          explanation: string | null
          id: string
          is_active: boolean
          kc_id: string
          language: string
          question: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          approved_by_admin?: boolean
          choices: Json
          code: string
          correct_choice: string
          created_at?: string
          difficulty_level?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          kc_id: string
          language?: string
          question: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          approved_by_admin?: boolean
          choices?: Json
          code?: string
          correct_choice?: string
          created_at?: string
          difficulty_level?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          kc_id?: string
          language?: string
          question?: string
          subject_id?: string
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
      subjects: {
        Row: {
          category: string | null
          code: string
          created_at: string
          description_en: string | null
          description_pl: string | null
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
          id?: string
          is_active?: boolean
          level?: string | null
          name_en?: string
          name_pl?: string
          slug?: string
          updated_at?: string
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
          created_at: string
          currency: string
          description: string | null
          headline: string | null
          hourly_rate_cents: number
          intro_video_url: string | null
          is_published: boolean
          is_verified: boolean
          payment_reliability: number | null
          rating: number | null
          sessions_completed: number
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          headline?: string | null
          hourly_rate_cents?: number
          intro_video_url?: string | null
          is_published?: boolean
          is_verified?: boolean
          payment_reliability?: number | null
          rating?: number | null
          sessions_completed?: number
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          headline?: string | null
          hourly_rate_cents?: number
          intro_video_url?: string | null
          is_published?: boolean
          is_verified?: boolean
          payment_reliability?: number | null
          rating?: number | null
          sessions_completed?: number
          updated_at?: string
          user_id?: string
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
      is_parent_of: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_parent_of_child: {
        Args: { _child_id: string; _parent_id: string }
        Returns: boolean
      }
      is_session_participant: {
        Args: { _session: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "tutor" | "admin" | "parent"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      circle_role: "owner" | "mentor" | "member"
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
      app_role: ["student", "tutor", "admin", "parent"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      circle_role: ["owner", "mentor", "member"],
      payment_method_type: ["blik", "iban", "revolut", "paypal", "other"],
      payment_status: ["pending", "marked_paid", "confirmed", "disputed"],
      peer_request_status: ["open", "matched", "resolved", "cancelled"],
    },
  },
} as const
