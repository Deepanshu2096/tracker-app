export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      batch_task_stats: {
        Row: {
          available_tasks: number
          batch_id: string
          created_at: string | null
          id: string
          needs_review_tasks: number
          ready_for_delivery_tasks: number
          rejected_tasks: number
          skipped_tasks: number
          total_tasks: number
          updated_at: string | null
        }
        Insert: {
          available_tasks?: number
          batch_id: string
          created_at?: string | null
          id?: string
          needs_review_tasks?: number
          ready_for_delivery_tasks?: number
          rejected_tasks?: number
          skipped_tasks?: number
          total_tasks?: number
          updated_at?: string | null
        }
        Update: {
          available_tasks?: number
          batch_id?: string
          created_at?: string | null
          id?: string
          needs_review_tasks?: number
          ready_for_delivery_tasks?: number
          rejected_tasks?: number
          skipped_tasks?: number
          total_tasks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_task_stats_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string | null
          created_by: string | null
          due_date: string | null
          file_url: string | null
          id: string
          is_deleted: boolean | null
          isActive: boolean | null
          name: string
          org_id: string
          priority: number | null
          project_id: string
          task_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean | null
          isActive?: boolean | null
          name: string
          org_id: string
          priority?: number | null
          project_id: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          is_deleted?: boolean | null
          isActive?: boolean | null
          name?: string
          org_id?: string
          priority?: number | null
          project_id?: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_projectid_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "tasktemplate_history"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_batch: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mark_tasks_completed: boolean
          name: string | null
          org_id: string | null
          project_id: string | null
          total_tasks: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mark_tasks_completed?: boolean
          name?: string | null
          org_id?: string | null
          project_id?: string | null
          total_tasks?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mark_tasks_completed?: boolean
          name?: string | null
          org_id?: string | null
          project_id?: string | null
          total_tasks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_batch_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "delivery_batch_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batch_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gt_list: {
        Row: {
          created_at: string
          gt_content: Json
          gt_name: string
          id: string
          org_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          gt_content: Json
          gt_name: string
          id?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          gt_content?: Json
          gt_name?: string
          id?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gt_list_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          email: string
          expires_at: string
          name: string | null
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          accepted_at: string | null
        }
        Insert: {
          email: string
          expires_at?: string
          name?: string | null
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          accepted_at?: string | null
        }
        Update: {
          email?: string
          expires_at?: string
          name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      groups: {
        Row: {
          id: string
          name: string
          manager_id: string
          team_lead_id: string
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          manager_id: string
          team_lead_id: string
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          manager_id?: string
          team_lead_id?: string
          org_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "groups_manager_id_fkey", columns: ["manager_id"], isOneToOne: false, referencedRelation: "profiles", referencedColumns: ["id"] },
          { foreignKeyName: "groups_team_lead_id_fkey", columns: ["team_lead_id"], isOneToOne: false, referencedRelation: "profiles", referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          email: string | null
          id: string
          full_name: string | null
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          user_id: string
          work_start_time: string | null
          work_end_time: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          full_name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          user_id: string
          work_start_time?: string | null
          work_end_time?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          full_name?: string | null
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          user_id?: string
          work_start_time?: string | null
          work_end_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_org"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["role"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_deleted: boolean | null
          name: string | null
          org_id: string
          task_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          client?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          org_id: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          org_id?: string
          task_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "tasktemplate_history"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_acl: {
        Row: {
          id: string
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_acl_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          id: string
          task_id: string
          user_id: string
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          task_id: string
          user_id: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          assigned_at?: string
          id?: string
          task_id?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      task_history: {
        Row: {
          ai_metadata: Json | null
          annotated_by: string | null
          annotated_by_ai: boolean | null
          assigned_to: string | null
          comment: string | null
          created_at: string | null
          end_time: string | null
          id: string
          is_accepted: boolean | null
          is_reviewed: boolean | null
          results: Json | null
          reviewed_by: string | null
          reviewer_comment: string | null
          start_time: string | null
          task_id: string
          time_taken_to_annotate: unknown
          updated_at: string | null
        }
        Insert: {
          ai_metadata?: Json | null
          annotated_by?: string | null
          annotated_by_ai?: boolean | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_accepted?: boolean | null
          is_reviewed?: boolean | null
          results?: Json | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          start_time?: string | null
          task_id: string
          time_taken_to_annotate?: unknown
          updated_at?: string | null
        }
        Update: {
          ai_metadata?: Json | null
          annotated_by?: string | null
          annotated_by_ai?: boolean | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_accepted?: boolean | null
          is_reviewed?: boolean | null
          results?: Json | null
          reviewed_by?: string | null
          reviewer_comment?: string | null
          start_time?: string | null
          task_id?: string
          time_taken_to_annotate?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_annotated_by_fkey"
            columns: ["annotated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "task_history_taskid_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          annotations_done: number
          assigned_user: string | null
          batch_id: string
          created_at: string | null
          created_by: string
          delivery_batch_id: string | null
          id: string
          is_deleted: boolean
          org_id: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          annotations_done?: number
          assigned_user?: string | null
          batch_id: string
          created_at?: string | null
          created_by: string
          delivery_batch_id?: string | null
          id?: string
          is_deleted?: boolean
          org_id: string
          required_annotations?: number
          skip_count?: number
          status?: string
          task_data?: Json | null
          type: string
          updated_at?: string | null
        }
        Update: {
          annotations_done?: number
          assigned_user?: string | null
          batch_id?: string
          created_at?: string | null
          created_by?: string
          delivery_batch_id?: string | null
          id?: string
          is_deleted?: boolean
          org_id?: string
          required_annotations?: number
          skip_count?: number
          status?: string
          task_data?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_fkey"
            columns: ["assigned_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_delivery_batch_id_fkey"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_orgid_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasktemplate_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          gt_id: string | null
          id: string
          instructions: string | null
          notes: string | null
          project_id: string | null
          reference_link: string | null
          task_template: Json | null
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          gt_id?: string | null
          id?: string
          instructions?: string | null
          notes?: string | null
          project_id?: string | null
          reference_link?: string | null
          task_template?: Json | null
          version_name?: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          gt_id?: string | null
          id?: string
          instructions?: string | null
          notes?: string | null
          project_id?: string | null
          reference_link?: string | null
          task_template?: Json | null
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasktemplate_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasktemplate_history_gt_id_fkey"
            columns: ["gt_id"]
            isOneToOne: false
            referencedRelation: "gt_list"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          permissions: Database["public"]["Enums"]["app_permission"][]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permissions: Database["public"]["Enums"]["app_permission"][]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permissions?: Database["public"]["Enums"]["app_permission"][]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_task_skips: {
        Row: {
          batch_id: string
          comment: string | null
          created_at: string | null
          id: string
          project_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          batch_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          project_id: string
          task_id: string
          user_id: string
        }
        Update: {
          batch_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          project_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_skips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_skips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_skips_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_skips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      page_views: {
        Row: {
          id: string
          user_id: string
          url: string
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          timestamp?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_annotator_performance_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_annotator_tasks_under_review: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_available_tasks: {
        Args: { p_org_id: string; p_project_id?: string }
        Returns: Json
      }
      get_batch_stats: {
        Args: { p_batch_id: string }
        Returns: {
          acceptance_ratio: number
          ready_tasks: number
          rejection_ratio: number
          total_accepted: number
          total_rejected: number
          total_reviewed: number
          total_tasks: number
        }[]
      }
      get_delivery_batch_stats: {
        Args: { p_delivery_batch_id: string }
        Returns: {
          acceptance_ratio: number
          rejection_ratio: number
          total_accepted: number
          total_rejected: number
          total_reviewed: number
        }[]
      }
      get_manager_overview_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_manager_personal_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_manager_quality_metrics: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_manager_time_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_manager_user_counts: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_reviewer_annotator_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_reviewer_review_stats: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_reviewer_task_counts: {
        Args: {
          p_end_date?: string
          p_org_id: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_task_counts_by_annotator: {
        Args: {
          annotator_ids: string[]
          org_id_param: string
          task_statuses: string[]
        }
        Returns: {
          assigned_user: string
          task_count: number
        }[]
      }
      get_tasks_with_priority_sorting: {
        Args: {
          batch_id_param?: string
          current_user_id: string
          date_filter?: number
          limit_param: number
          offset_param: number
          project_id_param?: string
          skip_filter?: string
          status_filter?: string
        }
        Returns: {
          annotations_done: number
          assigned_user: string
          batch_id: string
          batch_name: string
          created_at: string
          created_by: string
          id: string
          org_id: string
          profile_email: string
          profile_name: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json
          total_count: number
          type: string
          updated_at: string
        }[]
      }
      pick_tasks_multi_pass: {
        Args: {
          p_project_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_status: string
          p_user_id: string
        }
        Returns: {
          annotations_done: number
          assigned_at: string
          batch_id: string
          created_at: string
          id: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json
        }[]
      }
      pick_tasks_single_pass: {
        Args: {
          p_project_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_status: string
          p_user_id: string
        }
        Returns: {
          annotations_done: number
          assigned_at: string
          batch_id: string
          created_at: string
          id: string
          required_annotations: number
          skip_count: number
          status: string
          task_data: Json
        }[]
      }
      populate_batch_task_stats: {
        Args: never
        Returns: {
          result_batch_id: string
          stats_created: boolean
        }[]
      }
      rpc_get_batch_accuracy_report: {
        Args: { p_project_id: string }
        Returns: {
          accuracy: number
          batch_id: string
          batch_name: string
          batch_size: number
          delivery_batch_created_at: string
          gt_version: string
          ready_for_delivery_count: number
          rejected_count: number
          status: string
          tasks_evaluated: number
        }[]
      }
      rpc_reports_get_user_project_stats: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
        }
        Returns: {
          accepted_tasks: number
          avg_annotation_time_minutes: number
          avg_annotation_time_seconds: number
          rejected_tasks: number
          submitted_tasks: number
          total_time_hours: number
          total_time_seconds: number
          transactions_audited: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      sync_batch_stats: { Args: { p_batch_id: string }; Returns: undefined }
      update_batch_task_stats: {
        Args: {
          p_available_tasks_delta?: number
          p_batch_id: string
          p_needs_review_tasks_delta?: number
          p_ready_for_delivery_tasks_delta?: number
          p_rejected_tasks_delta?: number
          p_skipped_tasks_delta?: number
          p_total_tasks_delta?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_permission:
        | "project:read"
        | "project:write"
        | "project:update"
        | "project:delete"
        | "batch:read"
        | "batch:write"
        | "batch:update"
        | "batch:delete"
        | "task:read"
        | "task:write"
        | "task:update"
        | "task:delete"
        | "task_history:read"
        | "task_history:write"
        | "task_history:update"
        | "task_history:delete"
      app_role: "manager" | "annotator" | "reviewer" | "admin"
      sla_status: "on track" | "at risk" | "overdue" | "pending"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_permission: [
        "project:read",
        "project:write",
        "project:update",
        "project:delete",
        "batch:read",
        "batch:write",
        "batch:update",
        "batch:delete",
        "task:read",
        "task:write",
        "task:update",
        "task:delete",
        "task_history:read",
        "task_history:write",
        "task_history:update",
        "task_history:delete",
      ],
      app_role: ["manager", "annotator", "reviewer", "admin"],
      sla_status: ["on track", "at risk", "overdue", "pending"],
    },
  },
} as const

