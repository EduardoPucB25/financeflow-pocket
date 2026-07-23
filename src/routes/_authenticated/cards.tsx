import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cardsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { graceInfo } from "@/lib/finance";
import { CreditCard, Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cards")({
  head: () => ({
    meta: [
      { title: "Tarjetas — FinFlow" },
      { name: "description", content: "Optimiza el periodo de gracia de tus tarjetas de crédito." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cardsQuery()),
  component: CardsPage,
});

type CardRow = {
  id: string;
  card_name: string;
  credit_limit: number;
  current_balance: number;
  cutoff_day: number;
  due_day: number;
};

function CardsPage() {
  const { data: cards } = useSuspenseQuery(cardsQuery());
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit_cards"] }),
  });

  const totalInvisible = cards.reduce(
    (s, c) => s + (Number(c.credit_limit) - Number(c.current_balance)),
    0,
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Tarjetas</h1>
          <p className="text-sm text-muted-foreground">
            Invisible Cash total: <span className="text-accent font-medium">{money(totalInvisible)}</span>
          </p>
        </div>
        <CardDialog mode="create" />
      </div>

      {cards.length === 0 ? (
        <Card className="p-10 text-center">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Agrega tu primera tarjeta para calcular tu periodo de gracia.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const g = graceInfo(c.cutoff_day, c.due_day);
            const daysLeft = Math.max(0, g.daysToCutoff);
            const pctLeft = Math.min(100, Math.round(((g.maxFloat - daysLeft) / g.maxFloat) * 100));
            const available = Number(c.credit_limit) - Number(c.current_balance);
            return (
              <Card key={c.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{c.card_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Corte día {c.cutoff_day} · Pago día {c.due_day}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <CardDialog mode="edit" card={c as CardRow} />
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Deuda</div>
                    <div className="font-medium">{money(c.current_balance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Límite</div>
                    <div className="font-medium">{money(c.credit_limit)}</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Al corte</span>
                    <span>{daysLeft}d</span>
                  </div>
                  <Progress value={pctLeft} />
                </div>
                <div className="rounded-md bg-accent/10 border border-accent/30 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Invisible Cash disponible</div>
                  <div className="text-xl font-bold text-accent">{money(available)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Ventana máxima sin intereses: {g.maxFloat} días · Próximo pago en {g.daysToDue}d
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardDialog({ mode, card }: { mode: "create" | "edit"; card?: CardRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    card_name: card?.card_name ?? "",
    credit_limit: Number(card?.credit_limit ?? 0),
    current_balance: Number(card?.current_balance ?? 0),
    cutoff_day: card?.cutoff_day ?? 27,
    due_day: card?.due_day ?? 7,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "edit" && card) {
        const { error } = await supabase.from("credit_cards").update(form).eq("id", card.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("No auth");
        const { error } = await supabase.from("credit_cards").insert({ user_id: user.user.id, ...form });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Tarjeta actualizada" : "Tarjeta agregada");
      qc.invalidateQueries({ queryKey: ["credit_cards"] });
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
          <Button><Plus className="h-4 w-4 mr-1" /> Nueva tarjeta</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} placeholder="Ej. Nu, Revolut, Mercado Pago" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Límite</Label>
              <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Deuda actual</Label>
              <Input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Día de corte</Label>
              <Input type="number" min={1} max={31} value={form.cutoff_day} onChange={(e) => setForm({ ...form, cutoff_day: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Día de pago</Label>
              <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.card_name || save.isPending}>
            {mode === "edit" ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
