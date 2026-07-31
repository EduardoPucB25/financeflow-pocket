import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";

const LS_KEY = "ffp-guides-seen";

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(keys: string[]) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(keys));
  } catch {
    // Storage unavailable — DB copy still works.
  }
}

/**
 * Guide progress shared across web and the APK via profiles.guides_seen,
 * mirrored in localStorage for instant/offline reads. Writes always send the
 * UNION of server + local + new keys, so concurrent devices can't clobber
 * each other's progress.
 */
export function useGuideProgress(userId: string) {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery());

  // `guides_seen` ships in migration 20260731120000; cast until types regen.
  const rawSeen = (profile as { guides_seen?: unknown } | null | undefined)?.guides_seen;
  const serverSeen: string[] = useMemo(
    () =>
      Array.isArray(rawSeen) ? rawSeen.filter((x): x is string => typeof x === "string") : [],
    [rawSeen],
  );

  const hasSeen = useCallback(
    (routeKey: string) => serverSeen.includes(routeKey) || readLocal().includes(routeKey),
    [serverSeen],
  );

  const markSeen = useCallback(
    async (routeKey: string) => {
      const next = Array.from(new Set([...serverSeen, ...readLocal(), routeKey]));
      writeLocal(next);
      qc.setQueryData(["profile"], (prev: unknown) =>
        prev && typeof prev === "object" ? { ...prev, guides_seen: next } : prev,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- guides_seen pending types regen
      const { error } = await (supabase.from("profiles") as any)
        .update({ guides_seen: next })
        .eq("id", userId);
      if (error) console.warn("[guide] no se pudo guardar el progreso:", error.message);
    },
    [serverSeen, qc, userId],
  );

  const resetAll = useCallback(async () => {
    writeLocal([]);
    qc.setQueryData(["profile"], (prev: unknown) =>
      prev && typeof prev === "object" ? { ...prev, guides_seen: [] } : prev,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- guides_seen pending types regen
    const { error } = await (supabase.from("profiles") as any)
      .update({ guides_seen: [] })
      .eq("id", userId);
    if (error) console.warn("[guide] no se pudo restablecer:", error.message);
  }, [qc, userId]);

  return { hasSeen, markSeen, resetAll };
}
