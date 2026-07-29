import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, counterpartiesQuery, pocketsQuery, debtsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { listStatementCycles, toISODate, cutoffForDate, formatDateEs } from "@/lib/finance";

import { Plus, Trash2, Pencil, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Landmark, Users, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transacciones — Finance Flow Pocket" },
      { name: "description", content: "Registra manualmente cobros, pagos, transferencias e ingresos con contrapartes." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(transactionsQuery());
    context.queryClient.ensureQueryData(counterpartiesQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(debtsQuery());
  },
  component: TransactionsPage,
});

type TxKind = "income" | "expense" | "transfer" | "payment";

type TxRow = {
  id: string;
  occurred_at: string;
  amount: number;
  kind: string;
  counterparty_id: string | null;
  description: string;
  purpose: string | null;
  pocket_id: string | null;
  debt_id: string | null;
  include_in_totals: boolean;
  notes: string | null;
  statement_cutoff: string | null;

};

const KIND_META: Record<string, { label: string; icon: typeof ArrowDownRight; tone: string; sign: string }> = {
  income:   { label: "Ingreso",       icon: ArrowDownRight, tone: "text-primary",     sign: "+" },
  expense:  { label: "Gasto",         icon: ArrowUpRight,   tone: "text-destructive", sign: "−" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, tone: "text-accent",      sign: "↔" },
  payment:  { label: "Pago de deuda", icon: Landmark,       tone: "text-warning",     sign: "−" },
};

function TransactionsPage() {
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const { data: cps } = useSuspenseQuery(counterpartiesQuery());
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const { data: debts } = useSuspenseQuery(debtsQuery());
  const qc = useQueryClient();

  const cpMap = useMemo(() => Object.fromEntries(cps.map((c) => [c.id, c])), [cps]);
  const pocketMap = useMemo(() => Object.fromEntries(pockets.map((p) => [p.id, p])), [pockets]);
  const debtMap = useMemo(() => Object.fromEntries(debts.map((d) => [d.id, d])), [debts]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["pockets"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });


  const counted = txs.filter((t) => t.include_in_totals);
  const income = counted.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = counted.filter((t) => t.kind === "expense" || t.kind === "payment").reduce((s, t) => s + Number(t.amount), 0);
  const net = income - expense;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Transacciones</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos <span className="text-primary">{money(income)}</span> · Gastos{" "}
            <span className="text-destructive">{money(expense)}</span> · Neto{" "}
            <span className={net >= 0 ? "text-primary" : "text-destructive"}>{money(net)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <CounterpartiesDialog />
          <TxDialog mode="create" pockets={pockets} debts={debts} counterparties={cps} />
        </div>
      </div>

      {txs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aún no hay transacciones. Registra tu primer movimiento arriba.
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {txs.map((t) => {
            const meta = KIND_META[t.kind] ?? KIND_META.expense;
            const Icon = meta.icon;
            const cp = t.counterparty_id ? cpMap[t.counterparty_id] : null;
            const source = t.pocket_id ? pocketMap[t.pocket_id]?.name : t.debt_id ? debtMap[t.debt_id]?.name : null;
            return (
              <div key={t.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 bg-muted ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{t.description || meta.label}</span>
                      {!t.include_in_totals && (
                        <span className="text-[10px] flex items-center gap-1 text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          <EyeOff className="h-2.5 w-2.5" /> No cuenta
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {new Date(t.occurred_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      {cp && ` · ${cp.name}`}
                      {source && ` · ${source}`}
                      {t.purpose && ` · ${t.purpose}`}
                    </div>
                    {t.notes && <div className="text-xs text-muted-foreground italic mt-1 truncate">{t.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className={`font-semibold whitespace-nowrap ${meta.tone}`}>
                    {meta.sign}
                    {money(t.amount)}
                  </div>
                  <TxDialog mode="edit" tx={t as TxRow} pockets={pockets} debts={debts} counterparties={cps} />
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}>
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

function TxDialog({
  mode,
  tx,
  pockets,
  debts,
  counterparties,
}: {
  mode: "create" | "edit";
  tx?: TxRow;
  pockets: { id: string; name: string }[];
  debts: { id: string; name: string; cutoff_day?: number | null; due_day?: number | null }[];
  counterparties: { id: string; name: string; kind: string }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    occurred_at: tx?.occurred_at ? tx.occurred_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    amount: Number(tx?.amount ?? 0),
    kind: (tx?.kind ?? "expense") as TxKind,
    counterparty_id: tx?.counterparty_id ?? "",
    counterparty_new: "",
    description: tx?.description ?? "",
    purpose: tx?.purpose ?? "",
    pocket_id: tx?.pocket_id ?? "",
    debt_id: tx?.debt_id ?? "",
    statement_cutoff: tx?.statement_cutoff ?? "",
    include_in_totals: tx?.include_in_totals ?? true,
    notes: tx?.notes ?? "",
  });

  const selectedDebt = debts.find((d) => d.id === form.debt_id);
  const statementOptions = useMemo(() => {
    if (!selectedDebt?.cutoff_day || !selectedDebt?.due_day) return [];
    return listStatementCycles(selectedDebt.cutoff_day, selectedDebt.due_day, { back: 3, forward: 1 })
      .slice()
      .reverse();
  }, [selectedDebt?.cutoff_day, selectedDebt?.due_day]);

  /** Statement the transaction date falls into, used when the user leaves it automatic. */
  const autoStatement = selectedDebt?.cutoff_day
    ? toISODate(cutoffForDate(selectedDebt.cutoff_day, new Date(form.occurred_at)))
    : "";


  const save = useMutation({
    mutationFn: async () => {
      const { data: userWrap } = await supabase.auth.getUser();
      if (!userWrap.user) throw new Error("No auth");
      const uid = userWrap.user.id;

      let counterparty_id: string | null = form.counterparty_id || null;
      const newName = form.counterparty_new.trim();
      if (newName) {
        const { data, error } = await supabase
          .from("counterparties")
          .upsert({ user_id: uid, name: newName, kind: "person" }, { onConflict: "user_id,name" })
          .select("id")
          .single();
        if (error) throw error;
        counterparty_id = data.id;
      }

      const payload = {
        occurred_at: new Date(form.occurred_at).toISOString(),
        amount: form.amount,
        kind: form.kind,
        counterparty_id,
        description: form.description,
        purpose: form.purpose || null,
        pocket_id: form.pocket_id || null,
        debt_id: form.debt_id || null,
        statement_cutoff: form.debt_id ? form.statement_cutoff || autoStatement || null : null,

        include_in_totals: form.include_in_totals,
        notes: form.notes || null,
      };
      if (mode === "edit" && tx) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", tx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({ user_id: uid, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Transacción actualizada" : "Transacción registrada");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      // Balances are adjusted server-side by the transaction trigger.
      qc.invalidateQueries({ queryKey: ["pockets"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
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
          <Button><Plus className="h-4 w-4 mr-1" /> Registrar</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar transacción" : "Nueva transacción"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as TxKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="payment">Pago de deuda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Renta enero, gasolina Pemex..." />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Propósito / categoría</Label>
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Ej. Comida, servicios, viajes, ahorro..." />
            </div>
            <div className="space-y-2">
              <Label>Contraparte existente</Label>
              <Select value={form.counterparty_id || "__none"} onValueChange={(v) => setForm({ ...form, counterparty_id: v === "__none" ? "" : v, counterparty_new: "" })}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Ninguna</SelectItem>
                  {counterparties.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>… o nueva</Label>
              <Input value={form.counterparty_new} onChange={(e) => setForm({ ...form, counterparty_new: e.target.value, counterparty_id: "" })} placeholder="Nombre persona o tienda" />
            </div>
            <div className="space-y-2">
              <Label>Bolsillo</Label>
              <Select value={form.pocket_id || "__none"} onValueChange={(v) => setForm({ ...form, pocket_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Ninguno</SelectItem>
                  {pockets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deuda / tarjeta</Label>
              <Select
                value={form.debt_id || "__none"}
                onValueChange={(v) => setForm({ ...form, debt_id: v === "__none" ? "" : v, statement_cutoff: "" })}
              >
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Ninguna</SelectItem>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {statementOptions.length > 0 && (
              <div className="space-y-2 col-span-2">
                <Label>Estado de cuenta (mes de la deuda)</Label>
                <Select
                  value={form.statement_cutoff || autoStatement || "__auto"}
                  onValueChange={(v) => setForm({ ...form, statement_cutoff: v === "__auto" ? "" : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto">Automático (según la fecha)</SelectItem>
                    {statementOptions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.monthLabel} — corte {formatDateEs(c.cutoff)} · paga {formatDateEs(c.due)}
                        {c.status === "open" ? " (actual)" : c.status === "closed" ? " (cerrado)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define a qué corte se acumula este monto, aunque lo registres otro día.
                </p>
              </div>
            )}

            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label>Contar en totales</Label>
                <p className="text-xs text-muted-foreground">Si lo apagas, no afecta los resúmenes.</p>
              </div>
              <Switch checked={form.include_in_totals} onCheckedChange={(v) => setForm({ ...form, include_in_totals: v })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={form.amount === 0 || save.isPending}>
            {mode === "edit" ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CounterpartiesDialog() {
  const qc = useQueryClient();
  const { data: cps } = useSuspenseQuery(counterpartiesQuery());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"person" | "store" | "company">("person");

  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase.from("counterparties").insert({ user_id: user.user.id, name, kind });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contraparte creada");
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("counterparties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["counterparties"] }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Users className="h-4 w-4 mr-1" /> Contrapartes</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personas y comercios</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_140px_auto] gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="person">Persona</SelectItem>
              <SelectItem value="store">Comercio</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Agregar</Button>
        </div>
        {cps.length > 0 && (
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {cps.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.kind}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
