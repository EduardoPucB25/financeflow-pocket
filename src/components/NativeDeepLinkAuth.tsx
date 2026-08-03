import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native/platform";

const SCHEME_PREFIX = "financeflowpocket://google-auth";
export const OAUTH_STATE_KEY = "ffp-oauth-state";

/** Parse token params from a deep-link URL (hash or query, either shape). */
function parseParams(url: string): URLSearchParams {
  const afterScheme = url.slice(SCHEME_PREFIX.length);
  // "?a=b#c=d" → merge both segments; hash wins on duplicates.
  const merged = new URLSearchParams();
  for (const chunk of afterScheme.split(/[?#]/).filter(Boolean)) {
    for (const [k, v] of new URLSearchParams(chunk)) merged.set(k, v);
  }
  return merged;
}

async function handleDeepLink(url: string, navigate: (to: string) => void) {
  if (!url.startsWith(SCHEME_PREFIX)) return;

  const params = parseParams(url);
  const expectedState = window.localStorage.getItem(OAUTH_STATE_KEY);
  window.localStorage.removeItem(OAUTH_STATE_KEY);

  const error = params.get("error_description") ?? params.get("error");
  if (error) {
    toast.error(`No se pudo iniciar sesión con Google: ${error}`);
    return;
  }

  const state = params.get("state");
  if (expectedState && state && state !== expectedState) {
    toast.error("La respuesta de Google no es válida (state). Intenta de nuevo.");
    return;
  }

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) {
    toast.error("Google no devolvió una sesión válida. Intenta de nuevo.");
    return;
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) {
    toast.error(sessionError.message);
    return;
  }
  toast.success("Bienvenido");
  navigate("/dashboard");
}

/**
 * Listens for the OAuth deep link (financeflowpocket://google-auth) fired by
 * the /auth-callback trampoline after a Google sign-in in the system browser.
 * Mounted once app-wide; inert on web. Also covers the cold-start case where
 * the deep link launched the app (getLaunchUrl).
 */
export function NativeDeepLinkAuth() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const navigate = (to: string) => router.navigate({ to, replace: true });

        const launch = await App.getLaunchUrl();
        if (!cancelled && launch?.url) void handleDeepLink(launch.url, navigate);

        const listener = await App.addListener("appUrlOpen", (event) => {
          void handleDeepLink(event.url, navigate);
        });
        if (cancelled) listener.remove();
        else remove = () => listener.remove();
      } catch {
        // Binary predates @capacitor/app — deep-link login unavailable there.
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
