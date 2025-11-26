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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      instruments: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at: string
          id: string
          is_active: boolean | null
          name: string | null
          symbol: string
          tick_size: number | null
          tick_value: number | null
          user_id: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          symbol: string
          tick_size?: number | null
          tick_value?: number | null
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          symbol?: string
          tick_size?: number | null
          tick_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          id: string
          mood: Database["public"]["Enums"]["mood_type"] | null
          text: string
          trading_day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood_type"] | null
          text: string
          trading_day: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood_type"] | null
          text?: string
          trading_day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string | null
          created_at: string
          default_account_type:
            | Database["public"]["Enums"]["account_type"]
            | null
          default_risk_percent: number | null
          id: string
          name: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string | null
          created_at?: string
          default_account_type?:
            | Database["public"]["Enums"]["account_type"]
            | null
          default_risk_percent?: number | null
          id: string
          name?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string | null
          created_at?: string
          default_account_type?:
            | Database["public"]["Enums"]["account_type"]
            | null
          default_risk_percent?: number | null
          id?: string
          name?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          end_time_utc: string | null
          id: string
          is_active: boolean | null
          name: string
          start_time_utc: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time_utc?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_time_utc?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_time_utc?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_time_utc?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          checklist: string[] | null
          created_at: string
          description: string | null
          example_screenshots: string[] | null
          id: string
          is_active: boolean | null
          name: string
          typical_rr_max: number | null
          typical_rr_min: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: string[] | null
          created_at?: string
          description?: string | null
          example_screenshots?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          typical_rr_max?: number | null
          typical_rr_min?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist?: string[] | null
          created_at?: string
          description?: string | null
          example_screenshots?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          typical_rr_max?: number | null
          typical_rr_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_tags: {
        Row: {
          tag_id: string
          trade_id: string
        }
        Insert: {
          tag_id: string
          trade_id: string
        }
        Update: {
          tag_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_tags_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          closed_at: string | null
          created_at: string
          entry_price: number
          equity_after_trade: number | null
          execution_errors: string | null
          exit_price: number | null
          id: string
          instrument_id: string
          mae_points: number | null
          mfe_points: number | null
          notes: string | null
          opened_at: string
          order_type: Database["public"]["Enums"]["order_type"]
          planned_entry_high: number | null
          planned_entry_low: number | null
          pnl_amount: number | null
          pnl_percent: number | null
          pnl_points: number | null
          post_trade_review: string | null
          pre_trade_plan: string | null
          r_multiple: number | null
          rating: number | null
          result: Database["public"]["Enums"]["trade_result"]
          risk_percent: number | null
          screenshot_url: string | null
          session_id: string | null
          side: Database["public"]["Enums"]["trade_side"]
          size_lots: number
          sl_points: number | null
          stop_loss_price: number
          strategy_id: string | null
          tp1_points: number | null
          tp1_price: number | null
          tp2_points: number | null
          tp2_price: number | null
          tp3_points: number | null
          tp3_price: number | null
          trading_day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          closed_at?: string | null
          created_at?: string
          entry_price: number
          equity_after_trade?: number | null
          execution_errors?: string | null
          exit_price?: number | null
          id?: string
          instrument_id: string
          mae_points?: number | null
          mfe_points?: number | null
          notes?: string | null
          opened_at: string
          order_type: Database["public"]["Enums"]["order_type"]
          planned_entry_high?: number | null
          planned_entry_low?: number | null
          pnl_amount?: number | null
          pnl_percent?: number | null
          pnl_points?: number | null
          post_trade_review?: string | null
          pre_trade_plan?: string | null
          r_multiple?: number | null
          rating?: number | null
          result?: Database["public"]["Enums"]["trade_result"]
          risk_percent?: number | null
          screenshot_url?: string | null
          session_id?: string | null
          side: Database["public"]["Enums"]["trade_side"]
          size_lots: number
          sl_points?: number | null
          stop_loss_price: number
          strategy_id?: string | null
          tp1_points?: number | null
          tp1_price?: number | null
          tp2_points?: number | null
          tp2_price?: number | null
          tp3_points?: number | null
          tp3_price?: number | null
          trading_day: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          equity_after_trade?: number | null
          execution_errors?: string | null
          exit_price?: number | null
          id?: string
          instrument_id?: string
          mae_points?: number | null
          mfe_points?: number | null
          notes?: string | null
          opened_at?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          planned_entry_high?: number | null
          planned_entry_low?: number | null
          pnl_amount?: number | null
          pnl_percent?: number | null
          pnl_points?: number | null
          post_trade_review?: string | null
          pre_trade_plan?: string | null
          r_multiple?: number | null
          rating?: number | null
          result?: Database["public"]["Enums"]["trade_result"]
          risk_percent?: number | null
          screenshot_url?: string | null
          session_id?: string | null
          side?: Database["public"]["Enums"]["trade_side"]
          size_lots?: number
          sl_points?: number | null
          stop_loss_price?: number
          strategy_id?: string | null
          tp1_points?: number | null
          tp1_price?: number | null
          tp2_points?: number | null
          tp2_price?: number | null
          tp3_points?: number | null
          tp3_price?: number | null
          trading_day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "live" | "demo" | "prop"
      asset_class: "forex" | "crypto" | "index" | "stock" | "commodity"
      mood_type:
        | "confident"
        | "nervous"
        | "disciplined"
        | "impulsive"
        | "focused"
        | "stressed"
      order_type: "market" | "limit" | "stop"
      trade_result: "win" | "loss" | "breakeven" | "open"
      trade_side: "long" | "short"
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
      account_type: ["live", "demo", "prop"],
      asset_class: ["forex", "crypto", "index", "stock", "commodity"],
      mood_type: [
        "confident",
        "nervous",
        "disciplined",
        "impulsive",
        "focused",
        "stressed",
      ],
      order_type: ["market", "limit", "stop"],
      trade_result: ["win", "loss", "breakeven", "open"],
      trade_side: ["long", "short"],
    },
  },
} as const
