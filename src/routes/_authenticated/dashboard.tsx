import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQuery, pocketsQuery, debtsQuery, flowsQuery, transactionsQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { money, pct } from "@/lib/format";
import {
  compoundDaily,
  accruedYield,
  nextCutoffAndDue,
  formatDateEs,
  nextPayday,
  DEFAULT_PAYDAY_RULE,
  type PaydayRule,
  periodSpend,
  limitStatus,
  YIELD_DISCLAIMER,
  type SpendTx,
} from "@/lib/finance";
import { netWorth, isAccessible, type PocketLike, type DebtLike } from "@/lib/netWorth";
import { PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { TrendingUp, Wallet, Calendar, Receipt, Crown, Zap, PiggyBank, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — Finance Flow Pocket" },
      { name: "description", content: "Vista general de tus finanzas: patrimonio, bolsillos, deudas, transacciones y rendimiento." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(debtsQuery());
    context.queryClient.ensureQueryData(flowsQuery());
    context.queryClient.ensureQueryData(transactionsQuery());
  },
  component: Dashboard,
});

// Balances the projection Y axis needs slightly more precision than a plain
// `/1000` + integer round: with narrow ranges (a few thousand pesos) integer
// rounding collapses distinct ticks into the same "$3k" label.
const formatKTick = (v: number) => {
  const k = v / 1000;
  return `$${k.toFixed(Math.abs(k) < 10 ? 1 : 0)}k`;
};

// Maps a StatCard `accent` text-color class to a matching translucent
// background chip. Kept as a literal map (not template-literal string
// concatenation) so Tailwind's static class scanner can discover every
// class used in this file.
const ACCENT_CHIP: Record<string, string> = {
  "text-primary": "bg-primary/10",
  "text-destructive": "bg-destructive/10",
  "text-accent": "bg-accent/10",
  "text-warning": "bg-warning/10",
};

// Left accent rail per StatCard, same literal-map rationale as ACCENT_CHIP.
const ACCENT_RAIL: Record<string, string> = {
  "text-primary": "bg-primary",
  "text-destructive": "bg-destructive",
  "text-accent": "bg-accent",
  "text-warning": "bg-warning",
};

function Dashboard() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: pocketsData } = useSuspenseQuery(pocketsQuery());
  const { data: debtsData } = useSuspenseQuery(debtsQuery());
  const { data: flows } = useSuspenseQuery(flowsQuery());
  const { data: transactions } = useSuspenseQuery(transactionsQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const pockets = pocketsData as unknown as (PocketLike & { target_percentage: number })[];
  const debts = debtsData as unknown as DebtLike[];
  const spendTxs = transactions as unknown as SpendTx[];

  const totalBalance = pockets.reduce((s, p) => s + Number(p.current_balance), 0);
  const totalPct = pockets.reduce((s, p) => s + Number(p.target_percentage), 0);
  const annualRate = Number(profile?.annual_yield_rate ?? 15);
  const cards = debts.filter((d) => d.debt_type === "card");
  const nw = netWorth(pockets, debts);
  const invisibleCash = cards.reduce(
    (s, c) => s + Math.max(0, Number(c.credit_limit ?? 0) - Number(c.current_balance)),
    0,
  );
  const salary = Number(profile?.biweekly_salary ?? 0);
  // `payday_*` ships in migration 20260728100000 but isn't in the generated
  // Supabase types yet — cast locally until types.ts regenerates.
  const profileRow = profile as {
    payday_days?: number[] | null;
    payday_offset_days?: number | null;
    payday_weekend_to_friday?: boolean | null;
  } | null;
  const paydayRule: PaydayRule = {
    days: profileRow?.payday_days ?? DEFAULT_PAYDAY_RULE.days,
    offsetDays: Number(profileRow?.payday_offset_days ?? 0),
    weekendToFriday: Boolean(profileRow?.payday_weekend_to_friday ?? false),
  };
  const payday = nextPayday(paydayRule);
  const recentTx = transactions.slice(0, 5);

  const yieldPockets = pockets.filter((p) => p.earns_yield);
  const yieldBase = yieldPockets.reduce((s, p) => s + Number(p.yield_base_balance ?? p.current_balance), 0);
  const accruedTotal = yieldPockets.reduce((s, p) => {
    const a = accruedYield(
      Number(p.yield_base_balance ?? p.current_balance),
      Number(p.yield_rate ?? annualRate),
      p.yield_start_date,
    );
    return s + a.current;
  }, 0);
  const earnedTotal = accruedTotal - yieldBase;

  const projectionData = useMemo(
    () =>
      [30, 60, 90, 180, 365].map((d) => ({
        day: `${d}d`,
        balance: Math.round(
          yieldPockets.reduce(
            (s, p) =>
              s +
              compoundDaily(
                Number(p.yield_base_balance ?? p.current_balance),
                Number(p.yield_rate ?? annualRate),
                d,
              ),
            0,
          ),
        ),
      })),
    [yieldPockets, annualRate],
  );

  const globalLimit = Number(profile?.global_spend_limit_monthly ?? 0);
  const globalSpent = useMemo(() => periodSpend(spendTxs, "monthly"), [spendTxs]);
  const globalStatus = limitStatus("monthly", globalLimit, globalSpent);

  const toggleYield = useMutation({
    mutationFn: async ({ id, on, balance }: { id: string; on: boolean; balance: number }) => {
      const { error } = await supabase
        .from("pockets")
        .update({
          earns_yield: on,
          yield_start_date: on ? new Date().toISOString().slice(0, 10) : null,
          yield_base_balance: on ? balance : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pockets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const upcomingFlows = flows.filter((f) => f.next_execution_date).slice(0, 5);

  const pieData = pockets.map((p) => ({
    name: p.name,
    value: Number(p.target_percentage),
  }));

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[radial-gradient(900px_400px_at_15%_-10%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(700px_380px_at_100%_0%,rgba(139,92,246,0.08),transparent_55%)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Tu panorama financiero de hoy</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
          {payday.daysUntil === 0
            ? "Hoy es día de pago"
            : `Próximo pago en ${payday.daysUntil} ${payday.daysUntil === 1 ? "día" : "días"}`}
        </span>
      </div>

      {/* Hero stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Balance total" value={money(totalBalance)} sub={`Líquido ${money(nw.liquid)}`} accent="text-primary" />
        <StatCard
          icon={PiggyBank}
          label="Patrimonio neto"
          value={money(nw.net)}
          sub={`Deudas ${money(nw.liabilities)}`}
          accent={nw.net >= 0 ? "text-primary" : "text-destructive"}
        />
        <StatCard
          icon={TrendingUp}
          label="Rendimiento acumulado"
          value={money(Math.max(0, earnedTotal))}
          sub={`Sobre ${money(accruedTotal)} generando`}
          accent="text-accent"
        />
        <StatCard
          icon={Calendar}
          label="Próximo pago"
          value={payday.daysUntil === 0 ? "Hoy" : `${payday.daysUntil} ${payday.daysUntil === 1 ? "día" : "días"}`}
          sub={`${formatDateEs(payday.date)}${salary > 0 ? ` · ${money(salary)}` : ""}`}
          accent="text-warning"
        />
      </div>

      {globalLimit > 0 && globalStatus.level !== "ok" && (
        <Card className="flex items-start gap-3 border-destructive/40 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium">
              {globalStatus.level === "over"
                ? "Superaste tu límite de gasto mensual"
                : "Estás cerca de tu límite de gasto mensual"}
            </p>
            <p className="text-sm text-muted-foreground">
              Llevas {money(globalStatus.spent)} de {money(globalStatus.limit)} ({Math.round(globalStatus.ratio * 100)}%).
            </p>
          </div>
        </Card>
      )}

      {!isPro && (
        <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Desbloquea funciones Pro</p>
              <p className="text-sm text-muted-foreground">
                Bolsillos ilimitados, detección automática de notificaciones bancarias y simulador avanzado.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/upgrade">
              <Zap className="mr-2 h-4 w-4" /> Ver planes Pro
            </Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Allocation */}
        <Card className="p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Distribución por bolsillos</h2>
              <p className="text-sm text-muted-foreground">
                Total {pct(totalPct)} asignado {totalPct !== 100 && "· ajusta a 100%"}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pockets">Gestionar</Link>
            </Button>
          </div>

          {pockets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando bolsillos por defecto…</p>
          ) : (
            <div className="space-y-4">
              <div className="relative h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2} stroke="none">
                      {pockets.map((p, i) => (
                        <Cell key={i} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => `${v}%`}
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">En bolsillos</span>
                  <span className="text-lg font-bold tracking-tight">{money(totalBalance)}</span>
                </div>
              </div>

              <div className="space-y-1">
                {pockets.map((p) => (
                  <div key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary/50">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground/90">{p.name}</span>
                      {!isAccessible(p) && (
                        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          bloqueado
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="font-semibold">{money(p.current_balance as number)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {Number(p.target_percentage)}% · {money((salary * Number(p.target_percentage)) / 100)}/qna
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Yield projection with pocket selector */}
        <Card className="p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Rendimiento compuesto</h2>
            <p className="text-sm text-muted-foreground">
              Solo los bolsillos seleccionados · valor actual {money(accruedTotal)}
              {earnedTotal > 0 && ` (+${money(earnedTotal)})`}
            </p>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projectionData}>
                <defs>
                  <linearGradient id="dashboardYieldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={formatKTick} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem" }}
                />
                <Area type="monotone" dataKey="balance" stroke="none" fill="url(#dashboardYieldFill)" />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={(props: { cx?: number; cy?: number; index?: number }) =>
                    props.index === projectionData.length - 1 ? (
                      <circle
                        key={`end-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={4.5}
                        fill="var(--color-primary)"
                        stroke="var(--color-card)"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <g key={`d-${props.index}`} />
                    )
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">¿Qué bolsillos generan rendimiento?</p>
            {pockets.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{p.name}</span>
                </div>
                <Switch
                  checked={!!p.earns_yield}
                  onCheckedChange={(on) =>
                    toggleYield.mutate({ id: p.id, on, balance: Number(p.current_balance) })
                  }
                />
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">{YIELD_DISCLAIMER}</p>
          </div>
        </Card>
      </div>

      {/* Debts + transactions + flows */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Tarjetas · corte y pago</h2>
              <p className="text-sm text-muted-foreground">
                Deuda total: {money(nw.liabilities)} · disponible {money(invisibleCash)}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/debts">Ver todas</Link>
            </Button>
          </div>

          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has agregado deudas.</p>
          ) : (
            <div className="space-y-4">
              {cards.slice(0, 3).map((c) => {
                const card = c as DebtLike & { cutoff_day?: number | null; due_day?: number | null };
                if (!card.cutoff_day || !card.due_day) return null;
                const cycle = nextCutoffAndDue(card.cutoff_day, card.due_day);
                const limit = Number(c.credit_limit ?? 0);
                const used = limit > 0 ? Math.min(100, Math.round((Number(c.current_balance) / limit) * 100)) : 0;
                return (
                  <div key={c.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="font-semibold">{money(c.current_balance as number)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          used >= 80 ? "bg-destructive" : used >= 50 ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${used}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Corte {formatDateEs(cycle.cutoff)} ({cycle.daysToCutoff}d) · Pago {formatDateEs(cycle.due)} ({cycle.daysToDue}d) · {used}% usado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {limit > 0
                        ? `Disponible: ${money(Math.max(0, limit - Number(c.current_balance)))}`
                        : "Define el límite de crédito para ver el disponible"}
                    </p>
                  </div>
                );
              })}
              {debts
                .filter((d) => d.debt_type !== "card")
                .slice(0, 3)
                .map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.name}</span>
                    <span>{money(d.current_balance as number)}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-4 w-4" /> Recientes
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/transactions">Ver todas</Link>
            </Button>
          </div>

          {recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin transacciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {recentTx.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.description || t.kind}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.occurred_at).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <span className={`text-sm ${t.kind === "income" ? "text-primary" : "text-foreground"}`}>
                    {t.kind === "income" ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Próximos flujos</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/flows">Gestionar</Link>
            </Button>
          </div>

          {upcomingFlows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin flujos programados.</p>
          ) : (
            <div className="space-y-3">
              {upcomingFlows.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.next_execution_date} · {f.frequency}
                    </p>
                  </div>
                  <span className={`text-sm ${f.flow_type === "deposit" ? "text-primary" : "text-foreground"}`}>
                    {f.flow_type === "deposit" ? "+" : "−"}
                    {money(f.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          accent ? (ACCENT_RAIL[accent] ?? "bg-muted") : "bg-muted",
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
        <div className={cn("shrink-0 rounded-lg p-2", accent ? (ACCENT_CHIP[accent] ?? "bg-muted/50") : "bg-muted/50")}>
          <Icon className={cn("h-4 w-4", accent ?? "text-muted-foreground")} />
        </div>
      </div>
      <p className={`mt-2 text-lg font-bold tracking-tight sm:text-xl ${accent ?? ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
