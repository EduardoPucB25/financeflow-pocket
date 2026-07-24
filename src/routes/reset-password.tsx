import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CosmicBackground } from "@/components/CosmicBackground";
import logoAsset from "@/assets/logo.svg.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Restablecer contraseña — Finance Flow Pocket" }],
  }),
  component: ResetPasswordPage,
});

type Status = "checking" | "invalid" | "ready";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Expired/invalid recovery links land here with error info in the hash
    // instead of firing any auth event — check that first.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = hash.get("error_description");
    if (description) {
      setErrorMsg(description);
      setStatus("invalid");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Fallback: a session already present when this mounts (e.g. the event
    // already fired once before this effect subscribed) should also count.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === "checking" ? "ready" : s));
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Tu contraseña se actualizó correctamente.");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <CosmicBackground />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md p-6 backdrop-blur-md bg-card/70 border-border/60">
          <div className="mb-6 text-center">
            <img
              src={logoAsset.url}
              alt="Finance Flow Pocket"
              className="mx-auto h-12 w-12 rounded-xl"
            />
            <h1 className="mt-4 text-2xl font-semibold">Restablecer contraseña</h1>
          </div>

          {status === "checking" && (
            <p className="text-center text-sm text-muted-foreground">Verificando tu enlace…</p>
          )}

          {status === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {errorMsg ?? "Este enlace ya no es válido o expiró."}
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Volver a ingresar</Link>
              </Button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pw">Nueva contraseña</Label>
                <Input
                  id="new-pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirmar contraseña</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Guardar nueva contraseña"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
