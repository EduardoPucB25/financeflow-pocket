import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;

  if (!userId) {
    console.error("No userId in customData");
    return;
  }

  const item = items?.[0];
  if (!item) {
    console.error("No items in subscription");
    return;
  }

  const priceId = item.price?.importMeta?.externalId;
  const productId = item.product?.importMeta?.externalId;

  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item.price?.id,
      rawProductId: item.product?.id,
    });
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status: status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );

  await getSupabase().from("profiles").update({ plan: "pro" }).eq("id", userId);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;

  await getSupabase()
    .from("subscriptions")
    .update({
      status: status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod } = data;
  const periodEnd = currentBillingPeriod?.endsAt ? new Date(currentBillingPeriod.endsAt) : null;
  const stillInGracePeriod = periodEnd && periodEnd > new Date();

  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: currentBillingPeriod?.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  // Only reset profiles.plan when the paid access window has actually ended.
  if (!stillInGracePeriod) {
    const { data: row } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_subscription_id", id)
      .maybeSingle();
    if (row?.user_id) {
      await getSupabase().from("profiles").update({ plan: "free" }).eq("id", row.user_id);
    }
  }
}

async function handleTransactionEvent(
  eventType: string,
  data: any,
  env: PaddleEnv,
) {
  const userId = data.customData?.userId;
  if (!userId) return;

  const item = data.items?.[0];
  const total = data.details?.totals?.total ?? null;
  const currency = data.currencyCode ?? null;

  await getSupabase()
    .from("billing_events")
    .upsert(
      {
        user_id: userId,
        paddle_transaction_id: data.id,
        paddle_subscription_id: data.subscriptionId ?? null,
        event_type: eventType,
        status: data.status,
        amount_total: total ? String(total) : null,
        currency_code: currency,
        invoice_url: data.invoiceUrl ?? null,
        environment: env,
        billed_at: data.billedAt ?? item?.billingPeriod?.endsAt ?? null,
      },
      { onConflict: "paddle_transaction_id,event_type" },
    );
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionEvent("completed", event.data, env);
      break;
    case EventName.TransactionPaymentFailed:
      await handleTransactionEvent("payment_failed", event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

