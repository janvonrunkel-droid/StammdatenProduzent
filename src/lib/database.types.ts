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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: "user" | "assistant" | "system"
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: "user" | "assistant" | "system"
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: "user" | "assistant" | "system"
          content?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      article_tags: {
        Row: {
          article_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_number: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          embedding: string | null
          id: string
          name: string
          notes: string | null
          search_vector: unknown
          unit_id: string
          updated_at: string
        }
        Insert: {
          article_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          name: string
          notes?: string | null
          search_vector?: unknown
          unit_id: string
          updated_at?: string
        }
        Update: {
          article_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          name?: string
          notes?: string | null
          search_vector?: unknown
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_by: string | null
          document_date: string | null
          document_number: string | null
          file_hash: string | null
          file_path: string
          file_size: number
          id: string
          original_filename: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["document_status"]
          supplier_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at: string
        }
        Insert: {
          created_by?: string | null
          document_date?: string | null
          document_number?: string | null
          file_hash?: string | null
          file_path: string
          file_size: number
          id?: string
          original_filename?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          supplier_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
        }
        Update: {
          created_by?: string | null
          document_date?: string | null
          document_number?: string | null
          file_hash?: string | null
          file_path?: string
          file_size?: number
          id?: string
          original_filename?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_exclusions: {
        Row: {
          entity_a_id: string
          entity_b_id: string
          entity_type: string
          excluded_at: string | null
          excluded_by: string | null
          id: string
        }
        Insert: {
          entity_a_id: string
          entity_b_id: string
          entity_type: string
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
        }
        Update: {
          entity_a_id?: string
          entity_b_id?: string
          entity_type?: string
          excluded_at?: string | null
          excluded_by?: string | null
          id?: string
        }
        Relationships: []
      }
      extractions: {
        Row: {
          confidence_score: number | null
          created_at: string
          document_id: string
          extraction_method: string | null
          id: string
          raw_data: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["extraction_status"]
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          document_id: string
          extraction_method?: string | null
          id?: string
          raw_data: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          document_id?: string
          extraction_method?: string | null
          id?: string
          raw_data?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_extractions_reviewed_by"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          article_id: string
          created_at: string
          document_id: string
          id: string
          is_active: boolean
          price_date: string
          price_per_unit: number
          quantity: number
          supplier_id: string
          total_price: number
        }
        Insert: {
          article_id: string
          created_at?: string
          document_id: string
          id?: string
          is_active?: boolean
          price_date: string
          price_per_unit: number
          quantity: number
          supplier_id: string
          total_price: number
        }
        Update: {
          article_id?: string
          created_at?: string
          document_id?: string
          id?: string
          is_active?: boolean
          price_date?: string
          price_per_unit?: number
          quantity?: number
          supplier_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "prices_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entity_type: string
          filters: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_blocklist: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          reason: string | null
          updated_at: string | null
          variants: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          reason?: string | null
          updated_at?: string | null
          variants?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reason?: string | null
          updated_at?: string | null
          variants?: string[] | null
        }
        Relationships: []
      }
      import_sources: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["import_source_type"]
          config: Json
          polling_interval_minutes: number
          default_document_type: string
          derive_supplier_from_folder: boolean
          is_active: boolean
          last_scan_at: string | null
          next_scan_at: string | null
          last_error: string | null
          error_count: number
          stats_total_processed: number
          stats_total_errors: number
          stats_total_duplicates: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: Database["public"]["Enums"]["import_source_type"]
          config?: Json
          polling_interval_minutes?: number
          default_document_type?: string
          derive_supplier_from_folder?: boolean
          is_active?: boolean
          last_scan_at?: string | null
          next_scan_at?: string | null
          last_error?: string | null
          error_count?: number
          stats_total_processed?: number
          stats_total_errors?: number
          stats_total_duplicates?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["import_source_type"]
          config?: Json
          polling_interval_minutes?: number
          default_document_type?: string
          derive_supplier_from_folder?: boolean
          is_active?: boolean
          last_scan_at?: string | null
          next_scan_at?: string | null
          last_error?: string | null
          error_count?: number
          stats_total_processed?: number
          stats_total_errors?: number
          stats_total_duplicates?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      processed_files: {
        Row: {
          id: string
          source_id: string
          file_path: string
          file_name: string
          file_hash: string | null
          file_size: number | null
          document_id: string | null
          status: Database["public"]["Enums"]["processed_file_status"]
          error_message: string | null
          moved_to: string | null
          processed_at: string
        }
        Insert: {
          id?: string
          source_id: string
          file_path: string
          file_name: string
          file_hash?: string | null
          file_size?: number | null
          document_id?: string | null
          status?: Database["public"]["Enums"]["processed_file_status"]
          error_message?: string | null
          moved_to?: string | null
          processed_at?: string
        }
        Update: {
          id?: string
          source_id?: string
          file_path?: string
          file_name?: string
          file_hash?: string | null
          file_size?: number | null
          document_id?: string | null
          status?: Database["public"]["Enums"]["processed_file_status"]
          error_message?: string | null
          moved_to?: string | null
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processed_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_identifiers: {
        Row: {
          created_at: string | null
          id: string
          identifier_type: string
          identifier_value: string
          is_active: boolean
          operator: string
          priority: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier_type: string
          identifier_value: string
          is_active?: boolean
          operator?: string
          priority?: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier_type?: string
          identifier_value?: string
          is_active?: boolean
          operator?: string
          priority?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_identifiers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          iban: string | null
          id: string
          name: string
          notes: string | null
          tax_number: string | null
          updated_at: string
          ust_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name: string
          notes?: string | null
          tax_number?: string | null
          updated_at?: string
          ust_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name?: string
          notes?: string | null
          tax_number?: string | null
          updated_at?: string
          ust_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          extraction_auto_create_articles: boolean
          match_threshold_auto: number
          match_threshold_suggestion: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          extraction_auto_create_articles?: boolean
          match_threshold_auto?: number
          match_threshold_suggestion?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          extraction_auto_create_articles?: boolean
          match_threshold_auto?: number
          match_threshold_suggestion?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string | null
          created_at: string
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          abbreviation?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          name: string | null
          password_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string | null
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string | null
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      autocomplete_articles: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          article_number: string
          id: string
          name: string
          unit_abbreviation: string
          unit_name: string
        }[]
      }
      find_document_duplicates: {
        Args: Record<PropertyKey, never>
        Returns: {
          doc_a_filename: string
          doc_a_id: string
          doc_a_uploaded_at: string
          doc_b_filename: string
          doc_b_id: string
          doc_b_uploaded_at: string
        }[]
      }
      find_similar_articles: {
        Args: {
          exclude_id?: string
          max_results?: number
          search_query: string
          similarity_threshold?: number
        }
        Returns: {
          article_number: string
          id: string
          name: string
          similarity: number
        }[]
      }
      find_similar_suppliers: {
        Args: {
          exclude_id?: string
          max_results?: number
          search_query: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
      }
      get_article_ids_by_tags: {
        Args: { tag_ids: string[] }
        Returns: {
          article_id: string
        }[]
      }
      get_similarity: {
        Args: { text1: string; text2: string }
        Returns: number
      }
      get_tag_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          article_count: number
          tag_color: string
          tag_id: string
          tag_name: string
        }[]
      }
      search_articles: {
        Args: { search_query: string; similarity_threshold?: number }
        Returns: {
          article_number: string
          description: string
          id: string
          name: string
          rank: number
          search_type: string
        }[]
      }
      search_articles_semantic: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          max_results?: number
        }
        Returns: {
          id: string
          name: string
          article_number: string | null
          description: string | null
          similarity: number
        }[]
      }
      search_articles_hybrid: {
        Args: {
          search_query: string
          query_embedding?: string | null
          keyword_weight?: number
          semantic_weight?: number
          max_results?: number
        }
        Returns: {
          id: string
          name: string
          article_number: string | null
          description: string | null
          keyword_score: number
          semantic_score: number
          combined_score: number
        }[]
      }
    }
    Enums: {
      audit_action: "insert" | "update" | "delete"
      document_status:
        | "pending"
        | "processing"
        | "reviewed"
        | "rejected"
        | "completed"
      document_type: "invoice" | "quote" | "manual"
      extraction_status: "pending_review" | "approved" | "rejected"
      user_role: "admin" | "user" | "readonly"
      import_source_type: "local" | "smb" | "s3" | "gdrive" | "dropbox"
      processed_file_status: "processed" | "duplicate" | "error"
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
      audit_action: ["insert", "update", "delete"],
      document_status: [
        "pending",
        "processing",
        "reviewed",
        "rejected",
        "completed",
      ],
      document_type: ["invoice", "quote", "manual"],
      extraction_status: ["pending_review", "approved", "rejected"],
      user_role: ["admin", "user", "readonly"],
      import_source_type: ["local", "smb", "s3", "gdrive", "dropbox"],
      processed_file_status: ["processed", "duplicate", "error"],
    },
  },
} as const

// Convenience type aliases
export type Supplier = Tables<"suppliers">
export type SupplierInsert = TablesInsert<"suppliers">
export type SupplierUpdate = TablesUpdate<"suppliers">

export type Unit = Tables<"units">
export type UnitInsert = TablesInsert<"units">
export type UnitUpdate = TablesUpdate<"units">

export type Tag = Tables<"tags">
export type TagInsert = TablesInsert<"tags">
export type TagUpdate = TablesUpdate<"tags">

export type Article = Tables<"articles">
export type ArticleInsert = TablesInsert<"articles">
export type ArticleUpdate = TablesUpdate<"articles">

export type ArticleTag = Tables<"article_tags">
export type ArticleTagInsert = TablesInsert<"article_tags">
export type ArticleTagUpdate = TablesUpdate<"article_tags">

export type Document = Tables<"documents">
export type DocumentInsert = TablesInsert<"documents">
export type DocumentUpdate = TablesUpdate<"documents">

export type Extraction = Tables<"extractions">
export type ExtractionInsert = TablesInsert<"extractions">
export type ExtractionUpdate = TablesUpdate<"extractions">

export type Price = Tables<"prices">
export type PriceInsert = TablesInsert<"prices">
export type PriceUpdate = TablesUpdate<"prices">

export type User = Tables<"users">
export type UserInsert = TablesInsert<"users">
export type UserUpdate = TablesUpdate<"users">

export type AuditLog = Tables<"audit_log">
export type AuditLogInsert = TablesInsert<"audit_log">
export type AuditLogUpdate = TablesUpdate<"audit_log">

export type DuplicateExclusion = Tables<"duplicate_exclusions">
export type DuplicateExclusionInsert = TablesInsert<"duplicate_exclusions">
export type DuplicateExclusionUpdate = TablesUpdate<"duplicate_exclusions">

export type SearchProfile = Tables<"search_profiles">
export type SearchProfileInsert = TablesInsert<"search_profiles">
export type SearchProfileUpdate = TablesUpdate<"search_profiles">

export type ChatSession = Tables<"chat_sessions">
export type ChatSessionInsert = TablesInsert<"chat_sessions">
export type ChatSessionUpdate = TablesUpdate<"chat_sessions">

export type ChatMessage = Tables<"chat_messages">
export type ChatMessageInsert = TablesInsert<"chat_messages">
export type ChatMessageUpdate = TablesUpdate<"chat_messages">

export type SupplierIdentifier = Tables<"supplier_identifiers">
export type SupplierIdentifierInsert = TablesInsert<"supplier_identifiers">
export type SupplierIdentifierUpdate = TablesUpdate<"supplier_identifiers">

export type SupplierBlocklist = Tables<"supplier_blocklist">
export type SupplierBlocklistInsert = TablesInsert<"supplier_blocklist">
export type SupplierBlocklistUpdate = TablesUpdate<"supplier_blocklist">

export type ImportSource = Tables<"import_sources">
export type ImportSourceInsert = TablesInsert<"import_sources">
export type ImportSourceUpdate = TablesUpdate<"import_sources">

export type ProcessedFile = Tables<"processed_files">
export type ProcessedFileInsert = TablesInsert<"processed_files">
export type ProcessedFileUpdate = TablesUpdate<"processed_files">

// Enum types
export type DocumentType = Enums<"document_type">
export type DocumentStatus = Enums<"document_status">
export type ExtractionStatus = Enums<"extraction_status">
export type UserRole = Enums<"user_role">
export type AuditAction = Enums<"audit_action">
export type ImportSourceType = Enums<"import_source_type">
export type ProcessedFileStatus = Enums<"processed_file_status">
