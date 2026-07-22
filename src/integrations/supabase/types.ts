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
      api_usage: {
        Row: {
          created_at: string
          id: string
          provider: string
          request_count: number
          updated_at: string
          used_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          request_count?: number
          updated_at?: string
          used_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          request_count?: number
          updated_at?: string
          used_at?: string
        }
        Relationships: []
      }
      beta_tester_allowlist: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      bets: {
        Row: {
          amount: number
          bet_type: string
          created_at: string
          current_line: number | null
          current_odds: number | null
          game_date: string | null
          id: string
          last_line_check: string | null
          line_alerts: Json
          notes: string | null
          odds: number
          opening_line: number | null
          opening_odds: number | null
          pick: string
          profit_loss: number | null
          resolved_at: string | null
          sport: string
          sportsbook: string | null
          status: string
          suggestion_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bet_type?: string
          created_at?: string
          current_line?: number | null
          current_odds?: number | null
          game_date?: string | null
          id?: string
          last_line_check?: string | null
          line_alerts?: Json
          notes?: string | null
          odds: number
          opening_line?: number | null
          opening_odds?: number | null
          pick: string
          profit_loss?: number | null
          resolved_at?: string | null
          sport?: string
          sportsbook?: string | null
          status?: string
          suggestion_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bet_type?: string
          created_at?: string
          current_line?: number | null
          current_odds?: number | null
          game_date?: string | null
          id?: string
          last_line_check?: string | null
          line_alerts?: Json
          notes?: string | null
          odds?: number
          opening_line?: number | null
          opening_odds?: number | null
          pick?: string
          profit_loss?: number | null
          resolved_at?: string | null
          sport?: string
          sportsbook?: string | null
          status?: string
          suggestion_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      golf_cache: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at: string
          key: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      internal_cron_secrets: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
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
      outcomes_log: {
        Row: {
          american: number
          bookmaker: string
          category: string
          event_key: string
          event_name: string | null
          fetched_at: string
          id: string
          implied: number
          league: string | null
          market_key: string
          market_type: string
          modifier: number | null
          outcome_type: string
          participant_key: string | null
          participant_name: string | null
          payout: number
          source: string
          start_time: string | null
        }
        Insert: {
          american: number
          bookmaker: string
          category: string
          event_key: string
          event_name?: string | null
          fetched_at?: string
          id?: string
          implied: number
          league?: string | null
          market_key: string
          market_type: string
          modifier?: number | null
          outcome_type: string
          participant_key?: string | null
          participant_name?: string | null
          payout: number
          source: string
          start_time?: string | null
        }
        Update: {
          american?: number
          bookmaker?: string
          category?: string
          event_key?: string
          event_name?: string | null
          fetched_at?: string
          id?: string
          implied?: number
          league?: string | null
          market_key?: string
          market_type?: string
          modifier?: number | null
          outcome_type?: string
          participant_key?: string | null
          participant_name?: string | null
          payout?: number
          source?: string
          start_time?: string | null
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
          is_beta_tester: boolean
          is_demo: boolean
          is_trial: boolean
          kelly_multiplier: number
          max_position: number
          min_confidence: number
          scan_interval: string
          show_position_details: boolean
          show_wallet_addresses: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string
          subscription_tier: string
          telegram_chat_id: string
          telegram_enabled: boolean
          trial_ends_at: string | null
          trial_started_at: string | null
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
          is_beta_tester?: boolean
          is_demo?: boolean
          is_trial?: boolean
          kelly_multiplier?: number
          max_position?: number
          min_confidence?: number
          scan_interval?: string
          show_position_details?: boolean
          show_wallet_addresses?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          telegram_chat_id?: string
          telegram_enabled?: boolean
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
          is_beta_tester?: boolean
          is_demo?: boolean
          is_trial?: boolean
          kelly_multiplier?: number
          max_position?: number
          min_confidence?: number
          scan_interval?: string
          show_position_details?: boolean
          show_wallet_addresses?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          telegram_chat_id?: string
          telegram_enabled?: boolean
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
          origin: string
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
          origin?: string
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
          origin?: string
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
      wallet_scan_run_users: {
        Row: {
          buckets_generated: number
          buckets_selected: number
          created_at: string
          id: string
          run_id: string
          signals_created: number
          trades_seen: number
          user_id: string
        }
        Insert: {
          buckets_generated?: number
          buckets_selected?: number
          created_at?: string
          id?: string
          run_id: string
          signals_created?: number
          trades_seen?: number
          user_id: string
        }
        Update: {
          buckets_generated?: number
          buckets_selected?: number
          created_at?: string
          id?: string
          run_id?: string
          signals_created?: number
          trades_seen?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_scan_run_users_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "wallet_scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_scan_runs: {
        Row: {
          cap_hit: boolean
          claude_calls: number
          id: string
          notes: string | null
          ran_at: string
          signals_created: number
          trades_seen: number
          users_scanned: number
        }
        Insert: {
          cap_hit?: boolean
          claude_calls?: number
          id?: string
          notes?: string | null
          ran_at?: string
          signals_created?: number
          trades_seen?: number
          users_scanned?: number
        }
        Update: {
          cap_hit?: boolean
          claude_calls?: number
          id?: string
          notes?: string | null
          ran_at?: string
          signals_created?: number
          trades_seen?: number
          users_scanned?: number
        }
        Relationships: []
      }
      wallet_signal_cursors: {
        Row: {
          last_processed_at: string | null
          last_processed_trade_id: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          last_processed_at?: string | null
          last_processed_trade_id?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          last_processed_at?: string | null
          last_processed_trade_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_admin_by_email: { Args: { _email: string }; Returns: Json }
      grant_beta_tester_by_email: { Args: { _email: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      outcomes_log_stats: { Args: never; Returns: Json }
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
