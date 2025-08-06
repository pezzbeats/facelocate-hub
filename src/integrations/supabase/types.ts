export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      attendance_events: {
        Row: {
          approved_by: string | null
          confidence_score: number | null
          created_at: string | null
          device_id: string
          employee_id: string
          event_type: string
          id: string
          is_manual: boolean | null
          location_id: string
          notes: string | null
          timestamp: string | null
        }
        Insert: {
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          device_id: string
          employee_id: string
          event_type: string
          id?: string
          is_manual?: boolean | null
          location_id: string
          notes?: string | null
          timestamp?: string | null
        }
        Update: {
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string | null
          device_id?: string
          employee_id?: string
          event_type?: string
          id?: string
          is_manual?: boolean | null
          location_id?: string
          notes?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_current_status"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          actual_duration_minutes: number | null
          break_type: string
          created_at: string
          device_id: string
          employee_id: string
          end_event_id: string | null
          id: string
          location_id: string
          planned_duration_minutes: number | null
          start_event_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          break_type?: string
          created_at?: string
          device_id: string
          employee_id: string
          end_event_id?: string | null
          id?: string
          location_id: string
          planned_duration_minutes?: number | null
          start_event_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          break_type?: string
          created_at?: string
          device_id?: string
          employee_id?: string
          end_event_id?: string | null
          id?: string
          location_id?: string
          planned_duration_minutes?: number | null
          start_event_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_current_status"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "breaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_end_event_id_fkey"
            columns: ["end_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_start_event_id_fkey"
            columns: ["start_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
        ]
      }
      device_heartbeats: {
        Row: {
          camera_status: string | null
          cpu_usage: number | null
          device_id: string
          error_message: string | null
          id: string
          memory_usage: number | null
          network_status: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          camera_status?: string | null
          cpu_usage?: number | null
          device_id: string
          error_message?: string | null
          id?: string
          memory_usage?: number | null
          network_status?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          camera_status?: string | null
          cpu_usage?: number | null
          device_id?: string
          error_message?: string | null
          id?: string
          memory_usage?: number | null
          network_status?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_heartbeats_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string | null
          device_code: string
          device_identifier: string
          device_name: string
          device_settings: Json | null
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_heartbeat: string | null
          location_id: string
          registration_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_code: string
          device_identifier: string
          device_name: string
          device_settings?: Json | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          location_id: string
          registration_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_code?: string
          device_identifier?: string
          device_name?: string
          device_settings?: Json | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_heartbeat?: string | null
          location_id?: string
          registration_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_location_id: string | null
          department: string
          designation: string | null
          email: string | null
          employee_code: string
          face_encodings: Json | null
          face_image_url: string | null
          face_registered: boolean | null
          face_registration_date: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_location_id?: string | null
          department: string
          designation?: string | null
          email?: string | null
          employee_code: string
          face_encodings?: Json | null
          face_image_url?: string | null
          face_registered?: boolean | null
          face_registration_date?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_location_id?: string | null
          department?: string
          designation?: string | null
          email?: string | null
          employee_code?: string
          face_encodings?: Json | null
          face_image_url?: string | null
          face_registered?: boolean | null
          face_registration_date?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      face_registration_logs: {
        Row: {
          attempt_number: number
          employee_id: string
          error_message: string | null
          id: string
          quality_score: number | null
          registered_by: string | null
          success: boolean | null
          timestamp: string | null
        }
        Insert: {
          attempt_number: number
          employee_id: string
          error_message?: string | null
          id?: string
          quality_score?: number | null
          registered_by?: string | null
          success?: boolean | null
          timestamp?: string | null
        }
        Update: {
          attempt_number?: number
          employee_id?: string
          error_message?: string | null
          id?: string
          quality_score?: number | null
          registered_by?: string | null
          success?: boolean | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "face_registration_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_current_status"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "face_registration_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_registration_logs_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location_code: string
          location_name: string
          longitude: number | null
          radius_meters: number | null
          timezone: string | null
          updated_at: string | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_code: string
          location_name: string
          longitude?: number | null
          radius_meters?: number | null
          timezone?: string | null
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_code?: string
          location_name?: string
          longitude?: number | null
          radius_meters?: number | null
          timezone?: string | null
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          last_attempt: string | null
          operation_type: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          last_attempt?: string | null
          operation_type: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          last_attempt?: string | null
          operation_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read_by: string[] | null
          target_users: string[] | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_by?: string[] | null
          target_users?: string[] | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_by?: string[] | null
          target_users?: string[] | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          data_type: string
          description: string | null
          id: string
          is_public: boolean | null
          setting_key: string
          setting_value: Json | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key: string
          setting_value?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_exits: {
        Row: {
          actual_duration_hours: number | null
          approval_time: string | null
          approved_by: string | null
          created_at: string | null
          denial_reason: string | null
          employee_id: string
          estimated_duration_hours: number | null
          exit_event_id: string | null
          id: string
          location_id: string
          reason: string
          requested_at: string | null
          return_event_id: string | null
          status: string | null
        }
        Insert: {
          actual_duration_hours?: number | null
          approval_time?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          employee_id: string
          estimated_duration_hours?: number | null
          exit_event_id?: string | null
          id?: string
          location_id: string
          reason: string
          requested_at?: string | null
          return_event_id?: string | null
          status?: string | null
        }
        Update: {
          actual_duration_hours?: number | null
          approval_time?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          employee_id?: string
          estimated_duration_hours?: number | null
          exit_event_id?: string | null
          id?: string
          location_id?: string
          reason?: string
          requested_at?: string | null
          return_event_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temporary_exits_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_exits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_current_status"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "temporary_exits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_exits_exit_event_id_fkey"
            columns: ["exit_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_exits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_exits_return_event_id_fkey"
            columns: ["return_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          login_time: string
          logout_time: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          login_time?: string
          logout_time?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          login_time?: string
          logout_time?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_current_status: {
        Row: {
          current_location_id: string | null
          current_location_name: string | null
          current_status: string | null
          department: string | null
          employee_code: string | null
          employee_id: string | null
          face_image_url: string | null
          full_name: string | null
          last_activity: string | null
          last_event_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_users_table_is_empty: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_user_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_user_is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      determine_attendance_action: {
        Args: { emp_id: string; current_location_id: string }
        Returns: Json
      }
      end_break: {
        Args: { emp_id: string; location_id: string; device_id: string }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_employee_current_status_with_breaks: {
        Args: { emp_id: string }
        Returns: Json
      }
      get_system_setting: {
        Args: { setting_category: string; setting_key: string }
        Returns: Json
      }
      is_active_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          action_type: string
          target_table?: string
          target_id?: string
          old_data?: Json
          new_data?: Json
        }
        Returns: string
      }
      process_attendance_action: {
        Args: {
          emp_id: string
          location_id: string
          device_id: string
          action_type: string
          confidence_score?: number
          notes?: string
          temp_exit_id?: string
        }
        Returns: Json
      }
      register_device: {
        Args: {
          device_name: string
          device_code: string
          device_identifier: string
          location_id: string
        }
        Returns: Json
      }
      request_temporary_exit: {
        Args: {
          emp_id: string
          location_id: string
          device_id: string
          exit_reason: string
          estimated_duration_hours?: number
        }
        Returns: Json
      }
      start_break: {
        Args: {
          emp_id: string
          location_id: string
          device_id: string
          break_type?: string
          planned_duration?: number
        }
        Returns: Json
      }
      update_system_setting: {
        Args: { setting_category: string; setting_key: string; new_value: Json }
        Returns: boolean
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
    Enums: {},
  },
} as const
