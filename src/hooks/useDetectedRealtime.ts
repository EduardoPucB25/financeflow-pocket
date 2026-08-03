import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Suscripción realtime a `detected_transactions` para que el asistente muestre
 * los movimientos al instante en cualquier sesión abierta (web y APK). Requiere
 * que la tabla esté en la publicación `supabase_realtime`
 * (migración 20260803120200). Si realtime no está disponible, el
 * `invalidateQueries` local del hook de captura mantiene al día al dispositivo
 * que detecta. Es un no-op sin `userId`.
 */
export function useDetectedRealtime(userId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("detected-transactions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "detected_transactions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["detected_transactions"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
