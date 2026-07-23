import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

export const resolvePaddlePrice = createServerFn({ method: "POST" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to resolve price: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

export interface DiscountStatus {
  id: string;
  code: string;
  available: boolean;
  timesUsed: number;
  usageLimit: number | null;
  type: string;
  amount: string;
  currencyCode: string | null;
}

export const getDiscountStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/discounts?code=${encodeURIComponent(data.code)}&status=active`,
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to resolve discount: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    const discount = result.data?.[0];
    if (!discount) {
      return { available: false } as { available: false };
    }
    const available =
      discount.status === "active" &&
      (discount.usage_limit === null || discount.times_used < discount.usage_limit) &&
      (discount.expires_at === null || new Date(discount.expires_at) > new Date());
    return {
      id: discount.id,
      code: discount.code,
      available,
      timesUsed: discount.times_used,
      usageLimit: discount.usage_limit,
      type: discount.type,
      amount: discount.amount,
      currencyCode: discount.currency_code,
    } as DiscountStatus;
  });

