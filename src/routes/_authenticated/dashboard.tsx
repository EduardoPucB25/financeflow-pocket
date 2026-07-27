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

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Hola{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Tu panorama financiero de hoy</p>
      </div>

      {/* Hero stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
          value={money(earnedTotal)}
          sub={yieldPockets.length === 0 ? "Sin bolsillos seleccionados" : `Sobre ${money(yieldBase)}`}
          accent="text-accent"
        />
        <StatCard icon={Calendar} label="Próxima quincena" value={`${paydayIn} días`} sub={money(salary)} accent="text-warning" />
      </div>

      {globalLimit > 0 && globalStatus.level !== "ok" && (
        <div
          className={`rounded-md border px-4 py-3 text-sm flex items-start gap-3 ${
            globalStatus.level === "over"
              ? "border-destructive/40 bg-destructive/10"
              : "border-warning/40 bg-warning/10"
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 mt-0.5 shrink-0 ${globalStatus.level === "over" ? "text-destructive" : "text-warning"}`}
          />
          <div>
            <div className="font-medium">
              {globalStatus.level === "over"
                ? "Superaste tu límite de gasto mensual"
                : "Estás cerca de tu límite de gasto mensual"}
            </div>
            <div className="text-muted-foreground">
              Llevas {money(globalStatus.spent)} de {money(globalStatus.limit)} ({Math.round(globalStatus.ratio * 100)}%).
            </div>
          </div>
        </div>
      )}

      {!isPro && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-primary/20 p-2 text-primary">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">Desbloquea funciones Pro</p>
              <p className="text-sm text-muted-foreground">
                Bolsillos ilimitados, detección automática de notificaciones bancarias y simulador avanzado.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/upgrade">
              <Zap className="h-4 w-4 mr-1" /> Ver planes Pro
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Allocation */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Distribución por bolsillos</h2>
              <p className="text-xs text-muted-foreground">
                Total {pct(totalPct)} asignado {totalPct !== 100 && "· ajusta a 100%"}
              </p>
            </div>
            <Link to="/pockets" className="text-xs text-primary hover:underline">Gestionar</Link>
          </div>
          {pockets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando bolsillos por defecto…</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pockets} dataKey="target_percentage" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {pockets.map((p) => (
                        <Cell key={p.id} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => `${v}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {pockets.map((p) => (
                  <div key={p.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="truncate">{p.name}</span>
                        {!isAccessible(p) && (
                          <span className="text-[10px] border border-border rounded px-1 text-muted-foreground shrink-0">
                            no disponible
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {money(p.current_balance as number)} · {money((salary * Number(p.target_percentage)) / 100)}/qna
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Yield projection with pocket selector */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Rendimiento compuesto</h2>
            <p className="text-xs text-muted-foreground">
              Solo los bolsillos seleccionados · valor actual {money(accruedTotal)}
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => money(v)}
                />
                <Line type="monotone" dataKey="balance" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <div className="text-xs font-medium">¿Qué bolsillos generan rendimiento?</div>
            {pockets.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <Switch
                  checked={p.earns_yield}
                  onCheckedChange={(on) =>
                    toggleYield.mutate({ id: p.id, on, balance: Number(p.current_balance) })
                  }
                />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">{YIELD_DISCLAIMER}</p>
          </div>
        </Card>
      </div>

      {/* Debts + transactions + flows */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Tarjetas · corte y pago</h2>
              <p className="text-xs text-muted-foreground">
                Deuda total: <span className="text-destructive">{money(nw.liabilities)}</span> · disponible{" "}
                <span className="text-accent">{money(invisibleCash)}</span>
              </p>
            </div>
            <Link to="/debts" className="text-xs text-primary hover:underline">Ver todas</Link>
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
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-muted-foreground">{money(c.current_balance as number)}</span>
                    </div>
                    <Progress value={used} />
                    <div className="text-xs text-muted-foreground">
                      Corte {formatDateEs(cycle.cutoff)} ({cycle.daysToCutoff}d) · Pago {formatDateEs(cycle.due)} ({cycle.daysToDue}d)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {limit > 0
                        ? `Disponible: ${money(Math.max(0, limit - Number(c.current_balance)))}`
                        : "Define el límite de crédito para ver el disponible"}
                    </div>
                  </div>
                );
              })}
              {debts.filter((d) => d.debt_type !== "card").slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{d.name}</span>
                  <span className="text-destructive">{money(d.current_balance as number)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Recientes</h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin transacciones registradas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTx.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.description || t.kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.occurred_at).toLocaleDateString("es-MX")}
                    </div>
                  </div>
                  <span className={t.kind === "income" ? "text-primary" : "text-destructive"}>
                    {t.kind === "income" ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Próximos flujos</h2>
            <Link to="/flows" className="text-xs text-primary hover:underline">Gestionar</Link>
          </div>
          {upcomingFlows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin flujos programados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingFlows.map((f) => (
                <li key={f.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{f.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.next_execution_date} · {f.frequency}
                    </div>
                  </div>
                  <span className={f.flow_type === "deposit" ? "text-primary" : "text-destructive"}>
                    {f.flow_type === "deposit" ? "+" : "−"}
                    {money(f.amount)}
                  </span>
                </li>
              ))}
            </ul>
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
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-xl md:text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
