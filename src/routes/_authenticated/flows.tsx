import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flowsQuery, pocketsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { Plus, Trash2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flows")({
  head: () => ({
    meta: [
      { title: "Flujos — FinFlow" },
      { name: "description", content: "Depósitos y retiros programados vinculados a tus bolsillos." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(flowsQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
  },
  component: FlowsPage,
});

function FlowsPage() {
  const { data: flows } = useSuspenseQuery(flowsQuery());
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled_flows"] }),
  });

  const inflow = flows.filter((f) => f.flow_type === "deposit").reduce((s, f) => s + Number(f.amount), 0);
  const outflow = flows.filter((f) => f.flow_type === "withdrawal").reduce((s, f) => s + Number(f.amount), 0);

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
        <NewFlowDialog pockets={pockets} />
      </div>

      {flows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aún no tienes flujos programados.
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {flows.map((f) => (
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
                    {f.frequency} · Próx: {f.next_execution_date ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className={`font-semibold ${f.flow_type === "deposit" ? "text-primary" : "text-destructive"}`}>
                  {f.flow_type === "deposit" ? "+" : "−"}
                  {money(f.amount)}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function NewFlowDialog({ pockets }: { pockets: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: 0,
    flow_type: "withdrawal" as "deposit" | "withdrawal",
    frequency: "weekly" as "weekly" | "biweekly" | "monthly" | "one_time",
    pocket_id: "" as string,
    next_execution_date: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase.from("scheduled_flows").insert({
        user_id: user.user.id,
        title: form.title,
        amount: form.amount,
        flow_type: form.flow_type,
        frequency: form.frequency,
        pocket_id: form.pocket_id || null,
        next_execution_date: form.next_execution_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flujo creado");
      qc.invalidateQueries({ queryKey: ["scheduled_flows"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Nuevo flujo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo flujo programado</DialogTitle>
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
          </div>
          <div className="space-y-2">
            <Label>Bolsillo (opcional)</Label>
            <Select value={form.pocket_id} onValueChange={(v) => setForm({ ...form, pocket_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sin bolsillo" /></SelectTrigger>
              <SelectContent>
                {pockets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
