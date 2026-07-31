import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debtStatementsQuery, pocketsQuery, type DebtStatementRow } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/format";
import { formatDateEs } from "@/lib/finance";
import { toast } from "sonner";
import { CalendarRange, Plus, Pencil, Trash2, Undo2, CopyPlus, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatementDebt {
  id: string;
  name: string;
  statement_balance: number;
  due_day: number | null;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Clamp a day-of-month to the actual length of that month (year, month 1-12). */
function clampedDateISO(year: number, month1: number, day: number): string {
  const lastDay = new Date(year, month1, 0).getDate();
  const d = new Date(year, month1 - 1, Math.min(day, lastDay));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default due date for a period: the debt's due_day in the month AFTER the period. */
function defaultDueDate(debt: StatementDebt, year: number, month1: number): string {
  const nextMonth = month1 === 12 ? 1 : month1 + 1;
  const nextYear = month1 === 12 ? year + 1 : year;
  return clampedDateISO(nextYear, nextMonth, debt.due_day ?? 1);
}

function periodLabel(s: { period_year: number; period_month: number }): string {
  return `${MONTH_NAMES[s.period_month - 1]} ${s.period_year}`;
}

interface StatementForm {
  id: string | null; // null = creating
  period_month: number;
  period_year: number;
  amount: number;
  due_date: string;
  notes: string;
}

export function StatementsDialog({ debt }: { debt: StatementDebt }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const today = new Date();

  const { data: allStatements } = useQuery({ ...debtStatementsQuery(), enabled: open });
  const { data: pockets } = useQuery({ ...pocketsQuery(), enabled: open });

  const statements = (allStatements ?? [])
    .filter((s) => s.debt_id === debt.id)
    .sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month);

  const [form, setForm] = useState<StatementForm | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payPocketId, setPayPocketId] = useState<string>("");
  const [payAmount, setPayAmount] = useState<number>(0);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["debt_statements"] });
    qc.invalidateQueries({ queryKey: ["debts"] });
    qc.invalidateQueries({ queryKey: ["pockets"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const upsert = useMutation({
    mutationFn: async (f: StatementForm) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const payload = {
        period_year: f.period_year,
        period_month: f.period_month,
        amount: f.amount,
        due_date: f.due_date,
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await supabase.from("debt_statements")
          .update(payload)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("debt_statements").insert({
          ...payload,
          user_id: user.user.id,
          debt_id: debt.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form?.id ? "Estado actualizado" : "Estado de cuenta agregado");
      setForm(null);
      invalidateAll();
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate") || e.message.includes("unique")
          ? "Ya existe un estado de cuenta para ese mes."
          : e.message,
      ),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debt_statements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado eliminado");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async ({ statement, pocketId, amount }: { statement: DebtStatementRow; pocketId: string; amount: number }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const pocket = (pockets ?? []).find((p) => p.id === pocketId);
      if (!pocket) throw new Error("Elige el bolsillo de origen.");
      if (Number(pocket.current_balance) < amount) {
        throw new Error(`Saldo insuficiente en ${pocket.name} (${money(Number(pocket.current_balance))}).`);
      }
      // 1) Real money movement: the apply_tx_effects trigger debits the pocket
      //    AND lowers the debt balance atomically for kind='payment'.
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.user.id,
          kind: "payment",
          amount,
          pocket_id: pocketId,
          debt_id: debt.id,
          description: `Pago ${debt.name} · ${periodLabel(statement)}`,
          occurred_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (txError) throw txError;
      // 2) Mark the statement paid, linked to the transaction.
      const { error } = await supabase.from("debt_statements")
        .update({ status: "paid", paid_at: new Date().toISOString(), transaction_id: tx.id })
        .eq("id", statement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago registrado: bolsillo y deuda actualizados");
      setPayingId(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: async (statement: DebtStatementRow) => {
      if (statement.transaction_id) {
        // Deleting the payment reverses pocket + debt via the trigger.
        const { error: txError } = await supabase
          .from("transactions")
          .delete()
          .eq("id", statement.transaction_id);
        if (txError) throw txError;
      }
      const { error } = await supabase.from("debt_statements")
        .update({ status: "pending", paid_at: null, transaction_id: null })
        .eq("id", statement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago revertido");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateNext = (s: DebtStatementRow) => {
    const nextMonth = s.period_month === 12 ? 1 : s.period_month + 1;
    const nextYear = s.period_month === 12 ? s.period_year + 1 : s.period_year;
    setForm({
      id: null,
      period_month: nextMonth,
      period_year: nextYear,
      amount: Number(s.amount),
      due_date: defaultDueDate(debt, nextYear, nextMonth),
      notes: "",
    });
  };

  const openCreate = () => {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    setForm({
      id: null,
      period_month: m,
      period_year: y,
      amount: Number(debt.statement_balance) || 0,
      due_date: defaultDueDate(debt, y, m),
      notes: "",
    });
  };

  const startPay = (s: DebtStatementRow) => {
    setPayingId(s.id);
    setPayAmount(Number(s.amount));
    setPayPocketId("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-guide="debt-statements" size="sm" variant="outline" className="w-full">
          <CalendarRange className="mr-2 h-4 w-4" /> Gestionar pagos mensuales
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estados de cuenta — {debt.name}</DialogTitle>
        </DialogHeader>

        {!form && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Agregar estado de cuenta
          </Button>
        )}

        {form && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{form.id ? "Editar estado" : "Nuevo estado de cuenta"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mes</Label>
                <Select
                  value={String(form.period_month)}
                  onValueChange={(v) => {
                    const m = Number(v);
                    setForm({ ...form, period_month: m, due_date: defaultDueDate(debt, form.period_year, m) });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Año</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.period_year}
                  onChange={(e) => {
                    const y = Math.min(2100, Math.max(2000, Number(e.target.value) || today.getFullYear()));
                    setForm({ ...form, period_year: y, due_date: defaultDueDate(debt, y, form.period_month) });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monto a pagar</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notas</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => upsert.mutate(form)} disabled={upsert.isPending || !form.due_date}>
                {form.id ? "Guardar" : "Agregar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {statements.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground">
            Sin estados de cuenta. Agrega el del mes en curso para llevar el orden mensual de esta tarjeta.
          </p>
        ) : (
          <div className="space-y-2">
            {statements.map((s) => {
              const overdue = s.status === "pending" && new Date(`${s.due_date}T00:00:00`) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <div key={s.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{periodLabel(s)}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            s.status === "paid"
                              ? "bg-primary/15 text-primary"
                              : overdue
                                ? "bg-destructive/15 text-destructive"
                                : "bg-warning/15 text-warning",
                          )}
                        >
                          {s.status === "paid" ? "Pagado" : overdue ? "Vencido" : "Pendiente"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vence {formatDateEs(s.due_date)}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">{money(Number(s.amount))}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => startPay(s)}>
                          <Banknote className="mr-1 h-3.5 w-3.5" /> Pagar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setForm({
                              id: s.id,
                              period_month: s.period_month,
                              period_year: s.period_year,
                              amount: Number(s.amount),
                              due_date: s.due_date,
                              notes: s.notes ?? "",
                            })
                          }
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => del.mutate(s.id)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" /> Eliminar
                        </Button>
                      </>
                    )}
                    {s.status === "paid" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => undo.mutate(s)} disabled={undo.isPending}>
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Deshacer pago
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => duplicateNext(s)}>
                      <CopyPlus className="mr-1 h-3.5 w-3.5" /> Duplicar al mes siguiente
                    </Button>
                  </div>

                  {payingId === s.id && s.status === "pending" && (
                    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <p className="text-xs font-medium">¿De qué bolsillo sale el dinero?</p>
                      <Select value={payPocketId} onValueChange={setPayPocketId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Elige un bolsillo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(pockets ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {money(Number(p.current_balance))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-1.5">
                        <Label>Monto</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={payAmount}
                          onChange={(e) => setPayAmount(Number(e.target.value))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => pay.mutate({ statement: s, pocketId: payPocketId, amount: payAmount })}
                          disabled={pay.isPending || !payPocketId || payAmount <= 0}
                        >
                          Confirmar pago
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPayingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Se registra el movimiento, se descuenta del bolsillo y baja el saldo de la deuda.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
