import { createServerFn } from "@tanstack/react-start";
import { getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Create a Paddle customer portal session and return the overview URL. */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, paddle_customer_id, environment")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No hay suscripción activa para gestionar.");

    const paddle = getPaddleClient(data.environment);
    const session = await paddle.customerPortalSessions.create(sub.paddle_customer_id as string, [
      sub.paddle_subscription_id as string,
    ]);

    const subscriptionUrl = session.urls?.subscriptions?.[0]?.cancelSubscription
      ?? session.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod
      ?? session.urls?.general?.overview;

    return {
      overviewUrl: session.urls?.general?.overview ?? subscriptionUrl,
      cancelUrl: session.urls?.subscriptions?.[0]?.cancelSubscription ?? null,
    };
  });
