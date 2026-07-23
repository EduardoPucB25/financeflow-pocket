import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, CreditCard, Wallet, Sparkles } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finance Flow Pocket" },
      {
        name: "description",
        content:
          "Maximiza rendimientos diarios, optimiza el periodo de gracia de tus tarjetas y distribuye tu dinero con inteligencia.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen text-foreground relative">
      <CosmicBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            F
          </span>
          Finance Flow Pocket
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Motor de ingeniería financiera personal
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Cada peso trabajando,{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              todos los días
            </span>
            .
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Distribuye tu ingreso en bolsillos inteligentes (25/20/15/40), aprovecha la flotación
            de tus tarjetas con la estrategia de <em>Invisible Cash</em> y proyecta tu interés
            compuesto diario al 15% APY.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Comenzar
            </Link>
            <a
              href="#features"
              className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent/20"
            >
              Ver funciones
            </a>
          </div>
        </div>

        <div id="features" className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: "Bolsillos de asignación",
              desc: "Growth, Valores, Stability y Essential. Distribución porcentual clara por quincena.",
              color: "text-primary",
            },
            {
              icon: TrendingUp,
              title: "Rendimiento diario compuesto",
              desc: "Simula 30, 90 o 365 días al APY que quieras y guarda tus escenarios.",
              color: "text-accent",
            },
            {
              icon: CreditCard,
              title: "Estrategia Invisible Cash",
              desc: "Aprovecha el periodo de gracia de cada tarjeta hasta 45+ días sin intereses.",
              color: "text-warning",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <f.icon className={`h-6 w-6 ${f.color}`} />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
