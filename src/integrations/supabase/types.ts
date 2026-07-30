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
      billing_events: {
        Row: {
          amount_total: string | null
          billed_at: string | null
          created_at: string
          currency_code: string | null
          environment: string
          event_type: string
          id: string
          invoice_url: string | null
          paddle_subscription_id: string | null
          paddle_transaction_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_total?: string | null
          billed_at?: string | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          event_type: string
          id?: string
          invoice_url?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id: string
          status: string
          user_id: string
        }
        Update: {
          amount_total?: string | null
          billed_at?: string | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          event_type?: string
          id?: string
          invoice_url?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      counterparties: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_statements: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          debt_id: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_statements_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_statements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          auto_apply_transactions: boolean
          created_at: string
          credit_limit: number | null
          current_balance: number
          cutoff_day: number | null
          debt_type: string
          due_day: number | null
          id: string
          interest_rate: number
          minimum_payment: number
          name: string
          notes: string | null
          spend_limit_daily: number | null
          spend_limit_monthly: number | null
          spend_limit_weekly: number | null
          statement_balance: number
          status: string
          target_payoff_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_apply_transactions?: boolean
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          cutoff_day?: number | null
          debt_type?: string
          due_day?: number | null
          id?: string
          interest_rate?: number
          minimum_payment?: number
          name: string
          notes?: string | null
          spend_limit_daily?: number | null
          spend_limit_monthly?: number | null
          spend_limit_weekly?: number | null
          statement_balance?: number
          status?: string
          target_payoff_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_apply_transactions?: boolean
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          cutoff_day?: number | null
          debt_type?: string
          due_day?: number | null
          id?: string
          interest_rate?: number
          minimum_payment?: number
          name?: string
          notes?: string | null
          spend_limit_daily?: number | null
          spend_limit_monthly?: number | null
          spend_limit_weekly?: number | null
          statement_balance?: number
          status?: string
          target_payoff_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      detected_transactions: {
        Row: {
          amount: number | null
          approved_transaction_id: string | null
          created_at: string
          currency: string
          dedupe_key: string | null
          detected_at: string
          id: string
          merchant: string | null
          notification_title: string | null
          package_name: string
          raw_text: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          approved_transaction_id?: string | null
          created_at?: string
          currency?: string
          dedupe_key?: string | null
          detected_at?: string
          id?: string
          merchant?: string | null
          notification_title?: string | null
          package_name: string
          raw_text: string
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          approved_transaction_id?: string | null
          created_at?: string
          currency?: string
          dedupe_key?: string | null
          detected_at?: string
          id?: string
          merchant?: string | null
          notification_title?: string | null
          package_name?: string
          raw_text?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detected_transactions_approved_transaction_id_fkey"
            columns: ["approved_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pockets: {
        Row: {
          accessibility: string
          color: string
          created_at: string
          current_balance: number
          earns_yield: boolean
          id: string
          is_locked_savings: boolean
          name: string
          purpose: string
          sort_order: number
          spend_limit_daily: number | null
          spend_limit_monthly: number | null
          spend_limit_weekly: number | null
          target_percentage: number
          updated_at: string
          user_id: string
          yield_base_balance: number | null
          yield_rate: number | null
          yield_start_date: string | null
        }
        Insert: {
          accessibility?: string
          color?: string
          created_at?: string
          current_balance?: number
          earns_yield?: boolean
          id?: string
          is_locked_savings?: boolean
          name: string
          purpose?: string
          sort_order?: number
          spend_limit_daily?: number | null
          spend_limit_monthly?: number | null
          spend_limit_weekly?: number | null
          target_percentage?: number
          updated_at?: string
          user_id: string
          yield_base_balance?: number | null
          yield_rate?: number | null
          yield_start_date?: string | null
        }
        Update: {
          accessibility?: string
          color?: string
          created_at?: string
          current_balance?: number
          earns_yield?: boolean
          id?: string
          is_locked_savings?: boolean
          name?: string
          purpose?: string
          sort_order?: number
          spend_limit_daily?: number | null
          spend_limit_monthly?: number | null
          spend_limit_weekly?: number | null
          target_percentage?: number
          updated_at?: string
          user_id?: string
          yield_base_balance?: number | null
          yield_rate?: number | null
          yield_start_date?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          annual_yield_rate: number
          biweekly_salary: number
          created_at: string
          full_name: string | null
          global_spend_limit_monthly: number | null
          id: string
          payday_days: number[] | null
          payday_offset_days: number
          payday_weekend_to_friday: boolean
          plan: string
          pro_expires_at: string | null
          salary_frequency: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          annual_yield_rate?: number
          biweekly_salary?: number
          created_at?: string
          full_name?: string | null
          global_spend_limit_monthly?: number | null
          id: string
          payday_days?: number[] | null
          payday_offset_days?: number
          payday_weekend_to_friday?: boolean
          plan?: string
          pro_expires_at?: string | null
          salary_frequency?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          annual_yield_rate?: number
          biweekly_salary?: number
          created_at?: string
          full_name?: string | null
          global_spend_limit_monthly?: number | null
          id?: string
          payday_days?: number[] | null
          payday_offset_days?: number
          payday_weekend_to_friday?: boolean
          plan?: string
          pro_expires_at?: string | null
          salary_frequency?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_flows: {
        Row: {
          amount: number
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          flow_type: string
          frequency: string
          id: string
          next_execution_date: string | null
          pocket_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          flow_type: string
          frequency: string
          id?: string
          next_execution_date?: string | null
          pocket_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          flow_type?: string
          frequency?: string
          id?: string
          next_execution_date?: string | null
          pocket_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_flows_pocket_id_fkey"
            columns: ["pocket_id"]
            isOneToOne: false
            referencedRelation: "pockets"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          counterparty_id: string | null
          created_at: string
          debt_id: string | null
          description: string
          id: string
          include_in_totals: boolean
          kind: string
          notes: string | null
          occurred_at: string
          pocket_id: string | null
          purpose: string | null
          statement_cutoff: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          counterparty_id?: string | null
          created_at?: string
          debt_id?: string | null
          description?: string
          id?: string
          include_in_totals?: boolean
          kind?: string
          notes?: string | null
          occurred_at?: string
          pocket_id?: string | null
          purpose?: string | null
          statement_cutoff?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          counterparty_id?: string | null
          created_at?: string
          debt_id?: string | null
          description?: string
          id?: string
          include_in_totals?: boolean
          kind?: string
          notes?: string | null
          occurred_at?: string
          pocket_id?: string | null
          purpose?: string | null
          statement_cutoff?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_pocket_id_fkey"
            columns: ["pocket_id"]
            isOneToOne: false
            referencedRelation: "pockets"
            referencedColumns: ["id"]
          },
        ]
      }
      yield_simulations: {
        Row: {
          annual_rate: number
          created_at: string
          deposit_amount: number
          deposit_freq: string
          horizon_months: number
          id: string
          initial_balance: number
          title: string
          user_id: string
          withdrawal_amount: number
          withdrawal_freq: string
        }
        Insert: {
          annual_rate: number
          created_at?: string
          deposit_amount?: number
          deposit_freq?: string
          horizon_months?: number
          id?: string
          initial_balance: number
          title: string
          user_id: string
          withdrawal_amount?: number
          withdrawal_freq?: string
        }
        Update: {
          annual_rate?: number
          created_at?: string
          deposit_amount?: number
          deposit_freq?: string
          horizon_months?: number
          id?: string
          initial_balance?: number
          title?: string
          user_id?: string
          withdrawal_amount?: number
          withdrawal_freq?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_tx_effects: {
        Args: {
          _amount: number
          _debt_id: string
          _include: boolean
          _kind: string
          _pocket_id: string
          _sign: number
        }
        Returns: undefined
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
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
