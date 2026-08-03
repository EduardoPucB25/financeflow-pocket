import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  NotificationCapture,
  isNativeAndroid,
  type BankNotificationEvent,
  type DetectedType,
} from "@/lib/native/notificationCapture";
import {
  classifyNotification,
  type Classification,
} from "@/lib/detection/classify";
import {
  matchRule,
  buildTransactionInsert,
  type DetectionRule,
} from "@/lib/detection/rules";
import { appLabelFor } from "@/lib/detection/apps";
import { money } from "@/lib/format";
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
  "com.revolut.revolut",
];

const DET_TYPES = ["charge", "credit", "transfer", "payment", "unknown"];

/** Traduce la clasificación al `type` de detected_transactions (CHECK constraint). */
function detTypeFrom(cls: Classification, nativeType: string | null | undefined): DetectedType {
  if (cls.direction === "unknown") {
    const t = nativeType ?? "unknown";
    return (DET_TYPES.includes(t) ? t : "unknown") as DetectedType;
  }
  if (cls.kind === "income") return "credit";
  if (cls.kind === "payment") return "payment";
  return "charge";
}

// detection_rules / profiles.detection_autopilot aún no están en types.ts
// (migraciones 20260803*). Casts locales hasta que Lovable regenere los tipos.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Deshace un auto-registro: borra la tx (revierte saldos) y reabre la detección. */
async function undoAutoApply(txId: string, detectedId: string, qc: QueryClient) {
  await supabase.from("transactions").delete().eq("id", txId);
  await supabase
    .from("detected_transactions")
    .update({ status: "pending", approved_transaction_id: null })
    .eq("id", detectedId);
  qc.invalidateQueries({ queryKey: ["detected_transactions"] });
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["pockets"] });
  qc.invalidateQueries({ queryKey: ["debts"] });
  toast("Movimiento deshecho");
}

/**
 * Si hay una regla en modo 'auto' para este comercio/app y el autopilot está
 * activo, registra el movimiento directo (aunque la app esté cerrada) y ofrece
 * Deshacer. Devuelve true si registró; false para dejarlo pendiente en el chat.
 */
async function maybeAutoApply(
  detectedId: string,
  cls: Classification,
  amount: number | null,
  merchant: string | null,
  event: BankNotificationEvent,
  userId: string,
  qc: QueryClient,
  occurredAtIso: string,
): Promise<boolean> {
  if (amount == null || amount <= 0) return false;
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("detection_autopilot")
      .maybeSingle();
    if ((prof as any)?.detection_autopilot !== true) return false;

    const { data: rulesRaw } = await (supabase.from("detection_rules" as any) as any).select("*");
    const rule = matchRule(
      { merchant, package_name: event.packageName },
      (rulesRaw ?? []) as DetectionRule[],
    );
    if (!rule || rule.mode !== "auto") return false;

    const insert = buildTransactionInsert(userId, {
      kind: rule.kind || cls.kind,
      amount,
      description: merchant || appLabelFor(event.packageName),
      notes: event.rawText,
      occurredAt: occurredAtIso,
      pocketId: rule.pocket_id,
      debtId: rule.debt_id,
      counterpartyId: rule.counterparty_id,
    });
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert(insert)
      .select("id")
      .single();
    if (txErr || !tx) return false;

    await supabase
      .from("detected_transactions")
      .update({ status: "approved", approved_transaction_id: tx.id })
      .eq("id", detectedId);
    await (supabase.from("detection_rules" as any) as any)
      .update({ hit_count: ((rule as any).hit_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", rule.id);

    qc.invalidateQueries({ queryKey: ["detected_transactions"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["pockets"] });
    qc.invalidateQueries({ queryKey: ["debts"] });

    toast.success(`Registrado: ${merchant ?? appLabelFor(event.packageName)}`, {
      description: `${money(amount)} · automático`,
      action: { label: "Deshacer", onClick: () => void undoAutoApply(tx.id, detectedId, qc) },
    });
    return true;
  } catch (e) {
    console.error("[notification-capture] auto-apply failed", e);
    return false;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Bridge between the Android notification-listener plugin and Supabase.
 *
 * Mount once at the authenticated layout. On native Android it:
 *   - reports whether the user has granted "Notification access"
 *   - exposes helpers to open the settings screen and manage the allowlist
 *   - subscribes to the plugin's `bankNotification` event, re-classifies the
 *     raw text (ES/EN, multi-currency) and inserts into `detected_transactions`
 *     (dedupe key covers the same raw text arriving twice within a minute).
 *     Rules in mode 'auto' (with autopilot on) register the movement directly.
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

  // Live subscription to incoming bank notifications → classify + insert.
  useEffect(() => {
    if (!supported || !userId) return;
    let handle: { remove: () => Promise<void> } | null = null;
    let disposed = false;

    (async () => {
      const h = await NotificationCapture.addListener(
        "bankNotification",
        async (event: BankNotificationEvent) => {
          try {
            const cls = classifyNotification({
              title: event.title,
              text: event.text,
              raw: event.rawText,
              hintedType: event.type,
              hintedAmount: event.amount,
              hintedMerchant: event.merchant,
            });
            const amount = cls.amount ?? event.amount ?? null;
            const currency = cls.currency ?? event.currency ?? "MXN";
            const merchant = cls.merchant ?? event.merchant ?? null;
            const detType = detTypeFrom(cls, event.type);
            const occurredAtIso = new Date(event.timestamp || Date.now()).toISOString();
            const dedupe = `${event.packageName}:${Math.floor(event.timestamp / 60000)}:${event.rawText.slice(0, 80)}`;

            const { data: inserted, error } = await supabase
              .from("detected_transactions")
              .insert({
                user_id: userId,
                amount,
                currency,
                merchant,
                type: detType,
                raw_text: event.rawText,
                notification_title: event.title ?? null,
                package_name: event.packageName,
                detected_at: occurredAtIso,
                dedupe_key: dedupe,
                status: "pending",
              })
              .select("id")
              .single();
            if (error) {
              if (/duplicate key/i.test(error.message)) return; // ya registrada
              throw error;
            }
            queryClient.invalidateQueries({ queryKey: ["detected_transactions"] });

            const applied = await maybeAutoApply(
              inserted!.id,
              cls,
              amount,
              merchant,
              event,
              userId,
              queryClient,
              occurredAtIso,
            );
            if (!applied) {
              toast.success("Nueva transacción detectada", {
                description: merchant
                  ? `${merchant} · ${amount != null ? money(amount) : "?"}`
                  : event.rawText.slice(0, 80),
              });
            }
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
