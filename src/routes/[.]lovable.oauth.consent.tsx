import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoUrl from "@/assets/FinFloPo.svg";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acceso — Finance Flow Pocket" },
      {
        name: "description",
        content: "Autoriza a una aplicación externa a usar tus datos de Finance Flow Pocket.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <p className="text-sm text-muted-foreground">
        No pudimos cargar esta solicitud: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "una aplicación";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió una URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="relative min-h-screen grid place-items-center p-6">
      <CosmicBackground />
      <Card className="relative z-10 w-full max-w-md space-y-5 border-border/60 bg-card/80 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Finance Flow Pocket" className="h-9 w-9" />
          <span className="font-semibold">Finance Flow Pocket</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Conectar {clientName} a tu cuenta</h1>
          <p className="text-sm text-muted-foreground">
            {clientName} podrá consultar tus bolsillos, deudas, movimientos y patrimonio, y registrar
            movimientos nuevos actuando como tú. Puedes revocar el acceso en cualquier momento.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
            Autorizar
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
            Rechazar
          </Button>
        </div>
      </Card>
    </main>
  );
}
