import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { pocketsQuery, profileQuery, subscriptionQuery, transactionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { money, pct } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Lock, Pencil, Crown, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deriveSubStatus } from "@/lib/subscription";
import { accruedYield, periodSpend, limitStatus, YIELD_DISCLAIMER, type SpendTx, type LimitStatus } from "@/lib/finance";
import { POCKET_ACCESS, POCKET_PURPOSE, type PocketLike } from "@/lib/netWorth";

export const Route = createFileRoute("/_authenticated/pockets")({
  head: () => ({
    meta: [
      { title: "Bolsillos — Finance Flow Pocket" },
      { name: "description", content: "Divide tu dinero en bolsillos con función, accesibilidad, presupuesto y rendimientos." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(profileQuery());
    context.queryClient.ensureQueryData(transactionsQuery());
  },
  component: PocketsPage,
});

type PocketRow = PocketLike & {
  target_percentage: number | string;
  is_locked_savings: boolean;
  spend_limit_daily: number | null;
  spend_limit_weekly: number | null;
  spend_limit_monthly: number | null;
};

function PocketsPage() {
  const { data: pocketsData } = useSuspenseQuery(pocketsQuery());
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: txs } = useSuspenseQuery(transactionsQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const pockets = pocketsData as unknown as PocketRow[];
  const spendTxs = txs as unknown as SpendTx[];
  const salary = Number(profile?.biweekly_salary ?? 0);
  const defaultRate = Number(profile?.annual_yield_rate ?? 15);
  const totalPct = pockets.reduce((s, p) => s + Number(p.target_percentage), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pockets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pockets"] }),
  });

  const available = pockets.filter((p) => p.accessibility === "available");
  const restricted = pockets.filter((p) => p.accessibility !== "available");

  const yieldPockets = pockets.filter((p) => p.earns_yield);
  const totalEarned = yieldPockets.reduce((s, p) => {
    const a = accruedYield(
      Number(p.yield_base_balance ?? p.current_balance),
      Number(p.yield_rate ?? defaultRate),
      p.yield_start_date,
    );
    return s + a.earned;
  }, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div data-guide="pockets-resumen">
          <h1 className="text-2xl md:text-3xl font-bold">Bolsillos</h1>
          <p className="text-sm text-muted-foreground">
            Total asignado: <span className={totalPct === 100 ? "text-primary" : "text-warning"}>{pct(totalPct)}</span>
            {" · "}Disponible para gastar:{" "}
            <span className="text-accent">{money(available.reduce((s, p) => s + Number(p.current_balance), 0))}</span>
            {yieldPockets.length > 0 && (
              <>
                {" · "}Rendimiento acumulado: <span className="text-primary">{money(totalEarned)}</span>
              </>
            )}
          </p>
        </div>
        <div data-guide="nuevo-bolsillo">
          <NewPocketDialog isPro={isPro} pocketsCount={pockets.length} />
        </div>
      </div>

      {!isPro && pockets.length >= 2 && (
        <div className="rounded-xl border border-border/60 bg-primary/5 p-4 text-sm">
          <div className="font-medium flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Límite alcanzado en plan gratuito
          </div>
          <p className="text-muted-foreground mt-1">
            El plan gratuito permite hasta 2 bolsillos. Sube a Pro para crear bolsillos ilimitados.
          </p>
          <Button asChild className="mt-3" size="sm">
            <Link to="/upgrade">Ver planes Pro</Link>
          </Button>
        </div>
      )}

      <div data-guide="pockets-list">
      <Section
        title="Disponibles para gastar"
        description="Puedes usar este dinero en cualquier momento."
        pockets={available}
        salary={salary}
        defaultRate={defaultRate}
        txs={spendTxs}
        onDelete={(id) => del.mutate(id)}
      />
      </div>
      <Section
        title="Restringidos y bloqueados"
        description="Reservados para ahorro, inversión o emergencias."
        pockets={restricted}
        salary={salary}
        defaultRate={defaultRate}
        txs={spendTxs}
        onDelete={(id) => del.mutate(id)}
      />

      <p className="text-xs text-muted-foreground">{YIELD_DISCLAIMER}</p>
    </div>
  );
}

function Section({
  title,
  description,
  pockets,
  salary,
  defaultRate,
  txs,
  onDelete,
}: {
  title: string;
  description: string;
  pockets: PocketRow[];
  salary: number;
  defaultRate: number;
  txs: SpendTx[];
  onDelete: (id: string) => void;
}) {
  if (pockets.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pockets.map((p) => (
          <PocketCard
            key={p.id}
            pocket={p}
            salary={salary}
            defaultRate={defaultRate}
            txs={txs}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PocketCard({
  pocket: p,
  salary,
  defaultRate,
  txs,
  onDelete,
}: {
  pocket: PocketRow;
  salary: number;
  defaultRate: number;
  txs: SpendTx[];
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const target = (salary * Number(p.target_percentage)) / 100;
  const rate = Number(p.yield_rate ?? defaultRate);
  const accrual = p.earns_yield
    ? accruedYield(Number(p.yield_base_balance ?? p.current_balance), rate, p.yield_start_date)
    : null;

  const limits = useMemo(() => {
    const rows: LimitStatus[] = [];
    const cfg: [("daily" | "weekly" | "monthly"), number | null][] = [
      ["daily", p.spend_limit_daily],
      ["weekly", p.spend_limit_weekly],
      ["monthly", p.spend_limit_monthly],
    ];
    for (const [period, limit] of cfg) {
      const value = Number(limit ?? 0);
      if (value <= 0) continue;
      rows.push(limitStatus(period, value, periodSpend(txs, period, { pocketId: p.id })));
    }
    return rows;
  }, [txs, p.id, p.spend_limit_daily, p.spend_limit_weekly, p.spend_limit_monthly]);

  const worst = limits.find((l) => l.level === "over") ?? limits.find((l) => l.level === "warn");

  const applyYield = useMutation({
    mutationFn: async (reset: boolean) => {
      const { error } = await supabase
        .from("pockets")
        .update({
          earns_yield: true,
          yield_start_date: new Date().toISOString().slice(0, 10),
          yield_base_balance: Number(p.current_balance),
          ...(reset ? {} : {}),
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, reset) => {
      toast.success(reset ? "Base de rendimiento reiniciada" : "Rendimiento aplicado desde hoy");
      qc.invalidateQueries({ queryKey: ["pockets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-1 truncate">
              {p.name}
              {p.accessibility === "locked" && <Lock className="h-3 w-3 text-warning shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {pct(p.target_percentage as number)} · {money(target)}/quincena
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <EditPocketDialog pocket={p} defaultRate={defaultRate} />
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tag>{POCKET_PURPOSE[p.purpose] ?? p.purpose}</Tag>
        <Tag tone={p.accessibility === "available" ? "primary" : "muted"}>
          {POCKET_ACCESS[p.accessibility] ?? p.accessibility}
        </Tag>
        {p.earns_yield && <Tag tone="accent">Rendimiento {pct(rate)}</Tag>}
      </div>

      <div>
        <div className="text-2xl font-bold">{money(p.current_balance as number)}</div>
        <p className="text-xs text-muted-foreground">
          El saldo se ajusta solo con tus movimientos.
        </p>
      </div>

      {accrual && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Valor con rendimiento
            </span>
            <span className="text-xs text-muted-foreground">{accrual.days}d</span>
          </div>
          <div className="text-lg font-bold text-primary">{money(accrual.current)}</div>
          <div className="text-xs text-muted-foreground">
            Base {money(accrual.base)} · ganado {money(accrual.earned)}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => applyYield.mutate(true)}
            disabled={applyYield.isPending}
          >
            Reiniciar base con el saldo actual
          </Button>
        </div>
      )}

      {!p.earns_yield && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => applyYield.mutate(false)}
          disabled={applyYield.isPending}
        >
          <Sparkles className="h-4 w-4 mr-1" /> Aplicar rendimiento
        </Button>
      )}

      {limits.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium">Presupuesto</div>
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
                worst.level === "over" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {worst.level === "over"
                  ? `Te pasaste ${money(-worst.remaining)} de lo planeado.`
                  : `Vas al ${Math.round(worst.ratio * 100)}% de tu presupuesto.`}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "accent" }) {
  const cls =
    tone === "primary"
      ? "border-primary/40 text-primary"
      : tone === "accent"
        ? "border-accent/40 text-accent"
        : "border-border text-muted-foreground";
  return <span className={`text-[10px] rounded px-1.5 py-0.5 border ${cls}`}>{children}</span>;
}

function NewPocketDialog({ isPro, pocketsCount }: { isPro: boolean; pocketsCount: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    target_percentage: 10,
    color: "#10B981",
    purpose: "spending",
    accessibility: "available",
  });

  const locked = !isPro && pocketsCount >= 2;

  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase.from("pockets").insert({
        user_id: user.user.id,
        name: form.name,
        target_percentage: form.target_percentage,
        color: form.color,
        purpose: form.purpose,
        accessibility: form.accessibility,
        is_locked_savings: form.accessibility === "locked",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bolsillo creado");
      qc.invalidateQueries({ queryKey: ["pockets"] });
      setOpen(false);
      setForm({ ...form, name: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {locked ? (
        <Button asChild>
          <Link to="/upgrade">
            <Crown className="h-4 w-4 mr-1" /> Sube a Pro
          </Link>
        </Button>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Nuevo bolsillo
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo bolsillo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Viajes 10%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>% Meta</Label>
              <Input type="number" value={form.target_percentage} onChange={(e) => setForm({ ...form, target_percentage: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Función</Label>
              <PurposeSelect value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} />
            </div>
            <div className="space-y-2">
              <Label>Accesibilidad</Label>
              <AccessSelect value={form.accessibility} onChange={(v) => setForm({ ...form, accessibility: v })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurposeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="spending">Gasto</SelectItem>
        <SelectItem value="savings">Ahorro</SelectItem>
        <SelectItem value="investment">Inversión</SelectItem>
        <SelectItem value="reserve">Reserva</SelectItem>
      </SelectContent>
    </Select>
  );
}

function AccessSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="available">Disponible</SelectItem>
        <SelectItem value="restricted">Restringido</SelectItem>
        <SelectItem value="locked">Bloqueado</SelectItem>
      </SelectContent>
    </Select>
  );
}

function pocketForm(p: PocketRow, defaultRate: number) {
  return {
    name: p.name,
    target_percentage: Number(p.target_percentage),
    color: p.color,
    purpose: p.purpose,
    accessibility: p.accessibility,
    earns_yield: p.earns_yield,
    yield_rate: Number(p.yield_rate ?? defaultRate),
    yield_start_date: p.yield_start_date ?? new Date().toISOString().slice(0, 10),
    yield_base_balance: Number(p.yield_base_balance ?? p.current_balance),
    spend_limit_daily: Number(p.spend_limit_daily ?? 0),
    spend_limit_weekly: Number(p.spend_limit_weekly ?? 0),
    spend_limit_monthly: Number(p.spend_limit_monthly ?? 0),
  };
}

function EditPocketDialog({ pocket, defaultRate }: { pocket: PocketRow; defaultRate: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => pocketForm(pocket, defaultRate));

  // Always reopen with the values currently stored.
  useEffect(() => {
    if (open) setForm(pocketForm(pocket, defaultRate));
  }, [open, pocket, defaultRate]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pockets")
        .update({
          name: form.name,
          target_percentage: form.target_percentage,
          color: form.color,
          purpose: form.purpose,
          accessibility: form.accessibility,
          is_locked_savings: form.accessibility === "locked",
          earns_yield: form.earns_yield,
          yield_rate: form.yield_rate,
          yield_start_date: form.earns_yield ? form.yield_start_date : null,
          yield_base_balance: form.earns_yield ? form.yield_base_balance : null,
          spend_limit_daily: form.spend_limit_daily > 0 ? form.spend_limit_daily : null,
          spend_limit_weekly: form.spend_limit_weekly > 0 ? form.spend_limit_weekly : null,
          spend_limit_monthly: form.spend_limit_monthly > 0 ? form.spend_limit_monthly : null,
        })
        .eq("id", pocket.id);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Función</Label>
              <PurposeSelect value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} />
            </div>
            <div className="space-y-2">
              <Label>Accesibilidad</Label>
              <AccessSelect value={form.accessibility} onChange={(v) => setForm({ ...form, accessibility: v })} />
            </div>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Cuenta para rendimientos</Label>
                <p className="text-xs text-muted-foreground">{YIELD_DISCLAIMER}</p>
              </div>
              <Switch checked={form.earns_yield} onCheckedChange={(v) => setForm({ ...form, earns_yield: v })} />
            </div>
            {form.earns_yield && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tasa anual (%)</Label>
                  <Input type="number" step="0.01" value={form.yield_rate} onChange={(e) => setForm({ ...form, yield_rate: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input type="date" value={form.yield_start_date} onChange={(e) => setForm({ ...form, yield_start_date: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Monto base</Label>
                  <Input type="number" step="0.01" value={form.yield_base_balance} onChange={(e) => setForm({ ...form, yield_base_balance: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <Label>Límites de gasto (0 = sin límite)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Diario</Label>
                <Input type="number" step="0.01" value={form.spend_limit_daily} onChange={(e) => setForm({ ...form, spend_limit_daily: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Semanal</Label>
                <Input type="number" step="0.01" value={form.spend_limit_weekly} onChange={(e) => setForm({ ...form, spend_limit_weekly: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mensual</Label>
                <Input type="number" step="0.01" value={form.spend_limit_monthly} onChange={(e) => setForm({ ...form, spend_limit_monthly: Number(e.target.value) })} />
              </div>
            </div>
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
