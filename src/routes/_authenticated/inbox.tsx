import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  detectedTransactionsQuery,
  pocketsQuery,
  counterpartiesQuery,
  debtsQuery,
  detectionRulesQuery,
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
import { appLabelFor, appEmojiFor } from "@/lib/detection/apps";
import {
  matchRule,
  normalizeKey,
  buildTransactionInsert,
  RULE_MODE_LABEL,
  type DetectionRule,
  type RuleMode,
} from "@/lib/detection/rules";
import {
  Check,
  X,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Inbox as InboxIcon,
  CreditCard,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Asistente de movimientos — Finance Flow Pocket" },
      {
        name: "description",
        content:
          "Asigna con un toque cada movimiento detectado a su bolsillo o tarjeta, y deja que el asistente recuerde tus decisiones.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(detectedTransactionsQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(counterpartiesQuery());
    context.queryClient.ensureQueryData(debtsQuery());
    context.queryClient.ensureQueryData(detectionRulesQuery());
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
  occurred_at?: string | null;
  sender_name?: string | null;
  account_hint?: string | null;
  is_self_transfer?: boolean | null;
  direction?: string | null;
  confidence?: number | null;
  status: string;

};

type Pocket = { id: string; name: string };
type Debt = { id: string; name: string; debt_type?: string | null };

const TYPE_META: Record<string, { label: string; icon: typeof ArrowDownRight; kind: string }> = {
  charge: { label: "Gasto", icon: ArrowDownRight, kind: "expense" },
  credit: { label: "Ingreso", icon: ArrowUpRight, kind: "income" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, kind: "transfer" },
  payment: { label: "Pago", icon: CreditCard, kind: "payment" },
  unknown: { label: "Movimiento", icon: InboxIcon, kind: "expense" },
};

type RememberState = {
  detected: Detected;
  kind: string;
  pocketId: string | null;
  debtId: string | null;
  label: string;
} | null;

function InboxPage() {
  const detected = useSuspenseQuery(detectedTransactionsQuery());
  const pockets = useSuspenseQuery(pocketsQuery());
  const counterparties = useSuspenseQuery(counterpartiesQuery());
  const debts = useSuspenseQuery(debtsQuery());
  const rules = useSuspenseQuery(detectionRulesQuery());
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Detected | null>(null);
  const [remember, setRemember] = useState<RememberState>(null);

  const pending = (detected.data ?? []).filter((d: Detected) => d.status === "pending");
  const history = (detected.data ?? []).filter((d: Detected) => d.status !== "pending").slice(0, 20);
  const cards: Debt[] = (debts.data ?? []).filter((d: Debt) => (d.debt_type ?? "card") === "card");

  const pocketName = (id: string | null) =>
    pockets.data?.find((p: Pocket) => p.id === id)?.name ?? "bolsillo";
  const cardName = (id: string | null) =>
    debts.data?.find((d: Debt) => d.id === id)?.name ?? "tarjeta";
  const ruleFor = (d: Detected): DetectionRule | null =>
    matchRule({ merchant: d.merchant, package_name: d.package_name }, rules.data ?? []);

  const invalidateBalances = () => {
    qc.invalidateQueries({ queryKey: ["detected_transactions"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["pockets"] });
    qc.invalidateQueries({ queryKey: ["debts"] });
  };

  const undo = async (txId: string, detectedId: string) => {
    await supabase.from("transactions").delete().eq("id", txId);
    await supabase
      .from("detected_transactions")
      .update({ status: "pending", approved_transaction_id: null })
      .eq("id", detectedId);
    invalidateBalances();
    toast("Movimiento deshecho");
  };

  const assign = useMutation({
    mutationFn: async (args: {
      detected: Detected;
      kind: string;
      pocketId: string | null;
      debtId: string | null;
    }) => {
      const { detected: d, kind, pocketId, debtId } = args;
      if (d.amount == null || d.amount <= 0) throw new Error("Sin monto: usa Más detalles");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const insert = buildTransactionInsert(user.id, {
        kind,
        amount: d.amount,
        description: d.merchant || appLabelFor(d.package_name),
        notes: d.raw_text,
        occurredAt: new Date(d.detected_at).toISOString(),
        pocketId,
        debtId,
        counterpartyId: null,
      });
      const { data: tx, error } = await supabase
        .from("transactions")
        .insert(insert)
        .select("id")
        .single();
      if (error) throw error;
      const { error: updErr } = await supabase
        .from("detected_transactions")
        .update({ status: "approved", approved_transaction_id: tx.id })
        .eq("id", d.id);
      if (updErr) throw updErr;
      return { txId: tx.id, ...args };
    },
    onSuccess: (res) => {
      invalidateBalances();
      const label = res.pocketId ? pocketName(res.pocketId) : cardName(res.debtId);
      toast.success(`Registrado en ${label}`, {
        action: { label: "Deshacer", onClick: () => void undo(res.txId, res.detected.id) },
      });
      if (!ruleFor(res.detected)) {
        setRemember({
          detected: res.detected,
          kind: res.kind,
          pocketId: res.pocketId,
          debtId: res.debtId,
          label,
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

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

  const saveRule = useMutation({
    mutationFn: async (args: { state: NonNullable<RememberState>; mode: RuleMode }) => {
      const { state, mode } = args;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const scope = state.detected.merchant ? "merchant" : "package";
      const value = normalizeKey(state.detected.merchant ?? state.detected.package_name);
      const row = {
        user_id: user.id,
        match_scope: scope,
        match_value: value,
        kind: state.kind,
        pocket_id: state.pocketId,
        debt_id: state.debtId,
        counterparty_id: null,
        mode,
        updated_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("detection_rules" as any) as any).upsert(row, {
        onConflict: "user_id,match_scope,match_value",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detection_rules"] });
      toast.success("Regla guardada");
      setRemember(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" /> Asistente de movimientos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada movimiento que detecto en tus apps aparece aquí. Toca el bolsillo o la tarjeta a la
          que pertenece y lo registro al instante. Puedo recordar tus decisiones para la próxima.
        </p>
      </header>

      {remember && (
        <Card className="p-4 bg-primary/5 border-primary/30 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              ¿Recuerdo <strong>{remember.detected.merchant ?? appLabelFor(remember.detected.package_name)}</strong>{" "}
              → <strong>{remember.label}</strong> para la próxima?
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["auto", "confirm", "ask"] as RuleMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant="outline"
                disabled={saveRule.isPending}
                onClick={() => saveRule.mutate({ state: remember, mode: m })}
              >
                {RULE_MODE_LABEL[m]}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setRemember(null)}>
              Ahora no
            </Button>
          </div>
        </Card>
      )}

      <section data-guide="inbox-pendientes" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Por asignar ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm bg-card/70 backdrop-blur">
            Todo al día. Cuando recibas una notificación de tus apps de banco, aparecerá aquí para
            asignarla con un toque.
          </Card>
        ) : (
          pending.map((d: Detected, i: number) => (
            <DetectionBubble
              key={d.id}
              detected={d}
              pockets={pockets.data ?? []}
              cards={cards}
              suggestion={ruleFor(d)}
              pocketName={pocketName}
              guide={i === 0}
              onAssign={(kind, pocketId, debtId) =>
                assign.mutate({ detected: d, kind, pocketId, debtId })
              }
              onDetails={() => setEditing(d)}
              onReject={() => reject.mutate(d.id)}
              busy={assign.isPending || reject.isPending}
            />
          ))
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
                <span className={d.status === "approved" ? "text-emerald-400" : "text-muted-foreground"}>
                  {d.status === "approved" ? "✓" : "✕"}
                </span>{" "}
                {d.merchant ?? appLabelFor(d.package_name)}
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

function DetectionBubble({
  detected: d,
  pockets,
  cards,
  suggestion,
  pocketName,
  guide,
  onAssign,
  onDetails,
  onReject,
  busy,
}: {
  detected: Detected;
  pockets: Pocket[];
  cards: Debt[];
  suggestion: DetectionRule | null;
  pocketName: (id: string | null) => string;
  guide: boolean;
  onAssign: (kind: string, pocketId: string | null, debtId: string | null) => void;
  onDetails: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const meta = TYPE_META[d.type] ?? TYPE_META.unknown;
  const Icon = meta.icon;
  const isIncome = d.type === "credit";
  const kind = isIncome ? "income" : "expense";
  const hasAmount = d.amount != null && d.amount > 0;
  const source = d.merchant ?? appLabelFor(d.package_name);

  return (
    <Card className="p-4 bg-card/70 backdrop-blur space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {appEmojiFor(d.package_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {meta.label} · {appLabelFor(d.package_name)} ·{" "}
            {new Date(d.occurred_at ?? d.detected_at).toLocaleString("es-MX")}
          </div>
          <p className="mt-1 text-sm">
            {hasAmount ? (
              <>
                Detecté un <strong>{meta.label.toLowerCase()}</strong> de{" "}
                <strong>{money(d.amount!)}</strong>
                {d.sender_name ? (
                  <>
                    {" "}
                    de <strong>{d.sender_name}</strong>
                  </>
                ) : d.merchant ? (
                  <>
                    {" "}
                    en <strong>{d.merchant}</strong>
                  </>
                ) : null}
                {d.account_hint ? (
                  <>
                    {" "}
                    hacia <strong>{d.account_hint}</strong>
                  </>
                ) : null}
                . {isIncome ? "¿A qué bolsillo entró?" : "¿De dónde salió?"}
              </>
            ) : (
              <>
                Detecté un movimiento en <strong>{source}</strong> pero no pude leer el monto. Toca{" "}
                <em>Más detalles</em> para capturarlo.
              </>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {d.is_self_transfer && (
              <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px]">
                Entre tus cuentas
              </span>
            )}
            {d.confidence != null && d.confidence < 0.5 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Baja certeza · revisa
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-1">{d.raw_text}</p>

        </div>
      </div>

      {hasAmount && (
        <div data-guide={guide ? "asistente-chips" : undefined} className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestion?.pocket_id && (
              <Chip
                highlighted
                disabled={busy}
                onClick={() => onAssign(suggestion.kind || kind, suggestion.pocket_id, suggestion.debt_id)}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {pocketName(suggestion.pocket_id)}
              </Chip>
            )}
            {pockets.map((p) => (
              <Chip key={p.id} disabled={busy} onClick={() => onAssign(kind, p.id, null)}>
                {p.name}
              </Chip>
            ))}
          </div>
          {!isIncome && cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">o cargo a tarjeta:</span>
              {cards.map((c) => (
                <Chip key={c.id} disabled={busy} onClick={() => onAssign("expense", null, c.id)}>
                  <CreditCard className="h-3 w-3 mr-1" />
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onDetails} disabled={busy}>
          <Check className="h-4 w-4 mr-1" /> Más detalles
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReject} disabled={busy}>
          <X className="h-4 w-4 mr-1" /> Ignorar
        </Button>
      </div>
    </Card>
  );
}

function Chip({
  children,
  onClick,
  disabled,
  highlighted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 " +
        (highlighted
          ? "border-primary bg-primary/15 text-primary hover:bg-primary/25"
          : "border-border bg-background hover:bg-accent/30")
      }
    >
      {children}
    </button>
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
  const [occurredAt, setOccurredAt] = useState(detected.detected_at.slice(0, 16));

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
      qc.invalidateQueries({ queryKey: ["pockets"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Movimiento guardado");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalles del movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
          {(kind === "payment" || kind === "expense") && (
            <div>
              <Label>{kind === "payment" ? "Deuda a pagar" : "Tarjeta / deuda (opcional)"}</Label>
              <Select value={debtId} onValueChange={setDebtId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {debts.map((dd) => (
                    <SelectItem key={dd.id} value={dd.id}>
                      {dd.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Fecha</Label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
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
