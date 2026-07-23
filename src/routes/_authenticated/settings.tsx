import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { profileQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNotificationCapture } from "@/hooks/useNotificationCapture";
import { Smartphone, ShieldCheck, ShieldAlert, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Finance Flow Pocket" },
      { name: "description", content: "Configura tu ingreso, frecuencia de pago y tasa de rendimiento." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    biweekly_salary: Number(profile?.biweekly_salary ?? 5600),
    salary_frequency: profile?.salary_frequency ?? "biweekly",
    annual_yield_rate: Number(profile?.annual_yield_rate ?? 15),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        biweekly_salary: Number(profile.biweekly_salary),
        salary_frequency: profile.salary_frequency,
        annual_yield_rate: Number(profile.annual_yield_rate),
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase
        .from("profiles")
        .update(form)
        .eq("id", user.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajustes guardados");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Personaliza tu perfil financiero.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ingreso por periodo</Label>
            <Input type="number" step="0.01" value={form.biweekly_salary} onChange={(e) => setForm({ ...form, biweekly_salary: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select value={form.salary_frequency} onValueChange={(v) => setForm({ ...form, salary_frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tasa anual de rendimiento (APY %)</Label>
            <Input type="number" step="0.1" value={form.annual_yield_rate} onChange={(e) => setForm({ ...form, annual_yield_rate: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Ej. 15% para Revolut México, Nu, CETES, etc.</p>
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Guardar cambios
        </Button>
      </Card>

      <AndroidDetectionCard />
    </div>
  );
}

function AndroidDetectionCard() {
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);

  if (!isPro) {
    return (
      <Card className="p-6 space-y-3 bg-card/70 backdrop-blur border-dashed">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Detección automática (Android)</h2>
          <Lock className="h-4 w-4 text-primary ml-auto" />
        </div>
        <p className="text-sm text-muted-foreground">
          La lectura automática de notificaciones bancarias en el APK es una función exclusiva de Pro.
        </p>
        <Button asChild size="sm">
          <Link to="/upgrade">Activar Pro</Link>
        </Button>
      </Card>
    );
  }

  return <AndroidDetectionCardInner />;
}

function AndroidDetectionCardInner() {
  const {
    supported,
    permissionGranted,
    watchedPackages,
    requestPermission,
    refreshPermission,
    setWatchedPackages,
  } = useNotificationCapture(null);
  const [draft, setDraft] = useState(watchedPackages.join("\n"));

  useEffect(() => {
    setDraft(watchedPackages.join("\n"));
  }, [watchedPackages]);

  return (
    <Card className="p-6 space-y-4 bg-card/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Detección automática (Android)</h2>
      </div>

      {!supported ? (
        <p className="text-sm text-muted-foreground">
          Esta sección solo está activa en la app Android instalada como APK. En el navegador
          no es posible leer notificaciones del sistema. Consulta{" "}
          <code className="text-xs">docs/android-build.md</code> para generar el APK.
        </p>
      ) : (
        <>
          <div
            className={
              "flex items-start gap-3 rounded-md border p-3 text-sm " +
              (permissionGranted
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-amber-500/40 bg-amber-500/10")
            }
          >
            {permissionGranted ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-medium">
                {permissionGranted
                  ? "Acceso a notificaciones activado"
                  : "Permiso pendiente"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {permissionGranted
                  ? "La app está leyendo las notificaciones de las apps vigiladas."
                  : "Otorga acceso para que la app pueda leer notificaciones bancarias."}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={requestPermission}>
              {permissionGranted ? "Ajustar" : "Otorgar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={refreshPermission}>
              Refrescar
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Apps vigiladas (una por línea)</Label>
            <Textarea
              rows={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Usa el nombre de paquete (ej. <code>com.bbva.bbvacontigo</code>). Solo se capturan
              notificaciones de estas apps.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                const list = draft
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                await setWatchedPackages(list);
                toast.success("Lista actualizada");
              }}
            >
              Guardar apps
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
