import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, CreditCard, Wallet, Sparkles, GraduationCap } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoUrl from "@/assets/FinFloPo.svg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Acerca de — Finance Flow Pocket" },
      {
        name: "description",
        content:
          "Maximiza rendimientos diarios, optimiza el periodo de gracia de tus tarjetas y distribuye tu dinero con inteligencia.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen text-foreground relative">
      <CosmicBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <img
            src={logoUrl}
            alt="Finance Flow Pocket"
            className="h-8 w-8 rounded-lg"
          />
          Finance Flow Pocket
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/aprende" className="text-muted-foreground hover:text-foreground">
            Aprende
          </Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
            Precios
          </Link>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Entrar
          </Link>
        </nav>
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

        <section className="mt-20 rounded-2xl border border-border bg-card/50 p-8 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            <GraduationCap className="h-3 w-3 text-primary" /> Aprende
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            ¿Nuevo en finanzas personales? Empieza por el método.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Finance Flow Pocket se inspira en el método 50/15/25/10 de Mark Tilbury: divide cada
            ingreso en Esenciales, Valores, Growth y Estabilidad, y ajusta los porcentajes a tu
            realidad. Te lo explicamos paso a paso, junto con la historia de cómo nació la app.
          </p>
          <Link
            to="/aprende"
            className="mt-6 inline-block rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ver la guía completa
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Finance Flow Pocket · Angel Eduardo Puc Barrera</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/aprende" className="hover:text-foreground">Aprende</Link>
            <Link to="/pricing" className="hover:text-foreground">Precios</Link>
            <Link to="/terms" className="hover:text-foreground">Términos</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacidad</Link>
            <Link to="/refund" className="hover:text-foreground">Reembolsos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
