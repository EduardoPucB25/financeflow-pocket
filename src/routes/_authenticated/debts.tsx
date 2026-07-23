import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { debtsQuery, profileQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus, FREE_LIMITS, limitForFree } from "@/lib/subscription";
import { HiddenByPlanNotice } from "@/components/PastDueBanner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money, pct } from "@/lib/format";
import { graceInfo } from "@/lib/finance";
import { CreditCard, Plus, Trash2, Pencil, Landmark, Wallet, Home, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "Deudas — Finance Flow Pocket" },
      { name: "description", content: "Gestiona tarjetas, préstamos y otras deudas. Optimiza pagos y periodo de gracia." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(debtsQuery()),
  component: DebtsPage,
});

type DebtType = "card" | "loan" | "personal" | "mortgage" | "other";

type DebtRow = {
  id: string;
  name: string;
  debt_type: string;
  current_balance: number;
  credit_limit: number | null;
  interest_rate: number;
  minimum_payment: number;
  cutoff_day: number | null;
  due_day: number | null;
  target_payoff_date: string | null;
  notes: string | null;
  status: string;
};

const TYPE_META: Record<string, { label: string; icon: typeof CreditCard }> = {
  card: { label: "Tarjeta de crédito", icon: CreditCard },
  loan: { label: "Préstamo", icon: Landmark },
  personal: { label: "Personal", icon: Wallet },
  mortgage: { label: "Hipoteca", icon: Home },
  other: { label: "Otro", icon: Wallet },
};

function DebtsPage() {
  const { data: debts } = useSuspenseQuery(debtsQuery());
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });

  const { visible: visibleDebts, hiddenCount } = limitForFree(debts, isPro, FREE_LIMITS.debts);
  const totalDebt = visibleDebts.reduce((s, d) => s + Number(d.current_balance), 0);
  const totalMinimum = visibleDebts.reduce((s, d) => s + Number(d.minimum_payment), 0);
  const totalInvisible = isPro
    ? visibleDebts
        .filter((d) => d.debt_type === "card")
        .reduce((s, c) => s + (Number(c.credit_limit ?? 0) - Number(c.current_balance)), 0)
    : 0;
  const atFreeLimit = !isPro && debts.length >= FREE_LIMITS.debts;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Deudas</h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="text-destructive font-medium">{money(totalDebt)}</span> · Pago mínimo mensual:{" "}
            <span className="text-warning">{money(totalMinimum)}</span>
            {isPro ? (
              <>
                {" "}· Invisible Cash: <span className="text-accent">{money(totalInvisible)}</span>
              </>
            ) : (
              <>
                {" "}· <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3" />Invisible Cash (Pro)</span>
              </>
            )}
          </p>
        </div>
        <DebtDialog mode="create" disabled={atFreeLimit} />
      </div>

      <HiddenByPlanNotice hiddenCount={hiddenCount} entity="deudas" />

      {atFreeLimit && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          Alcanzaste el límite Free de {FREE_LIMITS.debts} deudas. <a href="/upgrade" className="underline text-primary">Actualiza a Pro</a> para registrar deudas ilimitadas.
        </div>
      )}

      {debts.length === 0 ? (
        <Card className="p-10 text-center">
          <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Agrega tu primera deuda (tarjeta, préstamo o similar) para empezar a gestionarla.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleDebts.map((d) => {
            const Icon = (TYPE_META[d.debt_type] ?? TYPE_META.other).icon;
            const isCard = d.debt_type === "card" && d.cutoff_day && d.due_day;
            const g = isCard ? graceInfo(d.cutoff_day!, d.due_day!) : null;
            const available = Number(d.credit_limit ?? 0) - Number(d.current_balance);
            const utilization = d.credit_limit
              ? Math.min(100, Math.round((Number(d.current_balance) / Number(d.credit_limit)) * 100))
              : null;
            return (
              <Card key={d.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive grid place-items-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(TYPE_META[d.debt_type] ?? TYPE_META.other).label}
                        {d.interest_rate > 0 && ` · ${pct(d.interest_rate)} anual`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <DebtDialog mode="edit" debt={d as DebtRow} />
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Saldo</div>
                    <div className="font-semibold text-destructive">{money(d.current_balance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pago mínimo</div>
                    <div className="font-medium">{money(d.minimum_payment)}</div>
                  </div>
                </div>

                {utilization !== null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Uso del crédito</span>
                      <span>{utilization}%</span>
                    </div>
                    <Progress value={utilization} />
                  </div>
                )}

                {isCard && g && isPro && (
                  <div className="rounded-md bg-accent/10 border border-accent/30 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Invisible Cash disponible</div>
                    <div className="text-xl font-bold text-accent">{money(available)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Corte en {Math.max(0, g.daysToCutoff)}d · Pago en {g.daysToDue}d · Ventana {g.maxFloat}d
                    </div>
                  </div>
                )}
                {isCard && !isPro && (
                  <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>Estrategia Invisible Cash disponible en <a href="/upgrade" className="text-primary underline">Pro</a>.</span>
                  </div>
                )}

                {d.target_payoff_date && (
                  <div className="text-xs text-muted-foreground">
                    Objetivo de liquidación: <span className="text-foreground">{d.target_payoff_date}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DebtDialog({ mode, debt, disabled }: { mode: "create" | "edit"; debt?: DebtRow; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: debt?.name ?? "",
    debt_type: (debt?.debt_type ?? "card") as DebtType,
    current_balance: Number(debt?.current_balance ?? 0),
    credit_limit: Number(debt?.credit_limit ?? 0),
    interest_rate: Number(debt?.interest_rate ?? 0),
    minimum_payment: Number(debt?.minimum_payment ?? 0),
    cutoff_day: debt?.cutoff_day ?? 27,
    due_day: debt?.due_day ?? 7,
    target_payoff_date: debt?.target_payoff_date ?? "",
    notes: debt?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const isCard = form.debt_type === "card";
      const payload = {
        name: form.name,
        debt_type: form.debt_type,
        current_balance: form.current_balance,
        credit_limit: isCard ? form.credit_limit : null,
        interest_rate: form.interest_rate,
        minimum_payment: form.minimum_payment,
        cutoff_day: isCard ? form.cutoff_day : null,
        due_day: isCard ? form.due_day : null,
        target_payoff_date: form.target_payoff_date || null,
        notes: form.notes || null,
      };
      if (mode === "edit" && debt) {
        const { error } = await supabase.from("debts").update(payload).eq("id", debt.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("No auth");
        const { error } = await supabase.from("debts").insert({ user_id: user.user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Deuda actualizada" : "Deuda agregada");
      qc.invalidateQueries({ queryKey: ["debts"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCard = form.debt_type === "card";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "edit" ? (
          <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button disabled={disabled}><Plus className="h-4 w-4 mr-1" /> Nueva deuda</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar deuda" : "Nueva deuda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Nu Platino, Préstamo auto..." />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Tipo</Label>
              <Select value={form.debt_type} onValueChange={(v) => setForm({ ...form, debt_type: v as DebtType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Tarjeta de crédito</SelectItem>
                  <SelectItem value="loan">Préstamo bancario</SelectItem>
                  <SelectItem value="personal">Préstamo personal</SelectItem>
                  <SelectItem value="mortgage">Hipoteca</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo actual</Label>
              <Input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Tasa anual (%)</Label>
              <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Pago mínimo</Label>
              <Input type="number" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha objetivo</Label>
              <Input type="date" value={form.target_payoff_date} onChange={(e) => setForm({ ...form, target_payoff_date: e.target.value })} />
            </div>
            {isCard && (
              <>
                <div className="space-y-2">
                  <Label>Límite de crédito</Label>
                  <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
                </div>
                <div className="space-y-2" />
                <div className="space-y-2">
                  <Label>Día de corte</Label>
                  <Input type="number" min={1} max={31} value={form.cutoff_day} onChange={(e) => setForm({ ...form, cutoff_day: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Día de pago</Label>
                  <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
                </div>
              </>
            )}
            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
            {mode === "edit" ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
