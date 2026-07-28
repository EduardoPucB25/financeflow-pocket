import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { simulationsQuery, profileQuery, pocketsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, pct } from "@/lib/format";
import { simulateYield, compoundDaily, YIELD_DISCLAIMER, type Frequency } from "@/lib/finance";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, ComposedChart, Legend } from "recharts";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Info } from "lucide-react";
import type { PocketLike } from "@/lib/netWorth";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "Simulador — Finance Flow Pocket" },
      { name: "description", content: "Simula tu balance con interés compuesto diario, depósitos y retiros." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(simulationsQuery());
    context.queryClient.ensureQueryData(profileQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
  },
  component: SimulatorPage,
});

function SimulatorPage() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: saved } = useSuspenseQuery(simulationsQuery());
  const { data: pocketsData } = useSuspenseQuery(pocketsQuery());
  const qc = useQueryClient();

  const defaultRate = Number(profile?.annual_yield_rate ?? 15);
  const pockets = pocketsData as unknown as PocketLike[];
  const yieldPockets = pockets.filter((p) => p.earns_yield);

  const [form, setForm] = useState({
    title: "Mi escenario",
    initial_balance: 10000,
    annual_rate: defaultRate,
    deposit_amount: 1000,
    deposit_freq: "biweekly" as Frequency,
    withdrawal_amount: 200,
    withdrawal_freq: "weekly" as Frequency,
    horizon_months: 12,
  });
  const [view, setView] = useState<"combined" | "individual">("combined");

  const data = useMemo(
    () =>
      simulateYield({
        initialBalance: form.initial_balance,
        annualPct: form.annual_rate,
        depositAmount: form.deposit_amount,
        depositFreq: form.deposit_freq,
        withdrawalAmount: form.withdrawal_amount,
        withdrawalFreq: form.withdrawal_freq,
        months: form.horizon_months,
      }),
    [form],
  );

  // Projection limited to the pockets the user marked for yields.
  const projection = useMemo(() => {
    const days = [0, 30, 60, 90, 180, 270, 365].filter((d) => d <= form.horizon_months * 30.44 || d === 0);
    return days.map((d) => {
      const row: Record<string, number | string> = { day: `${d}d` };
      let total = 0;
      for (const p of yieldPockets) {
        const base = Number(p.yield_base_balance ?? p.current_balance);
        const rate = Number(p.yield_rate ?? defaultRate);
        const value = compoundDaily(base, rate, d);
        row[p.id] = Math.round(value);
        total += value;
      }
      row.total = Math.round(total);
      return row;
    });
  }, [yieldPockets, defaultRate, form.horizon_months]);

  const finalBalance = data[data.length - 1]?.balance ?? 0;
  const totalContrib = data.length > 0 ? form.initial_balance : 0;
  const yieldBase = yieldPockets.reduce(
    (s, p) => s + Number(p.yield_base_balance ?? p.current_balance),
    0,
  );

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase.from("yield_simulations").insert({
        user_id: user.user.id,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escenario guardado");
      qc.invalidateQueries({ queryKey: ["yield_simulations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("yield_simulations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["yield_simulations"] }),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Simulador de rendimiento</h1>
        <p className="text-sm text-muted-foreground">
          Interés compuesto diario con depósitos y retiros periódicos.
        </p>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{YIELD_DISCLAIMER}</span>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold">Proyección de tus bolsillos con rendimiento</h2>
            <p className="text-xs text-muted-foreground">
              {yieldPockets.length === 0
                ? "Aún no marcas ningún bolsillo para rendimientos."
                : `${yieldPockets.length} bolsillo(s) · base ${money(yieldBase)}`}
            </p>
          </div>
          <div className="flex gap-1 rounded-md border border-border p-1">
            <Button size="sm" variant={view === "combined" ? "default" : "ghost"} onClick={() => setView("combined")}>
              En conjunto
            </Button>
            <Button size="sm" variant={view === "individual" ? "default" : "ghost"} onClick={() => setView("individual")}>
              Individual
            </Button>
          </div>
        </div>
        {yieldPockets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ve a Bolsillos y activa “Aplicar rendimiento” en los que quieras incluir.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection}>
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={70} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem" }}
                  formatter={(v: number) => money(v)}
                />
                {view === "individual" && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {view === "combined" ? (
                  <Line name="Total" type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                ) : (
                  yieldPockets.map((p) => (
                    <Line key={p.id} name={p.name} type="monotone" dataKey={p.id} stroke={p.color} strokeWidth={2} dot={false} />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {yieldPockets.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {yieldPockets.map((p) => {
              const base = Number(p.yield_base_balance ?? p.current_balance);
              const rate = Number(p.yield_rate ?? defaultRate);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{pct(rate)}</div>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setForm({ ...form, title: p.name, initial_balance: base, annual_rate: rate })}
                    >
                      Usar en simulador
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 space-y-4 lg:col-span-1">
          <h2 className="font-semibold">Parámetros</h2>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Balance inicial</Label>
              <Input type="number" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>APY (%)</Label>
              <Input type="number" step="0.1" value={form.annual_rate} onChange={(e) => setForm({ ...form, annual_rate: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Depósito</Label>
              <Input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={form.deposit_freq} onValueChange={(v) => setForm({ ...form, deposit_freq: v as Frequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Retiro</Label>
              <Input type="number" value={form.withdrawal_amount} onChange={(e) => setForm({ ...form, withdrawal_amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={form.withdrawal_freq} onValueChange={(v) => setForm({ ...form, withdrawal_freq: v as Frequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Horizonte (meses): {form.horizon_months}</Label>
            <Input type="range" min={1} max={60} value={form.horizon_months} onChange={(e) => setForm({ ...form, horizon_months: Number(e.target.value) })} />
          </div>
          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" /> Guardar escenario
          </Button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Proyección</h2>
              <p className="text-xs text-muted-foreground">
                Balance final: <span className="text-primary font-medium">{money(finalBalance)}</span> · aporte inicial {money(totalContrib)}
              </p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <defs>
                  <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={70} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem" }}
                  formatter={(v: number) => money(v)}
                />
                <Area type="monotone" dataKey="balance" stroke="none" fill="url(#balFill)" />
                <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {saved.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Escenarios guardados</h2>
          <div className="divide-y divide-border">
            {saved.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {money(s.initial_balance)} @ {s.annual_rate}% · {s.horizon_months}m
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    title: s.title,
                    initial_balance: Number(s.initial_balance),
                    annual_rate: Number(s.annual_rate),
                    deposit_amount: Number(s.deposit_amount),
                    deposit_freq: s.deposit_freq as Frequency,
                    withdrawal_amount: Number(s.withdrawal_amount),
                    withdrawal_freq: s.withdrawal_freq as Frequency,
                    horizon_months: s.horizon_months,
                  })}>
                    Cargar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
