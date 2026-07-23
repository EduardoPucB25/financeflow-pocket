import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  detectedTransactionsQuery,
  pocketsQuery,
  counterpartiesQuery,
  debtsQuery,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { Check, X, Inbox as InboxIcon, ArrowDownRight, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Bandeja de detección — Finance Flow Pocket" },
      {
        name: "description",
        content:
          "Revisa y aprueba las transacciones detectadas automáticamente desde las notificaciones bancarias en Android.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(detectedTransactionsQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(counterpartiesQuery());
    context.queryClient.ensureQueryData(debtsQuery());
  },
  component: InboxPage,
});

type Detected = {
  id: string;
  amount: number | null;
  currency: string;
  merchant: string | null;
  type: string;
  raw_text: string;
  notification_title: string | null;
  package_name: string;
  detected_at: string;
  status: string;
};

const TYPE_META: Record<string, { label: string; icon: typeof ArrowDownRight; kind: string }> = {
  charge: { label: "Cargo", icon: ArrowDownRight, kind: "expense" },
  credit: { label: "Abono", icon: ArrowUpRight, kind: "income" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, kind: "transfer" },
  payment: { label: "Pago", icon: ArrowDownRight, kind: "payment" },
  unknown: { label: "Sin clasificar", icon: InboxIcon, kind: "expense" },
};

function InboxPage() {
  const detected = useSuspenseQuery(detectedTransactionsQuery());
  const pockets = useSuspenseQuery(pocketsQuery());
  const counterparties = useSuspenseQuery(counterpartiesQuery());
  const debts = useSuspenseQuery(debtsQuery());
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Detected | null>(null);

  const pending = (detected.data ?? []).filter((d: Detected) => d.status === "pending");
  const history = (detected.data ?? []).filter((d: Detected) => d.status !== "pending").slice(0, 20);

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("detected_transactions")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detected_transactions"] });
      toast.success("Descartada");
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <InboxIcon className="h-6 w-6 text-primary" /> Bandeja de detección
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notificaciones bancarias capturadas automáticamente. Aprueba para guardarlas como
          movimientos o descarta las que no correspondan.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm bg-card/70 backdrop-blur">
            No hay detecciones pendientes. Cuando recibas una notificación de tu banco en el
            teléfono, aparecerá aquí para confirmar.
          </Card>
        ) : (
          pending.map((d: Detected) => {
            const meta = TYPE_META[d.type] ?? TYPE_META.unknown;
            const Icon = meta.icon;
            return (
              <Card key={d.id} className="p-4 bg-card/70 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label} · {new Date(d.detected_at).toLocaleString("es-MX")}
                    </div>
                    <div className="mt-1 font-semibold text-lg">
                      {d.amount != null ? money(d.amount) : "—"}
                      {d.merchant && (
                        <span className="ml-2 text-base font-normal text-muted-foreground">
                          {d.merchant}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {d.raw_text}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">
                      {d.package_name}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => setEditing(d)}>
                      <Check className="h-4 w-4 mr-1" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reject.mutate(d.id)}
                      disabled={reject.isPending}
                    >
                      <X className="h-4 w-4 mr-1" /> Descartar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Historial reciente
          </h2>
          {history.map((d: Detected) => (
            <div
              key={d.id}
              className="flex items-center justify-between text-sm py-2 border-b border-border/40"
            >
              <div className="min-w-0 flex-1 truncate">
                <span
                  className={
                    d.status === "approved" ? "text-emerald-400" : "text-muted-foreground"
                  }
                >
                  {d.status === "approved" ? "✓" : "✕"}
                </span>{" "}
                {d.merchant ?? d.raw_text.slice(0, 60)}
              </div>
              <div className="text-muted-foreground text-xs">
                {d.amount != null ? money(d.amount) : "—"}
              </div>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <ApproveDialog
          detected={editing}
          pockets={pockets.data ?? []}
          counterparties={counterparties.data ?? []}
          debts={debts.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ApproveDialog({
  detected,
  pockets,
  counterparties,
  debts,
  onClose,
}: {
  detected: Detected;
  pockets: Array<{ id: string; name: string }>;
  counterparties: Array<{ id: string; name: string }>;
  debts: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const meta = TYPE_META[detected.type] ?? TYPE_META.unknown;
  const [amount, setAmount] = useState(detected.amount?.toString() ?? "");
  const [kind, setKind] = useState<string>(meta.kind);
  const [description, setDescription] = useState(detected.merchant ?? "");
  const [notes, setNotes] = useState(detected.raw_text);
  const [pocketId, setPocketId] = useState<string>("none");
  const [counterpartyId, setCounterpartyId] = useState<string>("none");
  const [debtId, setDebtId] = useState<string>("none");
  const [occurredAt, setOccurredAt] = useState(
    detected.detected_at.slice(0, 16),
  );

  const approve = useMutation({
    mutationFn: async () => {
      const num = parseFloat(amount);
      if (!Number.isFinite(num) || num <= 0) throw new Error("Monto inválido");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          amount: num,
          kind,
          description: description || meta.label,
          notes,
          occurred_at: new Date(occurredAt).toISOString(),
          pocket_id: pocketId === "none" ? null : pocketId,
          counterparty_id: counterpartyId === "none" ? null : counterpartyId,
          debt_id: debtId === "none" ? null : debtId,
          include_in_totals: true,
        })
        .select()
        .single();
      if (txErr) throw txErr;
      const { error: updErr } = await supabase
        .from("detected_transactions")
        .update({ status: "approved", approved_transaction_id: tx.id })
        .eq("id", detected.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detected_transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Movimiento guardado");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprobar detección</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="payment">Pago de deuda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bolsillo</Label>
              <Select value={pocketId} onValueChange={setPocketId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin bolsillo</SelectItem>
                  {pockets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contraparte</Label>
              <Select value={counterpartyId} onValueChange={setCounterpartyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin contraparte</SelectItem>
                  {counterparties.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {kind === "payment" && (
            <div>
              <Label>Deuda asociada</Label>
              <Select value={debtId} onValueChange={setDebtId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Fecha</Label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Notas (texto de la notificación)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
            <Check className="h-4 w-4 mr-1" /> Guardar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
