import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout/success")({
  head: () => ({
    meta: [
      { title: "¡Bienvenido a Pro! — Finance Flow Pocket" },
      { name: "description", content: "Tu suscripción Pro se ha activado correctamente." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const qc = useQueryClient();
  useEffect(() => {
    // Webhook may take a moment; poll the subscription query a few times so the
    // UI reflects the new Pro state as soon as the row lands.
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      attempts += 1;
      if (attempts < 6) setTimeout(tick, 1500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [qc]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <CardTitle>¡Suscripción activada!</CardTitle>
          <CardDescription>
            Tu plan Pro de Finance Flow Pocket ya está activo. Puede tardar unos segundos en
            reflejarse en toda la app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link to="/dashboard">Ir al panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
