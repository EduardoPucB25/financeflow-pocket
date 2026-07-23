import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export interface SubscriptionStatus {
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  priceId: string | null;
  isLoading: boolean;
}

export function useSubscription(userId: string | undefined) {
  const [state, setState] = useState<SubscriptionStatus>({
    isPro: false,
    status: null,
    currentPeriodEnd: null,
    priceId: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!userId) return;

    const environment = getPaddleEnvironment();

    async function load() {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("useSubscription error:", error);
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const isActive =
        !!data &&
        (data.status === "active" || data.status === "trialing" ||
          (data.status === "canceled" && data.current_period_end && new Date(data.current_period_end) > new Date()));

      setState({
        isPro: Boolean(isActive),
        status: data?.status ?? null,
        currentPeriodEnd: data?.current_period_end ?? null,
        priceId: data?.price_id ?? null,
        isLoading: false,
      } as SubscriptionStatus);
    }

    load();

    const channel = supabase
      .channel("subscriptions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return state;
}
