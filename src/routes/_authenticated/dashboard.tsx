import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { profileQuery, pocketsQuery, debtsQuery, flowsQuery, transactionsQuery, subscriptionQuery } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { money, pct } from "@/lib/format";
import { compoundDaily, graceInfo, daysUntilPayday } from "@/lib/finance";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, CreditCard, Wallet, Calendar, Receipt, Crown, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — Finance Flow Pocket" },
      { name: "description", content: "Vista general de tus finanzas: bolsillos, deudas, transacciones y rendimiento." },
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
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const { data: debts } = useSuspenseQuery(debtsQuery());
  const { data: flows } = useSuspenseQuery(flowsQuery());
  const { data: transactions } = useSuspenseQuery(transactionsQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const isPro = Boolean(
    subscription &&
      (subscription.status === "active" ||
        subscription.status === "trialing" ||
        (subscription.status === "canceled" &&
          subscription.current_period_end &&
          new Date(subscription.current_period_end) > new Date())),
  );

  const totalBalance = pockets.reduce((s, p) => s + Number(p.current_balance), 0);
  const totalPct = pockets.reduce((s, p) => s + Number(p.target_percentage), 0);
  const annualRate = Number(profile?.annual_yield_rate ?? 15);
  const cards = debts.filter((d) => d.debt_type === "card");
  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance), 0);
  const invisibleCash = cards.reduce(
    (s, c) => s + (Number(c.credit_limit ?? 0) - Number(c.current_balance)),
    0,
  );
  const salary = Number(profile?.biweekly_salary ?? 0);
  const paydayIn = daysUntilPayday([15, 30]);
  const recentTx = transactions.slice(0, 5);

  const projectionData = [30, 60, 90, 180, 365].map((d) => ({
    day: `${d}d`,
    balance: Math.round(compoundDaily(totalBalance, annualRate, d)),
  }));

  const upcomingFlows = flows
    .filter((f) => f.next_execution_date)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Hola{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="text-muted-foreground text-sm">Tu panorama financiero de hoy</p>
      </div>

      {/* Hero stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Wallet} label="Balance total" value={money(totalBalance)} accent="text-primary" />
        <StatCard icon={TrendingUp} label={`Proyección 30d (${pct(annualRate)})`} value={money(compoundDaily(totalBalance, annualRate, 30))} accent="text-primary" />
        <StatCard icon={CreditCard} label="Invisible Cash disponible" value={money(invisibleCash)} accent="text-accent" />
        <StatCard icon={Calendar} label="Próxima quincena" value={`${paydayIn} días`} sub={money(salary)} accent="text-warning" />
      </div>

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
                    <Pie
                      data={pockets}
                      dataKey="target_percentage"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
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
                {pockets.map((p) => {
                  const target = (salary * Number(p.target_percentage)) / 100;
                  return (
                    <div key={p.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                          <span>{p.name}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {money(p.current_balance)} · {money(target)}/qna
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Yield projection */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Rendimiento compuesto</h2>
            <p className="text-xs text-muted-foreground">Sobre balance actual · {pct(annualRate)}</p>
          </div>
          <div className="h-56">
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
        </Card>
      </div>

      {/* Debts + transactions + flows */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Deudas · Periodo de gracia</h2>
              <p className="text-xs text-muted-foreground">Total: <span className="text-destructive">{money(totalDebt)}</span></p>
            </div>
            <Link to="/debts" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has agregado deudas.</p>
          ) : (
            <div className="space-y-4">
              {cards.slice(0, 3).map((c) => {
                if (!c.cutoff_day || !c.due_day) return null;
                const g = graceInfo(c.cutoff_day, c.due_day);
                const daysLeft = Math.max(0, g.daysToCutoff);
                const pctLeft = Math.round(((g.maxFloat - daysLeft) / g.maxFloat) * 100);
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{daysLeft}d/{g.daysToDue}d</span>
                    </div>
                    <Progress value={pctLeft} />
                    <div className="text-xs text-muted-foreground">
                      Sin intereses: {money(Number(c.credit_limit ?? 0) - Number(c.current_balance))}
                    </div>
                  </div>
                );
              })}
              {debts.filter((d) => d.debt_type !== "card").slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{d.name}</span>
                  <span className="text-destructive">{money(d.current_balance)}</span>
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
