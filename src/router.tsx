import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { supabase } from "@/integrations/supabase/client";

/** PGRST303 ("JWT issued at future") aparece cuando el reloj del dispositivo
 * va adelantado respecto al servidor: el token todavía no es válido. Es
 * transitorio, así que refrescamos la sesión y reintentamos en lugar de
 * romper la pantalla. */
function isClockSkewError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  return code === "PGRST303" || /JWT issued at future|jwt.*not yet valid/i.test(message);
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isClockSkewError(error)) {
            if (typeof window !== "undefined") void supabase.auth.refreshSession();
            return failureCount < 5;
          }
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
