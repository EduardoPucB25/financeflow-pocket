import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, CreditCard, Wallet, Sparkles, Download, Smartphone, ShieldCheck, Bell } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import logoAsset from "@/assets/logo.svg.asset.json";

const APK_URL = "/downloads/finance-flow-pocket.apk";
const APK_VERSION = "v0.1.0";

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
          <img
            src={logoAsset.url}
            alt="Finance Flow Pocket"
            className="h-8 w-8 rounded-lg"
          />
          Finance Flow Pocket
        </div>
        <nav className="flex items-center gap-4 text-sm">
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
        <section className="mt-20 rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-md md:p-12">
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                <Smartphone className="h-3 w-3 text-primary" /> App Android · {APK_VERSION}
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Descarga la app y{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  registra tus gastos automáticamente
                </span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                La versión Android lee las notificaciones de tus apps bancarias que tú autorices y
                registra montos y transacciones en tu bandeja para que apruebes cada movimiento.
                No es rastreo: todo se procesa en tu dispositivo y se guarda solo en tu cuenta.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={APK_URL}
                  download
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Descargar APK (Android)
                </a>
                <Dialog>
                  <DialogTrigger className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent/20">
                    Cómo instalar
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Instalar Finance Flow Pocket en Android</DialogTitle>
                      <DialogDescription>
                        Sigue estos pasos una sola vez para dejar la app lista.
                      </DialogDescription>
                    </DialogHeader>
                    <ol className="mt-2 space-y-3 text-sm text-muted-foreground">
                      <li>
                        <span className="font-medium text-foreground">1.</span> Descarga el archivo
                        APK desde este mismo botón.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">2.</span> Cuando Android lo
                        pida, permite <em>Instalar apps de orígenes desconocidos</em> para tu
                        navegador o explorador de archivos.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">3.</span> Abre el APK y toca
                        <em> Instalar</em>.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">4.</span> Dentro de la app,
                        ve a <em>Ajustes → Detección automática</em> y otorga acceso a
                        notificaciones. Elige qué apps bancarias quieres monitorear.
                      </li>
                    </ol>
                    <p className="mt-4 text-xs text-muted-foreground">
                      iOS no permite leer notificaciones de otras apps por restricciones de Apple,
                      así que esta función solo está disponible en Android.
                    </p>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <ul className="space-y-4 text-sm">
              {[
                {
                  icon: Bell,
                  title: "Solo apps que tú autorizas",
                  desc: "Elige exactamente qué bancos y wallets pueden ser leídos.",
                },
                {
                  icon: ShieldCheck,
                  title: "Sin rastreo, sin terceros",
                  desc: "Se extrae monto, comercio y tipo de movimiento. Nada más.",
                },
                {
                  icon: Wallet,
                  title: "Aprueba antes de registrar",
                  desc: "Cada detección entra a tu bandeja para revisar y editar.",
                },
                {
                  icon: Smartphone,
                  title: "Revocable en cualquier momento",
                  desc: "Quita el permiso desde Ajustes de Android cuando quieras.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3 rounded-xl border border-border/60 bg-background/30 p-4">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Finance Flow Pocket · Angel Eduardo Puc Barrera</div>
          <nav className="flex flex-wrap items-center gap-4">
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
