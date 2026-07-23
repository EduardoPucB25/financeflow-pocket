import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { profileQuery, subscriptionQuery } from "@/lib/queries";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getDiscountStatus, type DiscountStatus } from "@/utils/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Zap, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade — Finance Flow Pocket" },
      { name: "description", content: "Desbloquea funciones Pro con Finance Flow Pocket." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQuery());
  },
  component: UpgradePage,
});

const FREE_FEATURES = [
  "Hasta 2 bolsillos",
  "Calculadora de interés compuesto básico",
  "Registro manual de movimientos",
  "Dashboard de resumen",
];

const PRO_FEATURES = [
  "Bolsillos ilimitados",
  "Simulador avanzado con retiros periódicos",
  "Estrategia Invisible Cash (fecha de corte óptima)",
  "Detección automática de notificaciones bancarias (Android)",
  "Soporte prioritario",
];

const MONTHLY_PRICE_USD = 4;
const ANNUAL_PRICE_USD = 48;

function formatUsd(n: number) {
  return `$${n.toFixed(2)} USD`;
}

function UpgradePage() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const userId = profile?.id;
  const { data: subscription } = useSuspenseQuery(subscriptionQuery(userId));
  const { openCheckout, loading, environment } = usePaddleCheckout();
  const checkDiscount = useServerFn(getDiscountStatus);

  const [monthlyDiscount, setMonthlyDiscount] = useState<DiscountStatus | null>(null);
  const [annualDiscount, setAnnualDiscount] = useState<DiscountStatus | null>(null);
  const [checkingDiscounts, setCheckingDiscounts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCheckingDiscounts(true);
      const env = getPaddleEnvironment();
      try {
        const [monthly, annual] = await Promise.all([
          checkDiscount({ data: { code: "BETA10", environment: env } }),
          checkDiscount({ data: { code: "BETA20", environment: env } }),
        ]);
        if (!cancelled) {
          setMonthlyDiscount(monthly.available ? monthly : null);
          setAnnualDiscount(annual.available ? annual : null);
        }
      } catch (e) {
        console.error("Error checking discounts", e);
      } finally {
        if (!cancelled) setCheckingDiscounts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [checkDiscount]);

  const isPro = Boolean(
    subscription &&
      (subscription.status === "active" ||
        subscription.status === "trialing" ||
        (subscription.status === "canceled" &&
          subscription.current_period_end &&
          new Date(subscription.current_period_end) > new Date())),
  );

  const startMonthlyCheckout = () => {
    if (!userId) return;
    openCheckout({
      priceId: "pro_monthly",
      quantity: 1,
      customData: { userId },
      successUrl: `${window.location.origin}/checkout/success`,
      discountCode: monthlyDiscount?.available ? monthlyDiscount.code : undefined,
    });
  };

  const startAnnualCheckout = () => {
    if (!userId) return;
    openCheckout({
      priceId: "pro_annual",
      quantity: 1,
      customData: { userId },
      successUrl: `${window.location.origin}/checkout/success`,
      discountCode: annualDiscount?.available ? annualDiscount.code : "1MESGRATIS",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Lleva tu dinero al siguiente nivel
          </span>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold">Finance Flow Pocket Pro</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Automatiza el registro de gastos desde notificaciones bancarias y desbloquea simulaciones
            avanzadas para maximizar tu efectivo invisible.
          </p>
        </div>

        {isPro && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold">
              <Crown className="h-4 w-4" /> Ya tienes Pro activo
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Tu suscripción vence el{" "}
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString("es-MX")
                : "—"}
              .
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Gratis <Badge variant="secondary">Actual</Badge>
              </CardTitle>
              <CardDescription>Ideal para probar Finance Flow Pocket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">{formatUsd(0)}</div>
              <ul className="space-y-2 text-sm">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/dashboard">Seguir en gratis</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-primary/40 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Crown className="h-5 w-5" /> Pro
              </CardTitle>
              <CardDescription>Acceso completo a herramientas de inteligencia financiera.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{formatUsd(MONTHLY_PRICE_USD)}</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Ahorra con el plan anual: paga 11 meses y lleva 12.
              </p>

              {monthlyDiscount?.available && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Tag className="h-4 w-4" /> Promoción de lanzamiento
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Primeras 10 personas: 3 meses a ~$50 MXN. Quedan{" "}
                    <strong>{(monthlyDiscount.usageLimit ?? 0) - monthlyDiscount.timesUsed}</strong> cupos.
                  </p>
                </div>
              )}

              <ul className="space-y-2 text-sm">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={startMonthlyCheckout}
                disabled={loading || isPro || checkingDiscounts}
              >
                {isPro ? "Ya eres Pro" : loading ? "Cargando…" : "Suscribirse mensual"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={startAnnualCheckout}
                disabled={loading || isPro || checkingDiscounts}
              >
                {isPro
                  ? "Ya eres Pro"
                  : annualDiscount?.available
                    ? "Suscribirse anual — 2 meses gratis (primeros 20)"
                    : "Suscribirse anual — 1 mes gratis"}
              </Button>
              {annualDiscount?.available && (
                <p className="text-xs text-center text-muted-foreground">
                  Quedan <strong>{(annualDiscount.usageLimit ?? 0) - annualDiscount.timesUsed}</strong> cupos de 2 meses gratis.
                </p>
              )}
              {environment === "sandbox" && (
                <p className="text-xs text-center text-muted-foreground">
                  Modo de prueba: usa tarjeta 4242 4242 4242 4242.
                </p>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground">
          Pagos procesados de forma segura. Puedes cancelar en cualquier momento desde Ajustes.
          <br />
          Los precios se cobran en USD; el monto final en MXN se calcula según la tasa de cambio actual.
        </div>
      </div>
    </div>
  );
}
