import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { profileQuery, subscriptionQuery, billingEventsQuery, detectionRulesQuery, pocketsQuery, debtsQuery } from "@/lib/queries";
import { RULE_MODE_LABEL, type RuleMode } from "@/lib/detection/rules";
import { deriveSubStatus } from "@/lib/subscription";
import { getPaddleEnvironment } from "@/lib/paddle";
import { createCustomerPortalSession } from "@/utils/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNotificationCapture } from "@/hooks/useNotificationCapture";
import { AppPicker } from "@/components/detection/AppPicker";
import { UpdateCard } from "@/components/UpdateCard";
import { Smartphone, ShieldCheck, ShieldAlert, Lock, Crown, Download, KeyRound, HelpCircle, RotateCcw, Wand2, Trash2 } from "lucide-react";
import { useGuideProgress } from "@/lib/guide/useGuideProgress";

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
  // `payday_*` ships in migration 20260728100000 but isn't in the generated
  // Supabase types yet — cast locally until types.ts regenerates.
  const paydayOf = (p: unknown) => {
    const row = p as { payday_days?: number[] | null; payday_offset_days?: number | null; payday_weekend_to_friday?: boolean | null } | null;
    return {
      payday_day_1: row?.payday_days?.[0] ?? 15,
      payday_day_2: row?.payday_days?.[1] ?? 31,
      payday_offset_days: Number(row?.payday_offset_days ?? 0),
      payday_weekend_to_friday: Boolean(row?.payday_weekend_to_friday ?? false),
    };
  };
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    biweekly_salary: Number(profile?.biweekly_salary ?? 5600),
    salary_frequency: profile?.salary_frequency ?? "biweekly",
    annual_yield_rate: Number(profile?.annual_yield_rate ?? 15),
    global_spend_limit_monthly: Number(profile?.global_spend_limit_monthly ?? 0),
    ...paydayOf(profile),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        biweekly_salary: Number(profile.biweekly_salary),
        salary_frequency: profile.salary_frequency,
        annual_yield_rate: Number(profile.annual_yield_rate),
        global_spend_limit_monthly: Number(profile.global_spend_limit_monthly ?? 0),
        ...paydayOf(profile),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);


  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      // payday_day_1/2 are UI-only scalars: assemble the array column and
      // never spread them into the update payload (PostgREST rejects unknown
      // columns for the whole update).
      const { payday_day_1, payday_day_2, ...rest } = form;
      const payday_days =
        form.salary_frequency === "biweekly"
          ? [payday_day_1, payday_day_2]
          : form.salary_frequency === "monthly"
            ? [payday_day_1]
            : null;
      const { error } = await (supabase.from("profiles") as any)
        .update({
          ...rest,
          payday_days,
          global_spend_limit_monthly:
            form.global_spend_limit_monthly > 0 ? form.global_spend_limit_monthly : null,
        })
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

      <Card data-guide="settings-perfil" className="p-6 space-y-4">
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
          <div className="space-y-2 md:col-span-2">
            <Label>Límite de gasto mensual global</Label>
            <Input
              type="number"
              step="0.01"
              value={form.global_spend_limit_monthly}
              onChange={(e) => setForm({ ...form, global_spend_limit_monthly: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Te avisamos al 75% y al superarlo. Deja 0 para desactivarlo.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="font-medium">Días de pago</h3>
            <p className="text-xs text-muted-foreground">
              Configura cuándo te pagan para que el contador de "Próximo pago" sea exacto.
            </p>
          </div>
          {form.salary_frequency !== "weekly" ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{form.salary_frequency === "biweekly" ? "Primer día de pago" : "Día de pago"}</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.payday_day_1}
                  onChange={(e) =>
                    setForm({ ...form, payday_day_1: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </div>
              {form.salary_frequency === "biweekly" && (
                <div className="space-y-2">
                  <Label>Segundo día de pago</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.payday_day_2}
                    onChange={(e) =>
                      setForm({ ...form, payday_day_2: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Días antes</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={form.payday_offset_days}
                  onChange={(e) =>
                    setForm({ ...form, payday_offset_days: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ej. 1 si te depositan un día antes del corte (el 30 en meses de 31 días).
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="payday-weekend">Si cae en fin de semana, mover al viernes previo</Label>
                  <Switch
                    id="payday-weekend"
                    checked={form.payday_weekend_to_friday}
                    onCheckedChange={(v) => setForm({ ...form, payday_weekend_to_friday: v })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usa 31 como día para "fin de mes"; se ajusta solo en meses cortos (ej. febrero).
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Con frecuencia semanal, el contador usa el esquema quincenal estándar (día 15 y fin de mes) por ahora.
            </p>
          )}
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Guardar cambios
        </Button>
      </Card>

      <SecurityCard />
      <SubscriptionCard />
      <BillingHistoryCard />
      <AndroidDetectionCard />
      <AssistantCard />
      <UpdateCard />
      <HelpResetCard />
    </div>
  );
}

function AssistantCard() {
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const { data: rules } = useQuery(detectionRulesQuery());
  const { data: pockets } = useQuery(pocketsQuery());
  const { data: debts } = useQuery(debtsQuery());
  const qc = useQueryClient();

  // detection_* columns aren't in generated types yet — cast locally.
  const prefs = profile as unknown as {
    detection_autopilot?: boolean | null;
    detection_default_mode?: RuleMode | null;
  } | null;
  const autopilot = prefs?.detection_autopilot ?? false;
  const defaultMode: RuleMode = prefs?.detection_default_mode ?? "ask";

  const savePrefs = useMutation({
    mutationFn: async (patch: { detection_autopilot?: boolean; detection_default_mode?: RuleMode }) => {
      if (!profile?.id) throw new Error("Sin perfil");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const updateRule = useMutation({
    mutationFn: async (args: { id: string; mode: RuleMode }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("detection_rules" as any) as any)
        .update({ mode: args.mode, updated_at: new Date().toISOString() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["detection_rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("detection_rules" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detection_rules"] });
      toast.success("Regla eliminada");
    },
  });

  if (!isPro) return null;

  const targetLabel = (r: { pocket_id: string | null; debt_id: string | null }) => {
    if (r.pocket_id) return pockets?.find((p) => p.id === r.pocket_id)?.name ?? "bolsillo";
    if (r.debt_id) return debts?.find((d) => d.id === r.debt_id)?.name ?? "tarjeta";
    return "—";
  };

  return (
    <Card className="p-6 space-y-4 bg-card/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Asistente de movimientos</h2>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm">Registrar automáticamente</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplica las reglas en modo “Registrar solo” apenas se detecta el movimiento, aunque no
            abras la app. Siempre podrás deshacer.
          </p>
        </div>
        <Switch
          checked={autopilot}
          onCheckedChange={(v) => savePrefs.mutate({ detection_autopilot: v })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Modo por defecto para reglas nuevas</Label>
        <Select
          value={defaultMode}
          onValueChange={(v) => savePrefs.mutate({ detection_default_mode: v as RuleMode })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["ask", "confirm", "auto"] as RuleMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {RULE_MODE_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Reglas aprendidas ({rules?.length ?? 0})</Label>
        {(rules?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay reglas. Cuando asignes un movimiento en el asistente, podrás pedir que lo
            recuerde para la próxima.
          </p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-md border border-border/60">
            {rules!.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    <span className="font-medium">{r.match_value}</span>{" "}
                    <span className="text-muted-foreground">→ {targetLabel(r)}</span>
                  </div>
                </div>
                <Select value={r.mode} onValueChange={(v) => updateRule.mutate({ id: r.id, mode: v as RuleMode })}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["ask", "confirm", "auto"] as RuleMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {RULE_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => deleteRule.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function HelpResetCard() {
  const { data: profile } = useQuery(profileQuery());
  const { resetAll } = useGuideProgress(profile?.id ?? "");

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Ayuda</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        ¿Quieres volver a ver las guías de cada pantalla? Restablécelas y aparecerán de nuevo la
        próxima vez que entres a cada sección.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await resetAll();
          toast.success("Guías restablecidas. Vuelve a cualquier pantalla para verlas.");
        }}
      >
        <RotateCcw className="mr-2 h-4 w-4" /> Restablecer guías
      </Button>
    </Card>
  );
}

function SecurityCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (newPassword.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("Las contraseñas no coinciden.");
    changePassword.mutate(newPassword);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Seguridad</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nueva contraseña</Label>
          <Input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Confirmar contraseña</Label>
          <Input type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={changePassword.isPending}>
        Actualizar contraseña
      </Button>
    </Card>
  );
}

function SubscriptionCard() {
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro, isCanceling, isPastDue } = deriveSubStatus(subscription);
  const openPortal = useServerFn(createCustomerPortalSession);
  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const env = getPaddleEnvironment();
      const result = await openPortal({ data: { environment: env } });
      const url = result.overviewUrl;
      if (!url) throw new Error("No se pudo generar el portal");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al abrir el portal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-guide="settings-suscripcion" className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Suscripción</h2>
      </div>

      {!subscription ? (
        <>
          <p className="text-sm text-muted-foreground">
            Actualmente estás en el plan Gratis.
          </p>
          <Button asChild size="sm">
            <Link to="/upgrade">Ver planes Pro</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Plan:</span>{" "}
              <strong>{subscription.price_id ?? "—"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Estado:</span>{" "}
              <strong>
                {isPastDue
                  ? "Pago pendiente"
                  : isCanceling
                    ? "Cancelada (acceso hasta fin de periodo)"
                    : isPro
                      ? "Activa"
                      : (subscription.status ?? "—")}
              </strong>
            </div>
            {subscription.current_period_end && (
              <div>
                <span className="text-muted-foreground">
                  {isCanceling ? "Acceso hasta:" : "Próxima renovación:"}
                </span>{" "}
                <strong>
                  {new Date(subscription.current_period_end).toLocaleDateString("es-MX")}
                </strong>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Gestiona tu método de pago, descarga facturas o cancela desde el portal seguro de pagos.
          </p>
          <Button size="sm" onClick={handleManage} disabled={loading}>
            {loading ? "Abriendo…" : "Gestionar suscripción"}
          </Button>
        </>
      )}
    </Card>
  );
}

function BillingHistoryCard() {
  const { data: profile } = useQuery(profileQuery());
  const { data: events } = useQuery(billingEventsQuery(profile?.id));

  if (!events || events.length === 0) return null;

  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Historial de facturación</h2>
      <ul className="text-sm divide-y divide-border">
        {events.map((e) => {
          const amount = e.amount_total ? Number(e.amount_total) / 100 : null;
          const failed = e.event_type === "payment_failed" || e.status === "payment_failed";
          return (
            <li key={e.id} className="py-2 flex items-center justify-between gap-3">
              <div>
                <div className={failed ? "text-destructive font-medium" : "font-medium"}>
                  {failed ? "Pago fallido" : "Pago cobrado"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.billed_at ?? e.created_at ?? "").toLocaleString("es-MX")}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">
                  {amount !== null
                    ? `${amount.toFixed(2)} ${e.currency_code ?? ""}`
                    : "—"}
                </div>
                {e.invoice_url && (
                  <a
                    href={e.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Factura
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}


function AndroidDetectionCard() {
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);

  if (!isPro) {
    return (
      <Card data-guide="settings-deteccion" className="p-6 space-y-3 bg-card/70 backdrop-blur border-dashed">
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

  return (
    <Card data-guide="settings-deteccion" className="p-6 space-y-4 bg-card/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Detección automática (Android)</h2>
      </div>

      {!supported ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta función solo funciona dentro de la app para Android instalada como APK; en el
            navegador no es posible leer notificaciones del sistema.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/downloads/finance-flow-pocket.apk"
              download
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Descargar APK (Android)
            </a>
            <Dialog>
              <DialogTrigger className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/20">
                Cómo instalar
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Instalar Finance Flow Pocket en Android</DialogTitle>
                  <DialogDescription>Sigue estos pasos una sola vez.</DialogDescription>
                </DialogHeader>
                <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <li>1. Descarga el archivo APK desde este mismo botón.</li>
                  <li>2. Cuando Android lo pida, permite instalar apps de orígenes desconocidos.</li>
                  <li>3. Abre el APK descargado y toca Instalar.</li>
                  <li>
                    4. Abre la app instalada, inicia sesión y vuelve a esta pantalla para otorgar
                    acceso a notificaciones.
                  </li>
                </ol>
              </DialogContent>
            </Dialog>
          </div>
        </div>
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

          <AppPicker
            supported={supported}
            watchedPackages={watchedPackages}
            setWatchedPackages={setWatchedPackages}
          />
        </>
      )}
    </Card>
  );
}
