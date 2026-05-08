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
      alerts_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string
          id: string
          status: string
          suggestion_id: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string
          id?: string
          status?: string
          suggestion_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string
          id?: string
          status?: string
          suggestion_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_log_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      markets_cache: {
        Row: {
          category: string
          change_24h: number
          end_date: string
          id: string
          no_price: number | null
          question: string | null
          source: string
          total_volume: number
          trend: string
          updated_at: string
          volume_24h: number
          yes_price: number | null
        }
        Insert: {
          category?: string
          change_24h?: number
          end_date?: string
          id: string
          no_price?: number | null
          question?: string | null
          source?: string
          total_volume?: number
          trend?: string
          updated_at?: string
          volume_24h?: number
          yes_price?: number | null
        }
        Update: {
          category?: string
          change_24h?: number
          end_date?: string
          id?: string
          no_price?: number | null
          question?: string | null
          source?: string
          total_volume?: number
          trend?: string
          updated_at?: string
          volume_24h?: number
          yes_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alert_email: string
          alert_threshold: number
          bankroll: number
          compact_cards: boolean
          created_at: string
          dark_mode: boolean
          discord_enabled: boolean
          discord_webhook: string
          email_enabled: boolean
          email_frequency: string
          favorite_categories: string[]
          id: string
          kelly_multiplier: number
          max_position: number
          min_confidence: number
          scan_interval: string
          show_position_details: boolean
          show_wallet_addresses: boolean
          telegram_chat_id: string
          telegram_enabled: boolean
          updated_at: string
        }
        Insert: {
          alert_email?: string
          alert_threshold?: number
          bankroll?: number
          compact_cards?: boolean
          created_at?: string
          dark_mode?: boolean
          discord_enabled?: boolean
          discord_webhook?: string
          email_enabled?: boolean
          email_frequency?: string
          favorite_categories?: string[]
          id: string
          kelly_multiplier?: number
          max_position?: number
          min_confidence?: number
          scan_interval?: string
          show_position_details?: boolean
          show_wallet_addresses?: boolean
          telegram_chat_id?: string
          telegram_enabled?: boolean
          updated_at?: string
        }
        Update: {
          alert_email?: string
          alert_threshold?: number
          bankroll?: number
          compact_cards?: boolean
          created_at?: string
          dark_mode?: boolean
          discord_enabled?: boolean
          discord_webhook?: string
          email_enabled?: boolean
          email_frequency?: string
          favorite_categories?: string[]
          id?: string
          kelly_multiplier?: number
          max_position?: number
          min_confidence?: number
          scan_interval?: string
          show_position_details?: boolean
          show_wallet_addresses?: boolean
          telegram_chat_id?: string
          telegram_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          cross_market_edge: string
          current_odds: number | null
          direction: string
          edge: number | null
          expires_at: string | null
          id: string
          key_signals: string[]
          market_id: string
          pnl: number | null
          question: string
          reasoning: string
          resolved_at: string | null
          source: string
          status: string
          suggested_amount: number | null
          user_id: string
          wallet_signals: string[]
        }
        Insert: {
          category?: string
          confidence?: number | null
          created_at?: string
          cross_market_edge?: string
          current_odds?: number | null
          direction: string
          edge?: number | null
          expires_at?: string | null
          id?: string
          key_signals?: string[]
          market_id: string
          pnl?: number | null
          question: string
          reasoning?: string
          resolved_at?: string | null
          source?: string
          status?: string
          suggested_amount?: number | null
          user_id: string
          wallet_signals?: string[]
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          cross_market_edge?: string
          current_odds?: number | null
          direction?: string
          edge?: number | null
          expires_at?: string | null
          id?: string
          key_signals?: string[]
          market_id?: string
          pnl?: number | null
          question?: string
          reasoning?: string
          resolved_at?: string | null
          source?: string
          status?: string
          suggested_amount?: number | null
          user_id?: string
          wallet_signals?: string[]
        }
        Relationships: []
      }
      tracked_wallets: {
        Row: {
          address: string
          consistency: number
          created_at: string
          id: string
          is_auto_discovered: boolean
          label: string
          last_scanned: string
          recent_trades: number
          roi_30d: number
          sharpe: number
          tier: string
          total_volume: number
          user_id: string
          win_rate: number
        }
        Insert: {
          address: string
          consistency?: number
          created_at?: string
          id?: string
          is_auto_discovered?: boolean
          label?: string
          last_scanned?: string
          recent_trades?: number
          roi_30d?: number
          sharpe?: number
          tier?: string
          total_volume?: number
          user_id: string
          win_rate?: number
        }
        Update: {
          address?: string
          consistency?: number
          created_at?: string
          id?: string
          is_auto_discovered?: boolean
          label?: string
          last_scanned?: string
          recent_trades?: number
          roi_30d?: number
          sharpe?: number
          tier?: string
          total_volume?: number
          user_id?: string
          win_rate?: number
        }
        Relationships: []
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
