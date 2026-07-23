import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { flowsQuery, pocketsQuery, profileQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus, FREE_LIMITS, limitForFree } from "@/lib/subscription";
import { HiddenByPlanNotice } from "@/components/PastDueBanner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { Plus, Trash2, ArrowDownRight, ArrowUpRight, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flows")({
  head: () => ({
    meta: [
      { title: "Flujos — Finance Flow Pocket" },
      { name: "description", content: "Depósitos y retiros programados vinculados a tus bolsillos." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(flowsQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
  },
  component: FlowsPage,
});

type Pocket = { id: string; name: string };
type FlowRow = {
  id: string;
  title: string;
  amount: number;
  flow_type: string;
  frequency: string;
  pocket_id: string | null;
  next_execution_date: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
};

const FREQ_LABEL: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  weekly_dow: "Semanal (día)",
  biweekly: "Quincenal",
  monthly: "Mensual",
  one_time: "Único",
};

const DOW_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function FlowsPage() {
  const { data: flows } = useSuspenseQuery(flowsQuery());
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled_flows"] }),
  });

  const { visible: visibleFlows, hiddenCount } = limitForFree(flows, isPro, FREE_LIMITS.flows);
  const inflow = visibleFlows.filter((f) => f.flow_type === "deposit").reduce((s, f) => s + Number(f.amount), 0);
  const outflow = visibleFlows.filter((f) => f.flow_type === "withdrawal").reduce((s, f) => s + Number(f.amount), 0);
  const atFreeLimit = !isPro && flows.length >= FREE_LIMITS.flows;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Flujos programados</h1>
          <p className="text-sm text-muted-foreground">
            Entradas: <span className="text-primary">{money(inflow)}</span> · Salidas:{" "}
            <span className="text-destructive">{money(outflow)}</span>
          </p>
        </div>
        <FlowDialog mode="create" pockets={pockets} disabled={atFreeLimit} />
      </div>

      <HiddenByPlanNotice hiddenCount={hiddenCount} entity="flujos" />

      {atFreeLimit && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          Alcanzaste el límite Free de {FREE_LIMITS.flows} flujos. <a href="/upgrade" className="underline text-primary">Actualiza a Pro</a> para flujos ilimitados.
        </div>
      )}

      {visibleFlows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aún no tienes flujos programados.
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {visibleFlows.map((f) => {
            const freqDesc =
              f.frequency === "weekly" && f.day_of_week !== null
                ? `Semanal (${DOW_LABEL[f.day_of_week]})`
                : f.frequency === "monthly" && f.day_of_month
                  ? `Mensual (día ${f.day_of_month})`
                  : FREQ_LABEL[f.frequency] ?? f.frequency;
            return (
              <div key={f.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-full grid place-items-center ${
                      f.flow_type === "deposit" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {f.flow_type === "deposit" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {freqDesc} · Próx: {f.next_execution_date ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`font-semibold ${f.flow_type === "deposit" ? "text-primary" : "text-destructive"}`}>
                    {f.flow_type === "deposit" ? "+" : "−"}
                    {money(f.amount)}
                  </div>
                  <FlowDialog mode="edit" pockets={pockets} flow={f as FlowRow} />
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function FlowDialog({ mode, pockets, flow }: { mode: "create" | "edit"; pockets: Pocket[]; flow?: FlowRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: flow?.title ?? "",
    amount: Number(flow?.amount ?? 0),
    flow_type: (flow?.flow_type ?? "withdrawal") as "deposit" | "withdrawal",
    frequency: (flow?.frequency ?? "weekly") as "daily" | "weekly" | "biweekly" | "monthly" | "one_time",
    pocket_id: flow?.pocket_id ?? "",
    next_execution_date: flow?.next_execution_date ?? "",
    day_of_week: flow?.day_of_week ?? 1,
    day_of_month: flow?.day_of_month ?? 1,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        amount: form.amount,
        flow_type: form.flow_type,
        frequency: form.frequency,
        pocket_id: form.pocket_id || null,
        next_execution_date: form.next_execution_date || null,
        day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
        day_of_month: form.frequency === "monthly" ? form.day_of_month : null,
      };
      if (mode === "edit" && flow) {
        const { error } = await supabase.from("scheduled_flows").update(payload).eq("id", flow.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("No auth");
        const { error } = await supabase.from("scheduled_flows").insert({ user_id: user.user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Flujo actualizado" : "Flujo creado");
      qc.invalidateQueries({ queryKey: ["scheduled_flows"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "edit" ? (
          <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4 mr-1" /> Nuevo flujo</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar flujo" : "Nuevo flujo programado"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Renta, Gasolina, Ahorro..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.flow_type} onValueChange={(v) => setForm({ ...form, flow_type: v as "deposit" | "withdrawal" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Depósito</SelectItem>
                  <SelectItem value="withdrawal">Retiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as typeof form.frequency })}>
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
              <Label>Próxima fecha</Label>
              <Input type="date" value={form.next_execution_date} onChange={(e) => setForm({ ...form, next_execution_date: e.target.value })} />
            </div>
            {form.frequency === "weekly" && (
              <div className="space-y-2 col-span-2">
                <Label>Día de la semana</Label>
                <Select value={String(form.day_of_week)} onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOW_LABEL.map((label, i) => (
                      <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.frequency === "monthly" && (
              <div className="space-y-2 col-span-2">
                <Label>Día del mes (1–31)</Label>
                <Input type="number" min={1} max={31} value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Bolsillo (opcional)</Label>
            <Select value={form.pocket_id || "__none"} onValueChange={(v) => setForm({ ...form, pocket_id: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sin bolsillo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin bolsillo</SelectItem>
                {pockets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
            {mode === "edit" ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
