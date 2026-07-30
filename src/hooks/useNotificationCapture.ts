import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  NotificationCapture,
  isNativeAndroid,
  type BankNotificationEvent,
} from "@/lib/native/notificationCapture";
import { toast } from "sonner";

const DEFAULT_PACKAGES = [
  "com.bbva.bbvacontigo",
  "mx.com.santander.appsantander",
  "com.banorte.rmb.movil",
  "com.nu.production",
  "com.mercadopago.wallet",
  "com.bancoazteca.bazdigitalmovil",
  "com.hsbc.hsbcnetmobile",
  "com.citibanamex.banamexmovil",
];

/**
 * Bridge between the Android notification-listener plugin and Supabase.
 *
 * Mount once at the authenticated layout. On native Android it:
 *   - reports whether the user has granted "Notification access"
 *   - exposes helpers to open the settings screen and manage the allowlist
 *   - subscribes to the plugin's `bankNotification` event and inserts each
 *     parsed notification into `detected_transactions` (dedupe key covers
 *     the same raw text arriving twice within a minute)
 *
 * On the web build every helper is a safe no-op.
 */
export function useNotificationCapture(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [supported] = useState(isNativeAndroid);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [watchedPackages, setWatchedPackagesState] = useState<string[]>(DEFAULT_PACKAGES);

  // Poll permission + watched apps whenever the user returns to the app.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    const refresh = async () => {
      const [{ granted }, { packages }] = await Promise.all([
        NotificationCapture.isPermissionGranted(),
        NotificationCapture.getWatchedPackages(),
      ]);
      if (cancelled) return;
      setPermissionGranted(granted);
      // Older APK binaries serialize the package list as a string instead of a
      // JS array (Kotlin List put straight into JSObject). Normalize so a bad
      // shape can never crash consumers calling array methods on this state.
      const list = Array.isArray(packages) ? packages.filter((p): p is string => typeof p === "string") : [];
      setWatchedPackagesState(list.length ? list : DEFAULT_PACKAGES);
    };
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supported]);

  // Live subscription to incoming bank notifications → insert into DB.
  useEffect(() => {
    if (!supported || !userId) return;
    let handle: { remove: () => Promise<void> } | null = null;
    let disposed = false;

    (async () => {
      const h = await NotificationCapture.addListener(
        "bankNotification",
        async (event: BankNotificationEvent) => {
          try {
            const dedupe = `${event.packageName}:${Math.floor(event.timestamp / 60000)}:${event.rawText.slice(0, 80)}`;
            const { error } = await supabase.from("detected_transactions").insert({
              user_id: userId,
              amount: event.amount ?? null,
              currency: event.currency ?? "MXN",
              merchant: event.merchant ?? null,
              type: (event.type ?? "unknown") as
                | "charge"
                | "credit"
                | "transfer"
                | "payment"
                | "unknown",
              raw_text: event.rawText,
              notification_title: event.title ?? null,
              package_name: event.packageName,
              detected_at: new Date(event.timestamp || Date.now()).toISOString(),
              dedupe_key: dedupe,
              status: "pending",
            });
            if (error && !/duplicate key/i.test(error.message)) throw error;
            queryClient.invalidateQueries({ queryKey: ["detected_transactions"] });
            toast.success("Nueva transacción detectada", {
              description: event.merchant
                ? `${event.merchant} · ${event.amount ?? "?"} ${event.currency}`
                : event.rawText.slice(0, 80),
            });
          } catch (e) {
            console.error("[notification-capture] insert failed", e);
          }
        },
      );
      if (disposed) await h.remove();
      else handle = h;
    })();

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, [supported, userId, queryClient]);

  return {
    supported,
    permissionGranted,
    watchedPackages,
    async requestPermission() {
      if (!supported) return;
      await NotificationCapture.openPermissionSettings();
    },
    async setWatchedPackages(packages: string[]) {
      if (!supported) return;
      await NotificationCapture.setWatchedPackages({ packages });
      setWatchedPackagesState(packages);
    },
    async refreshPermission() {
      if (!supported) return;
      const { granted } = await NotificationCapture.isPermissionGranted();
      setPermissionGranted(granted);
    },
  };
}
