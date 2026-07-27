import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQuery, pocketsQuery, debtsQuery, flowsQuery, transactionsQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { money, pct } from "@/lib/format";
import {
  compoundDaily,
  accruedYield,
  nextCutoffAndDue,
  formatDateEs,
  daysUntilPayday,
  periodSpend,
  limitStatus,
  YIELD_DISCLAIMER,
  type SpendTx,
} from "@/lib/finance";
import { netWorth, isAccessible, type PocketLike, type DebtLike } from "@/lib/netWorth";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useMemo } from "react";
import { TrendingUp, CreditCard, Wallet, Calendar, Receipt, Crown, Zap, PiggyBank, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-3, 200 80% 55%))",
  "hsl(var(--chart-4, 45 90% 60%))",
  "hsl(var(--chart-5, 320 70% 60%))",
];

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
  const paydayIn = daysUntilPayday([15, 30]);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Tu panorama financiero de hoy</p>
      </div>

      {/* Hero stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Balance en bolsillos" value={money(totalBalance)} sub={`${pockets.length} bolsillos`} />
        <StatCard
          icon={PiggyBank}
          label="Patrimonio neto"
          value={money(nw.net)}
          sub={`Activos ${money(nw.assets)} · Pasivos ${money(nw.liabilities)}`}
          accent={nw.net >= 0 ? "text-primary" : "text-destructive"}
        />
        <StatCard icon={CreditCard} label="Crédito disponible" value={money(invisibleCash)} sub={`${cards.length} tarjetas`} />
        <StatCard icon={Calendar} label="Próxima quincena" value={`${paydayIn} días`} sub={salary > 0 ? money(salary) : undefined} />
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
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {pockets.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span>{p.name}</span>
                      {!isAccessible(p) && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          no disponible
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {money(p.current_balance as number)} · {money((salary * Number(p.target_percentage)) / 100)}/qna
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
              <LineChart data={projectionData}>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
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
                      <span>{money(c.current_balance as number)}</span>
                    </div>
                    <Progress value={used} />
                    <p className="text-xs text-muted-foreground">
                      Corte {formatDateEs(cycle.cutoff)} ({cycle.daysToCutoff}d) · Pago {formatDateEs(cycle.due)} ({cycle.daysToDue}d)
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
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={`mt-2 text-xl font-semibold ${accent ?? ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
