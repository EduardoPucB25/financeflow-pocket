import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  Home,
  Heart,
  TrendingUp,
  Shield,
  Quote,
  CheckCircle2,
} from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoUrl from "@/assets/FinFloPo.svg";

export const Route = createFileRoute("/aprende")({
  head: () => ({
    meta: [
      { title: "Aprende — Finance Flow Pocket" },
      {
        name: "description",
        content:
          "El método 50/15/25/10 explicado en simple: divide tu ingreso en Esenciales, Valores, Growth y Estabilidad, y adáptalo a tu realidad.",
      },
    ],
  }),
  component: AprendePage,
});

const BUCKETS = [
  {
    icon: Home,
    name: "Esenciales",
    pct: 50,
    color: "#0EA5E9",
    desc: "Lo que necesitas para vivir: renta, comida, transporte, servicios. Es la base de todo; si esta cubeta está cubierta, puedes pensar con claridad.",
  },
  {
    icon: Heart,
    name: "Valores",
    pct: 15,
    color: "#8B5CF6",
    desc: "Lo que disfrutas y te hace la vida agradable: salidas, hobbies, regalos. Gastar aquí no es un pecado: ya está presupuestado.",
  },
  {
    icon: TrendingUp,
    name: "Growth",
    pct: 25,
    color: "#10B981",
    desc: "Lo que te hace crecer: inversión, ahorro con rendimiento, educación, tu propio proyecto. Esta cubeta compra tu libertad futura.",
  },
  {
    icon: Shield,
    name: "Estabilidad",
    pct: 10,
    color: "#F59E0B",
    desc: "Tu colchón para imprevistos: el fondo de emergencia que evita que un mal mes destruya todo tu plan.",
  },
];

const CREATOR_SPLIT = [
  { name: "Growth", pct: 25, color: "#10B981" },
  { name: "Valores", pct: 20, color: "#8B5CF6" },
  { name: "Estabilidad", pct: 15, color: "#F59E0B" },
  { name: "Esenciales", pct: 40, color: "#0EA5E9" },
];

const TESTIMONY = [
  "Cada día de pago yo abría un chat de inteligencia artificial y repetía el mismo ritual: le pasaba mi sueldo, mis tarjetas y mis fechas de corte, y le pedía ayuda para repartir el dinero. Después copiaba todo a mano: movía saldos entre cuentas y lo apuntaba en notas.",
  "Funcionaba, pero cada quincena empezaba desde cero. El chat no recordaba mis bolsillos, mis deudas ni mis metas. Un día entendí que no tenía un problema de disciplina: tenía una rutina que pedía a gritos convertirse en un sistema.",
  "Por una promoción de mi banco digital — un año de Revolut — llegué a Lovable, y ahí descubrí algo que no sabía de mí: que podía construir y publicar una aplicación real. Así que tomé esa rutina de cada día de pago y la convertí en un proyecto.",
  "Finance Flow Pocket es exactamente eso: la herramienta que yo necesitaba. Divide mi ingreso en bolsillos, vigila los cortes de mis tarjetas, calcula el rendimiento diario de mi dinero y me dice qué toca pagar y cuándo. Lo que antes me tomaba una tarde con un chat, hoy sucede solo.",
  "Si estás empezando a ordenar tu dinero, no necesitas más fuerza de voluntad: necesitas un sistema que trabaje por ti. Espero que este te sirva tanto como a mí.",
];

const FIRST_STEPS = [
  {
    title: "Crea tu cuenta y entra al panel.",
    desc: "La app crea tus 4 bolsillos base automáticamente.",
  },
  {
    title: "Ajusta tus bolsillos.",
    desc: "Cambia porcentajes hasta que sumen 100% y marca cuáles generan rendimiento.",
  },
  {
    title: "Registra tu ingreso y tus días de pago.",
    desc: "En Ajustes, para que el contador de \"Próximo pago\" sea exacto.",
  },
  {
    title: "Agrega tus tarjetas en Deudas.",
    desc: "Con su día de corte y de pago: la app te dirá qué pagar y cuándo en \"Por pagar\".",
  },
  {
    title: "Registra tus movimientos.",
    desc: "O deja que la app los detecte sola en Android, y revisa tu panel cada día de pago.",
  },
];

function StackedBar({ segments }: { segments: { name: string; pct: number; color: string }[] }) {
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div key={s.name} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: s.color }} />
            {s.name} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function AprendePage() {
  return (
    <div className="min-h-screen text-foreground relative">
      <CosmicBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/about" className="flex items-center gap-2 font-semibold">
          <img src={logoUrl} alt="Finance Flow Pocket" className="h-8 w-8 rounded-lg" />
          Finance Flow Pocket
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/about" className="text-muted-foreground hover:text-foreground">
            Acerca de
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
        {/* Hero */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <GraduationCap className="h-3 w-3 text-primary" /> Guía para empezar
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Aprende a ordenar tu dinero,{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              un bolsillo a la vez
            </span>
            .
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            No necesitas ser experto en finanzas. Necesitas un sistema simple que puedas repetir
            cada día de pago. Aquí te explicamos el método en el que se inspira Finance Flow
            Pocket, cómo adaptarlo a tu realidad y cómo dar tus primeros pasos hacia tu patrimonio
            y tu libertad financiera.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Comenzar gratis
            </Link>
            <a
              href="#metodo"
              className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent/20"
            >
              Ver el método
            </a>
          </div>
        </div>

        {/* El método */}
        <section id="metodo" className="mt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            El punto de partida
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            El método{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              50/15/25/10
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Finance Flow Pocket está inspirado en el método de{" "}
            <span className="font-medium text-foreground">Mark Tilbury</span>: cada vez que
            recibes un ingreso, lo divides en cuatro cubetas, cada una con un trabajo claro. No
            importa cuánto ganes hoy; importa que cada peso tenga un propósito asignado desde el
            primer día.
          </p>

          <div className="mt-8 max-w-3xl">
            <StackedBar segments={BUCKETS.map((b) => ({ name: b.name, pct: b.pct, color: b.color }))} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUCKETS.map((b) => (
              <div key={b.name} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg"
                    style={{ backgroundColor: `${b.color}1f`, color: b.color }}
                  >
                    <b.icon className="h-4 w-4" />
                  </span>
                  <span className="text-2xl font-bold" style={{ color: b.color }}>
                    {b.pct}%
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{b.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Los porcentajes se aplican a tu ingreso neto cada vez que te pagan: semanal, quincenal
            o mensual.
          </p>
        </section>

        {/* Hazlo tuyo */}
        <section className="mt-20 rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-md md:p-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            Adáptalo
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Los porcentajes son un punto de partida,{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              no una regla
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            La realidad de cada persona es distinta: hay quien comparte la renta y sus esenciales
            pesan poco, y hay quien mantiene una familia y necesita un colchón más grande. Por eso
            en Finance Flow Pocket los bolsillos son totalmente ajustables: tú decides cuántos son
            y qué porcentaje lleva cada uno.
          </p>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Por ejemplo, la distribución con la que nació la app es{" "}
            <span className="font-medium text-foreground">25/20/15/40</span> — Growth 25, Valores
            20, Estabilidad 15 y Esenciales 40 — porque los gastos esenciales de su creador pesan
            distinto a los del método original. Empieza con 50/15/25/10, vívelo un par de
            quincenas y ajusta los porcentajes hasta que reflejen tu vida real.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Método base · 50/15/25/10</p>
              <StackedBar segments={BUCKETS.map((b) => ({ name: b.name, pct: b.pct, color: b.color }))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Ejemplo del creador · 25/20/15/40</p>
              <StackedBar segments={CREATOR_SPLIT} />
            </div>
          </div>
        </section>

        {/* Testimonio */}
        <section className="mt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            La historia
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Cómo nació Finance Flow Pocket
          </h2>
          <div className="mt-8 max-w-3xl rounded-2xl border border-border bg-card p-8">
            <Quote className="h-6 w-6 text-primary" />
            <div className="mt-4 space-y-4 text-muted-foreground">
              {TESTIMONY.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="mt-6 text-sm font-medium text-foreground">
              — Angel, creador de Finance Flow Pocket
            </p>
          </div>
        </section>

        {/* Primeros pasos */}
        <section id="primeros-pasos" className="mt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            Primeros pasos
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Del método a la práctica{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              en 5 pasos
            </span>
          </h2>
          <ol className="mt-8 max-w-3xl space-y-4">
            {FIRST_STEPS.map((s, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-border/60 bg-background/30 p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="h-4 w-4" /> Comenzar ahora
            </Link>
            <Link
              to="/pricing"
              className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent/20"
            >
              Ver precios
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Finance Flow Pocket · Angel Eduardo Puc Barrera</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/about" className="hover:text-foreground">Acerca de</Link>
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
