import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Precios — Finance Flow Pocket" },
      { name: "description", content: "Planes y precios de Finance Flow Pocket: Gratis y Pro desde $4 USD al mes." },
      { property: "og:title", content: "Precios — Finance Flow Pocket" },
      { property: "og:description", content: "Planes y precios de Finance Flow Pocket: Gratis y Pro desde $4 USD al mes." },
    ],
  }),
  component: PricingPage,
});

const FREE_FEATURES = [
  "Hasta 2 bolsillos",
  "Hasta 2 deudas",
  "Hasta 3 flujos programados",
  "Calculadora de interés compuesto básica",
  "Registro manual de movimientos",
  "Dashboard de resumen",
];

const PRO_FEATURES = [
  "Bolsillos, deudas y flujos ilimitados",
  "Simulador avanzado con retiros periódicos",
  "Estrategia Invisible Cash (fecha de corte óptima)",
  "Detección automática de notificaciones bancarias (Android)",
  "Soporte prioritario",
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-semibold">← Finance Flow Pocket</Link>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Precios simples y transparentes
          </span>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold">Elige tu plan</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Empieza gratis. Actualiza a Pro cuando quieras desbloquear límites ilimitados y
            funciones avanzadas. Precios en USD, cargos procesados por Paddle.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Gratis</h2>
            <p className="text-sm text-muted-foreground">Ideal para probar la app.</p>
            <div className="mt-4 text-3xl font-bold">$0.00 USD</div>
            <ul className="mt-4 space-y-2 text-sm">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-400 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-6 inline-flex w-full justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/20"
            >
              Crear cuenta gratis
            </Link>
          </div>

          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 relative">
            <div className="absolute top-4 right-4"><Crown className="h-5 w-5 text-primary" /></div>
            <h2 className="text-xl font-semibold text-primary">Pro</h2>
            <p className="text-sm text-muted-foreground">Acceso completo a todas las herramientas.</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold">$4.00 USD</span>
              <span className="text-muted-foreground">/mes</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              O <strong>$48.00 USD</strong>/año con 1 mes gratis para todos (2 meses gratis para los primeros 20).
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-6 inline-flex w-full justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Empezar con Pro
            </Link>
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Cancela cuando quieras. Garantía de reembolso de 30 días.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Los pagos son procesados por Paddle.com, nuestro Merchant of Record. Precios en USD; el
          monto final en tu moneda local se calcula según la tasa de cambio vigente y los impuestos
          aplicables. Consulta nuestra{" "}
          <Link to="/refund" className="underline">Política de Reembolsos</Link>,{" "}
          <Link to="/terms" className="underline">Términos</Link> y{" "}
          <Link to="/privacy" className="underline">Aviso de Privacidad</Link>.
        </p>
      </main>
    </div>
  );
}
