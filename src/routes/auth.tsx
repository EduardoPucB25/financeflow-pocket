import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoUrl from "@/assets/FinFloPo.svg";
import { Wallet, TrendingUp, CreditCard, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ingresar — Finance Flow Pocket" },
      { name: "description", content: "Inicia sesión o crea tu cuenta en Finance Flow Pocket." },
    ],
  }),
  component: AuthPage,
});

const BENEFITS = [
  {
    icon: Wallet,
    title: "Bolsillos de asignación",
    desc: "Distribuye tu ingreso 25/20/15/40 automáticamente cada quincena.",
  },
  {
    icon: TrendingUp,
    title: "Rendimiento diario compuesto",
    desc: "Simula tus escenarios al APY que quieras y guárdalos.",
  },
  {
    icon: CreditCard,
    title: "Estrategia Invisible Cash",
    desc: "Aprovecha el periodo de gracia de tus tarjetas sin intereses.",
  },
  {
    icon: ShieldCheck,
    title: "Tus datos, solo tuyos",
    desc: "Todo se guarda únicamente en tu cuenta. Nada se comparte con terceros.",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard", replace: true });
  };
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bienvenido de vuelta");
    goNext();
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Debes aceptar los Términos y la Política de Privacidad para continuar.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${next ?? "/dashboard"}`,
        data: { full_name: fullName },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data.user) {
      // `terms_accepted_at` ships in migration 20260724120000 but isn't in the
      // generated Supabase types yet — cast locally until types.ts regenerates.
      const { error: updateError } = await (supabase.from("profiles") as any)
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq("id", data.user.id);
      if (updateError) console.error("[auth] failed to record terms acceptance", updateError);
    }
    setLoading(false);
    toast.success("Cuenta creada. Revisa tu correo si se pide confirmación.");
    goNext();
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    setForgotSent(true);
    toast.success("Te enviamos un correo para restablecer tu contraseña.");
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    if (next) sessionStorage.setItem("ffp:next", next);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      return toast.error(result.error.message ?? "No pudimos iniciar sesión con Google.");
    }
    if (result.redirected) return;
    goNext();
  };



  return (
    <div className="min-h-screen flex flex-col relative">
      <CosmicBackground />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-center">
          {/* Value prop — hidden on mobile so the form stays front-and-center on small screens */}
          <div className="hidden md:block">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Tu dinero, bajo control
            </span>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
              Cada peso trabajando,{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                todos los días
              </span>
              .
            </h1>
            <p className="mt-4 text-muted-foreground">
              Entra o crea tu cuenta gratis para empezar a organizar tus finanzas en minutos.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3 rounded-xl border border-border/60 bg-background/30 p-4">
                  <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{b.title}</p>
                    <p className="mt-1 text-muted-foreground">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <Card className="w-full max-w-md mx-auto p-6 backdrop-blur-md bg-card/70 border-border/60">
            <div className="mb-6 text-center">
              <img
                src={logoUrl}
                alt="Finance Flow Pocket"
                className="mx-auto h-12 w-12 rounded-xl"
              />
              <h1 className="mt-4 text-2xl font-semibold">Finance Flow Pocket</h1>
              <p className="text-sm text-muted-foreground">Tu motor financiero personal</p>
            </div>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as "signin" | "signup");
                setShowForgot(false);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Ya tengo cuenta</TabsTrigger>
                <TabsTrigger value="signup">Regístrate</TabsTrigger>
              </TabsList>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {tab === "signin"
                  ? "Ingresa con tu correo y contraseña."
                  : "Crea tu cuenta gratis en menos de un minuto."}
              </p>

              <TabsContent value="signin">
                {showForgot ? (
                  forgotSent ? (
                    <div className="space-y-4 pt-4 text-center">
                      <p className="text-sm text-foreground">Revisa tu correo</p>
                      <p className="text-sm text-muted-foreground">
                        Te enviamos un enlace a <strong>{forgotEmail}</strong> para restablecer tu
                        contraseña.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setShowForgot(false);
                          setForgotSent(false);
                        }}
                      >
                        ← Volver a ingresar
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={requestReset} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-forgot">Correo</Label>
                        <Input
                          id="email-forgot"
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={forgotLoading}>
                        {forgotLoading ? "Enviando..." : "Enviar enlace de recuperación"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowForgot(false)}
                      >
                        ← Volver a ingresar
                      </Button>
                    </form>
                  )
                ) : (
                  <form onSubmit={signIn} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-in">Correo</Label>
                      <Input
                        id="email-in"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pw-in">Contraseña</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(email);
                            setShowForgot(true);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <Input
                        id="pw-in"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Ingresando..." : "Ingresar"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Al continuar, aceptas nuestros{" "}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline">
                        Términos
                      </Link>{" "}
                      y{" "}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                        Privacidad
                      </Link>
                      .
                    </p>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-up">Nombre</Label>
                    <Input id="name-up" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-up">Correo</Label>
                    <Input
                      id="email-up"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-up">Contraseña</Label>
                    <Input
                      id="pw-up"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(v) => setAcceptedTerms(Boolean(v))}
                      className="mt-0.5"
                    />
                    <Label htmlFor="accept-terms" className="text-xs font-normal text-muted-foreground leading-snug">
                      Acepto los{" "}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline">
                        Términos y Condiciones
                      </Link>{" "}
                      y la{" "}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                        Política de Privacidad
                      </Link>
                      .
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando..." : "Crear cuenta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
