import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getPaddleEnvironment } from "@/lib/paddle";

export const detectedTransactionsQuery = () =>
  queryOptions({
    queryKey: ["detected_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("detected_transactions")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const subscriptionQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["subscription", userId, getPaddleEnvironment()],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

export const billingEventsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["billing_events", userId, getPaddleEnvironment()],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("billing_events")
        .select("*")
        .eq("user_id", userId)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

export const pocketsQuery = () =>
  queryOptions({
    queryKey: ["pockets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pockets")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const debtsQuery = () =>
  queryOptions({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/** Row shape for debt_statements, sourced from the generated DB types. */
export type DebtStatementRow =
  Database["public"]["Tables"]["debt_statements"]["Row"] & {
    status: "pending" | "paid";
  };

export const debtStatementsQuery = () =>
  queryOptions({
    queryKey: ["debt_statements"],
    queryFn: async (): Promise<DebtStatementRow[]> => {
      const { data, error } = await supabase
        .from("debt_statements")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DebtStatementRow[];
    },
  });

export const flowsQuery = () =>
  queryOptions({
    queryKey: ["scheduled_flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_flows")
        .select("*")
        .order("next_execution_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const simulationsQuery = () =>
  queryOptions({
    queryKey: ["yield_simulations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("yield_simulations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const counterpartiesQuery = () =>
  queryOptions({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const transactionsQuery = () =>
  queryOptions({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Seed default 4 pockets if the user has none. Idempotent. */
export async function seedDefaultPockets(userId: string) {
  const { data: existing, error } = await supabase.from("pockets").select("id").limit(1);
  if (error) throw error;
  if (existing && existing.length > 0) return;
  const defaults = [
    { name: "Growth 25%", target_percentage: 25, color: "#10B981", sort_order: 1, is_locked_savings: false },
    { name: "Valores 20%", target_percentage: 20, color: "#8B5CF6", sort_order: 2, is_locked_savings: false },
    { name: "Stability 15%", target_percentage: 15, color: "#F59E0B", sort_order: 3, is_locked_savings: true },
    { name: "Essential 40%", target_percentage: 40, color: "#0EA5E9", sort_order: 4, is_locked_savings: false },
  ];
  await supabase.from("pockets").insert(defaults.map((d) => ({ ...d, user_id: userId })));
}
