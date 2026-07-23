import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { pocketsQuery, profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, pct } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Lock, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pockets")({
  head: () => ({
    meta: [
      { title: "Bolsillos — FinFlow" },
      { name: "description", content: "Distribución porcentual de tu ingreso en bolsillos." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(profileQuery());
  },
  component: PocketsPage,
});

function PocketsPage() {
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const { data: profile } = useSuspenseQuery(profileQuery());
  const qc = useQueryClient();
  const salary = Number(profile?.biweekly_salary ?? 0);
  const totalPct = pockets.reduce((s, p) => s + Number(p.target_percentage), 0);

  const update = useMutation({
    mutationFn: async (row: { id: string; target_percentage?: number; current_balance?: number; name?: string; color?: string }) => {
      const { id, ...patch } = row;
      const { error } = await supabase.from("pockets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pockets"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pockets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pockets"] }),
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Bolsillos</h1>
          <p className="text-sm text-muted-foreground">
            Total asignado: <span className={totalPct === 100 ? "text-primary" : "text-warning"}>{pct(totalPct)}</span>
          </p>
        </div>
        <NewPocketDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pockets.map((p) => {
          const target = (salary * Number(p.target_percentage)) / 100;
          return (
            <Card key={p.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      {p.name}
                      {p.is_locked_savings && <Lock className="h-3 w-3 text-warning" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pct(p.target_percentage)} · {money(target)}/quincena
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <EditPocketDialog pocket={p} />
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="text-2xl font-bold">{money(p.current_balance)}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Balance</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={p.current_balance}
                    onBlur={(e) =>
                      update.mutate({ id: p.id, current_balance: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">% Meta</Label>
                  <Input
                    type="number"
                    step="0.1"
                    defaultValue={p.target_percentage}
                    onBlur={(e) =>
                      update.mutate({ id: p.id, target_percentage: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewPocketDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState(10);
  const [color, setColor] = useState("#10B981");

  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase.from("pockets").insert({
        user_id: user.user.id,
        name,
        target_percentage: percentage,
        color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bolsillo creado");
      qc.invalidateQueries({ queryKey: ["pockets"] });
      setOpen(false);
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Nuevo bolsillo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo bolsillo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Viajes 10%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>% Meta</Label>
              <Input type="number" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PocketRow = {
  id: string;
  name: string;
  target_percentage: number;
  color: string;
  is_locked_savings: boolean;
};

function EditPocketDialog({ pocket }: { pocket: PocketRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: pocket.name,
    target_percentage: Number(pocket.target_percentage),
    color: pocket.color,
    is_locked_savings: pocket.is_locked_savings,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pockets").update(form).eq("id", pocket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bolsillo actualizado");
      qc.invalidateQueries({ queryKey: ["pockets"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar bolsillo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>% Meta</Label>
              <Input type="number" step="0.1" value={form.target_percentage} onChange={(e) => setForm({ ...form, target_percentage: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Ahorro bloqueado</Label>
              <p className="text-xs text-muted-foreground">Marca este bolsillo como reserva.</p>
            </div>
            <Switch checked={form.is_locked_savings} onCheckedChange={(v) => setForm({ ...form, is_locked_savings: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
            Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

