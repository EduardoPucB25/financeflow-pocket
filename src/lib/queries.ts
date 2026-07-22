import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
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

export const cardsQuery = () =>
  queryOptions({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .order("card_name");
      if (error) throw error;
      return data ?? [];
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

/** Seed default 4 pockets if the user has none. Idempotent. */
export async function seedDefaultPockets(userId: string) {
  const { data: existing, error } = await supabase.from("pockets").select("id").limit(1);
  if (error) throw error;
  if (existing && existing.length > 0) return;
  const defaults = [
    { name: "Growth 25%", target_percentage: 25, color: "#10B981", sort_order: 1 },
    { name: "Valores 20%", target_percentage: 20, color: "#8B5CF6", sort_order: 2 },
    { name: "Stability 15%", target_percentage: 15, color: "#F59E0B", sort_order: 3, is_locked_savings: true },
    { name: "Essential 40%", target_percentage: 40, color: "#0EA5E9", sort_order: 4 },
  ];
  await supabase.from("pockets").insert(defaults.map((d) => ({ ...d, user_id: userId })));
}
