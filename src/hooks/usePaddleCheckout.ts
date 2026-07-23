import { useState } from "react";
import { initializePaddle, getPaddlePriceId, getPaddleEnvironment } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
    discountCode?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      if (typeof window === "undefined" || !window.Paddle) {
        throw new Error("Paddle is not available");
      }

      const checkoutConfig: Record<string, unknown> = {
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      };

      if (options.discountCode) {
        checkoutConfig.discountCode = options.discountCode;
      }

      window.Paddle.Checkout.open(checkoutConfig);
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading, environment: getPaddleEnvironment() };
}

