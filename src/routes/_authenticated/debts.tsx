import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { debtsQuery, profileQuery, subscriptionQuery, transactionsQuery } from "@/lib/queries";
import { deriveSubStatus, FREE_LIMITS, limitForFree } from "@/lib/subscription";
import { HiddenByPlanNotice } from "@/components/PastDueBanner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money, pct } from "@/lib/format";
import {
  nextCutoffAndDue,
  formatDateEs,
  safeToSpend,
  periodSpend,
  limitStatus,
  type SpendTx,
  type LimitStatus,
} from "@/lib/finance";
import { CreditCard, Plus, Trash2, Pencil, Landmark, Wallet, Home, Lock, AlertTriangle, CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "Deudas — Finance Flow Pocket" },
      { name: "description", content: "Gestiona tarjetas, préstamos y otras deudas. Fechas de corte y pago, crédito disponible y límites de gasto." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(debtsQuery());
    context.queryClient.ensureQueryData(transactionsQuery());
  },
  component: DebtsPage,
});

type DebtType = "card" | "loan" | "personal" | "mortgage" | "other";

type DebtRow = {
  id: string;
  name: string;
  debt_type: string;
  current_balance: number;
  statement_balance: number;
  credit_limit: number | null;
  interest_rate: number;
  minimum_payment: number;
  cutoff_day: number | null;
  due_day: number | null;
  target_payoff_date: string | null;
  notes: string | null;
  status: string;
  spend_limit_daily: number | null;
  spend_limit_weekly: number | null;
  spend_limit_monthly: number | null;
  auto_apply_transactions: boolean;
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
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const { data: profile } = useQuery(profileQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const spendTxs = txs as unknown as SpendTx[];

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Deuda eliminada");
    },
  });

  const { visible: visibleDebts, hiddenCount } = limitForFree(debts, isPro, FREE_LIMITS.debts);
  const totalDebt = visibleDebts.reduce((s, d) => s + Number(d.current_balance), 0);
  const totalMinimum = visibleDebts.reduce((s, d) => s + Number(d.minimum_payment), 0);
  const cardsWithLimit = visibleDebts.filter(
    (d) => d.debt_type === "card" && Number(d.credit_limit ?? 0) > 0,
  );
  const totalInvisible = cardsWithLimit.reduce(
    (s, c) => s + Math.max(0, Number(c.credit_limit ?? 0) - Number(c.current_balance)),
    0,
  );
  const atFreeLimit = !isPro && debts.length >= FREE_LIMITS.debts;

  const globalLimit = Number(profile?.global_spend_limit_monthly ?? 0);
  const globalSpent = useMemo(() => periodSpend(spendTxs, "monthly"), [spendTxs]);
  const globalStatus = limitStatus("monthly", globalLimit, globalSpent);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Deudas</h1>
          <p className="text-sm text-muted-foreground">
            Total: <span className="text-destructive font-medium">{money(totalDebt)}</span> · Pago mínimo mensual:{" "}
            <span className="text-warning">{money(totalMinimum)}</span>
            {isPro ? (
              cardsWithLimit.length > 0 ? (
                <>
                  {" "}· Invisible Cash: <span className="text-accent">{money(totalInvisible)}</span>
                </>
              ) : (
                <> · Invisible Cash: define el límite de tus tarjetas</>
              )
            ) : (
              <>
                {" "}· <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3" />Invisible Cash (Pro)</span>
              </>
            )}
          </p>
        </div>
        <DebtDialog mode="create" disabled={atFreeLimit} />
      </div>

      {globalLimit > 0 && <GlobalLimitBanner status={globalStatus} />}

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
          {visibleDebts.map((d) => (
            <DebtCard
              key={d.id}
              debt={d as unknown as DebtRow}
              isPro={isPro}
              txs={spendTxs}
              onDelete={() => del.mutate(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalLimitBanner({ status }: { status: LimitStatus }) {
  if (status.level === "ok") {
    return (
      <div className="rounded-md border border-border bg-card px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span className="text-muted-foreground">
          Gasto del mes: <span className="text-foreground font-medium">{money(status.spent)}</span> de {money(status.limit)}
        </span>
        <span className="text-primary">Te quedan {money(status.remaining)}</span>
      </div>
    );
  }
  const over = status.level === "over";
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm flex items-start gap-3 ${
        over ? "border-destructive/40 bg-destructive/10" : "border-warning/40 bg-warning/10"
      }`}
    >
      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${over ? "text-destructive" : "text-warning"}`} />
      <div>
        <div className="font-medium">
          {over ? "Superaste tu límite de gasto mensual" : "Estás cerca de tu límite de gasto mensual"}
        </div>
        <div className="text-muted-foreground">
          Llevas {money(status.spent)} de {money(status.limit)} ({Math.round(status.ratio * 100)}%).
          {over ? " Considera pausar gastos hasta tu próximo ingreso." : ` Te quedan ${money(status.remaining)}.`}
        </div>
      </div>
    </div>
  );
}

function DebtCard({
  debt: d,
  isPro,
  txs,
  onDelete,
}: {
  debt: DebtRow;
  isPro: boolean;
  txs: SpendTx[];
  onDelete: () => void;
}) {
  const Icon = (TYPE_META[d.debt_type] ?? TYPE_META.other).icon;
  const creditLimit = Number(d.credit_limit ?? 0);
  const hasCycle = d.debt_type === "card" && !!d.cutoff_day && !!d.due_day;
  const cycle = hasCycle ? nextCutoffAndDue(d.cutoff_day!, d.due_day!) : null;
  const hasLimit = d.debt_type === "card" && creditLimit > 0;
  const available = Math.max(0, creditLimit - Number(d.current_balance));
  const utilization = hasLimit
    ? Math.min(100, Math.round((Number(d.current_balance) / creditLimit) * 100))
    : null;

  const sim = hasLimit
    ? safeToSpend({
        creditLimit,
        currentBalance: Number(d.current_balance),
        cutoffDay: d.cutoff_day,
        dueDay: d.due_day,
      })
    : null;

  const limits = useMemo(() => {
    const rows: LimitStatus[] = [];
    const cfg: [("daily" | "weekly" | "monthly"), number | null][] = [
      ["daily", d.spend_limit_daily],
      ["weekly", d.spend_limit_weekly],
      ["monthly", d.spend_limit_monthly],
    ];
    for (const [period, limit] of cfg) {
      const value = Number(limit ?? 0);
      if (value <= 0) continue;
      rows.push(limitStatus(period, value, periodSpend(txs, period, { debtId: d.id })));
    }
    return rows;
  }, [txs, d.id, d.spend_limit_daily, d.spend_limit_weekly, d.spend_limit_monthly]);

  const worst = limits.find((l) => l.level === "over") ?? limits.find((l) => l.level === "warn");

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{d.name}</div>
            <div className="text-xs text-muted-foreground">
              {(TYPE_META[d.debt_type] ?? TYPE_META.other).label}
              {Number(d.interest_rate) > 0 && ` · ${pct(d.interest_rate)} anual`}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <DebtDialog mode="edit" debt={d} />
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Saldo actual</div>
          <div className="font-semibold text-destructive">{money(d.current_balance)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Saldo al corte</div>
          <div className="font-medium">{money(d.statement_balance)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pago mínimo</div>
          <div className="font-medium">{money(d.minimum_payment)}</div>
        </div>
      </div>

      {cycle && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <CalendarClock className="h-3.5 w-3.5" /> Fechas del ciclo
          </div>
          <div className="text-muted-foreground">
            Corte: <span className="text-foreground">{formatDateEs(cycle.cutoff)}</span> (en {cycle.daysToCutoff}d)
          </div>
          <div className="text-muted-foreground">
            Se paga: <span className="text-foreground">{formatDateEs(cycle.due)}</span> (en {cycle.daysToDue}d)
          </div>
          <div className="text-muted-foreground">Ventana sin intereses: hasta {cycle.maxFloat} días</div>
        </div>
      )}

      {d.debt_type === "card" && !hasLimit && (
        <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">
          Define el <span className="text-foreground">límite de crédito</span> para calcular tu crédito disponible e Invisible Cash.
        </div>
      )}

      {utilization !== null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Uso del crédito</span>
            <span>{utilization}%</span>
          </div>
          <Progress value={utilization} />
          <div className="text-xs text-muted-foreground mt-1">
            Disponible: <span className="text-foreground">{money(available)}</span> de {money(creditLimit)}
          </div>
        </div>
      )}

      {hasLimit && isPro && (
        <div className="rounded-md bg-accent/10 border border-accent/30 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Invisible Cash disponible</div>
          <div className="text-xl font-bold text-accent">{money(available)}</div>
          {sim && (
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div>
                Puedes gastar ~<span className="text-foreground">{money(sim.perDay)}</span>/día o{" "}
                <span className="text-foreground">{money(sim.perWeek)}</span>/semana sin saturar la tarjeta antes del corte.
              </div>
              <div>Se reparte entre los {sim.daysToCutoff} días que faltan para el corte.</div>
            </div>
          )}
        </div>
      )}
      {d.debt_type === "card" && !isPro && (
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4 text-primary" />
          <span>Estrategia Invisible Cash disponible en <a href="/upgrade" className="text-primary underline">Pro</a>.</span>
        </div>
      )}

      {limits.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium">Límites de gasto</div>
          {limits.map((l) => (
            <div key={l.period}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  {l.period === "daily" ? "Hoy" : l.period === "weekly" ? "Esta semana" : "Este mes"}
                </span>
                <span
                  className={
                    l.level === "over" ? "text-destructive" : l.level === "warn" ? "text-warning" : "text-muted-foreground"
                  }
                >
                  {money(l.spent)} / {money(l.limit)}
                </span>
              </div>
              <Progress value={Math.min(100, Math.round(l.ratio * 100))} className="h-1.5" />
            </div>
          ))}
          {worst && (
            <div
              className={`flex items-start gap-2 text-xs rounded-md p-2 ${
                worst.level === "over"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {worst.level === "over"
                  ? `Superaste tu límite ${worst.period === "daily" ? "diario" : worst.period === "weekly" ? "semanal" : "mensual"} en ${money(-worst.remaining)}.`
                  : `Vas al ${Math.round(worst.ratio * 100)}% de tu límite ${worst.period === "daily" ? "diario" : worst.period === "weekly" ? "semanal" : "mensual"}.`}
              </span>
            </div>
          )}
        </div>
      )}

      {d.target_payoff_date && (
        <div className="text-xs text-muted-foreground">
          Objetivo de liquidación: <span className="text-foreground">{formatDateEs(d.target_payoff_date)}</span>
        </div>
      )}
    </Card>
  );
}

function emptyForm(debt?: DebtRow) {
  return {
    name: debt?.name ?? "",
    debt_type: (debt?.debt_type ?? "card") as DebtType,
    current_balance: Number(debt?.current_balance ?? 0),
    statement_balance: Number(debt?.statement_balance ?? 0),
    credit_limit: Number(debt?.credit_limit ?? 0),
    interest_rate: Number(debt?.interest_rate ?? 0),
    minimum_payment: Number(debt?.minimum_payment ?? 0),
    cutoff_day: debt?.cutoff_day ?? 27,
    due_day: debt?.due_day ?? 7,
    target_payoff_date: debt?.target_payoff_date ?? "",
    notes: debt?.notes ?? "",
    spend_limit_daily: Number(debt?.spend_limit_daily ?? 0),
    spend_limit_weekly: Number(debt?.spend_limit_weekly ?? 0),
    spend_limit_monthly: Number(debt?.spend_limit_monthly ?? 0),
    auto_apply_transactions: debt?.auto_apply_transactions ?? true,
  };
}

function DebtDialog({ mode, debt, disabled }: { mode: "create" | "edit"; debt?: DebtRow; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(debt));

  // Re-sync the form with the saved record every time the dialog opens,
  // so edits always start from the current values (not a stale first render).
  useEffect(() => {
    if (open) setForm(emptyForm(debt));
  }, [open, debt]);

  const save = useMutation({
    mutationFn: async () => {
      const isCard = form.debt_type === "card";
      const payload = {
        name: form.name,
        debt_type: form.debt_type,
        current_balance: form.current_balance,
        statement_balance: isCard ? form.statement_balance : 0,
        credit_limit: isCard ? form.credit_limit : null,
        interest_rate: form.interest_rate,
        minimum_payment: form.minimum_payment,
        cutoff_day: isCard ? form.cutoff_day : null,
        due_day: isCard ? form.due_day : null,
        target_payoff_date: form.target_payoff_date || null,
        notes: form.notes || null,
        spend_limit_daily: form.spend_limit_daily > 0 ? form.spend_limit_daily : null,
        spend_limit_weekly: form.spend_limit_weekly > 0 ? form.spend_limit_weekly : null,
        spend_limit_monthly: form.spend_limit_monthly > 0 ? form.spend_limit_monthly : null,
        auto_apply_transactions: form.auto_apply_transactions,
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
  const preview =
    isCard && form.cutoff_day && form.due_day ? nextCutoffAndDue(form.cutoff_day, form.due_day) : null;

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
              <Input type="number" step="0.01" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Tasa anual (%)</Label>
              <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Pago mínimo</Label>
              <Input type="number" step="0.01" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha objetivo</Label>
              <Input type="date" value={form.target_payoff_date} onChange={(e) => setForm({ ...form, target_payoff_date: e.target.value })} />
            </div>
            {isCard && (
              <>
                <div className="space-y-2">
                  <Label>Límite de crédito</Label>
                  <Input type="number" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
                  {form.credit_limit <= 0 && (
                    <p className="text-xs text-warning">Necesario para calcular crédito disponible.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Saldo al corte</Label>
                  <Input type="number" step="0.01" value={form.statement_balance} onChange={(e) => setForm({ ...form, statement_balance: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Día de corte</Label>
                  <Input type="number" min={1} max={31} value={form.cutoff_day} onChange={(e) => setForm({ ...form, cutoff_day: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Día de pago</Label>
                  <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
                </div>
                {preview && (
                  <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Próximo corte: <span className="text-foreground">{formatDateEs(preview.cutoff)}</span> · se paga el{" "}
                    <span className="text-foreground">{formatDateEs(preview.due)}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Límite gasto diario</Label>
                  <Input type="number" step="0.01" value={form.spend_limit_daily} onChange={(e) => setForm({ ...form, spend_limit_daily: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Límite gasto semanal</Label>
                  <Input type="number" step="0.01" value={form.spend_limit_weekly} onChange={(e) => setForm({ ...form, spend_limit_weekly: Number(e.target.value) })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Límite gasto mensual</Label>
                  <Input type="number" step="0.01" value={form.spend_limit_monthly} onChange={(e) => setForm({ ...form, spend_limit_monthly: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">Deja en 0 los límites que no quieras usar.</p>
                </div>
              </>
            )}
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label>Movimientos ajustan el saldo</Label>
                <p className="text-xs text-muted-foreground">
                  Los gastos ligados a esta deuda suman al saldo y los pagos lo reducen.
                </p>
              </div>
              <Switch
                checked={form.auto_apply_transactions}
                onCheckedChange={(v) => setForm({ ...form, auto_apply_transactions: v })}
              />
            </div>
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
