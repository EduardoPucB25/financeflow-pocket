import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoUrl from "@/assets/FinFloPo.svg";

/**
 * OAuth trampoline for the native app. The Lovable auth broker redirects the
 * SYSTEM BROWSER here after Google sign-in, with the session tokens in the URL
 * fragment. This page forwards everything to the app's custom scheme so
 * Android returns control to the APK. Runs only in the external browser —
 * regular web logins never pass through here.
 */
export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Volviendo a la app — Finance Flow Pocket" }],
  }),
  component: AuthCallbackPage,
});

const APP_SCHEME_URL = "financeflowpocket://google-auth";

function buildDeepLink(): string {
  // The broker returns tokens in the hash (supabase style); forward hash and
  // query untouched so the app can parse either shape.
  const { hash, search } = window.location;
  return `${APP_SCHEME_URL}${search}${hash}`;
}

function AuthCallbackPage() {
  const [deepLink, setDeepLink] = useState(APP_SCHEME_URL);

  useEffect(() => {
    const link = buildDeepLink();
    setDeepLink(link);
    // Attempt the jump automatically; some browsers require a user gesture,
    // so the button below is the guaranteed path.
    window.location.href = link;
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <CosmicBackground />
      <img src={logoUrl} alt="Finance Flow Pocket" className="h-14 w-14 rounded-xl" />
      <h1 className="mt-4 text-xl font-semibold">Inicio de sesión completado</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Te estamos regresando a la app. Si no sucede automáticamente, toca el botón.
      </p>
      <a
        href={deepLink}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Volver a la app
      </a>
      <p className="mt-4 text-xs text-muted-foreground">Ya puedes cerrar esta pestaña.</p>
    </div>
  );
}
