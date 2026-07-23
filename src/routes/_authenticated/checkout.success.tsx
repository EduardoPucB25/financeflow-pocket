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
