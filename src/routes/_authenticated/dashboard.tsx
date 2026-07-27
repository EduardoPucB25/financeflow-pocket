import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  profileQuery,
  pocketsQuery,
  debtsQuery,
  flowsQuery,
  transactionsQuery,
  subscriptionQuery,
} from "@/lib/queries";
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
      {
        name: "description",
        content: "Vista general de tus finanzas: patrimonio, bolsillos, deudas, transacciones y rendimiento.",
      },
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
              compoundDaily(Number(p.yield_base_balance ?? p.current_balance), Number(p.yield_rate ?? annualRate), d),
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
    <div className="p-4 md:p-8 space-y-6 bg-[#0B1120] min-h-screen text-slate-100">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-slate-400 text-sm font-medium mt-0.5">Tu panorama financiero de hoy</p>
      </div>

      {/* Hero stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Balance total"
          value={money(totalBalance)}
          sub={`Líquido ${money(nw.liquid)}`}
          accent="text-emerald-400"
        />
        <StatCard
          icon={PiggyBank}
          label="Patrimonio neto"
          value={money(nw.net)}
          sub={`Deudas ${money(nw.liabilities)}`}
          accent={nw.net >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <StatCard
          icon={TrendingUp}
          label="Rendimiento acumulado"
          value={money(earnedTotal)}
          sub={yieldPockets.length === 0 ? "Sin bolsillos seleccionados" : `Sobre ${money(yieldBase)}`}
          accent="text-indigo-400"
        />
        <StatCard
          icon={Calendar}
          label="Próxima quincena"
          value={`${paydayIn} días`}
          sub={`Monto: ${money(salary)}`}
          accent="text-amber-400"
        />
      </div>

      {globalLimit > 0 && globalStatus.level !== "ok" && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 shadow-md ${
            globalStatus.level === "over"
              ? "border-rose-500/40 bg-rose-950/30 text-rose-200"
              : "border-amber-500/40 bg-amber-950/30 text-amber-200"
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 mt-0.5 shrink-0 ${globalStatus.level === "over" ? "text-rose-400" : "text-amber-400"}`}
          />
          <div>
            <div className="font-semibold text-white">
              {globalStatus.level === "over"
                ? "Superaste tu límite de gasto mensual"
                : "Estás cerca de tu límite de gasto mensual"}
            </div>
            <div className="text-slate-300 text-xs mt-0.5">
              Llevas {money(globalStatus.spent)} de {money(globalStatus.limit)} ({Math.round(globalStatus.ratio * 100)}
              %).
            </div>
          </div>
        </div>
      )}

      {!isPro && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-500/20 p-2 text-emerald-400 shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-base">Desbloquea funciones Pro</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Bolsillos ilimitados, detección automática de notificaciones bancarias y simulador avanzado.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
            <Link to="/upgrade">
              <Zap className="h-4 w-4 mr-1.5 fill-current" /> Ver planes Pro
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Allocation Card */}
        <Card className="p-5 lg:col-span-2 bg-slate-900/80 border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="font-bold text-slate-100 text-base">Distribución por bolsillos</h2>
              <p className="text-xs text-slate-400 font-medium">
                Total {pct(totalPct)} asignado {totalPct !== 100 && "· ajusta a 100%"}
              </p>
            </div>
            <Link
              to="/pockets"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Gestionar →
            </Link>
          </div>

          {pockets.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Cargando bolsillos por defecto…</p>
          ) : (
            <div className="grid md:grid-cols-12 gap-6 items-center">
              {/* Pie Chart Container */}
              <div className="md:col-span-5 h-60 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pockets}
                      dataKey="target_percentage"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      stroke="#0F172A"
                      strokeWidth={2}
                    >
                      {pockets.map((p) => (
                        <Cell key={p.id} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        borderRadius: "0.5rem",
                        color: "#F8FAFC",
                        fontSize: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                      }}
                      itemStyle={{ color: "#F8FAFC", fontWeight: "600" }}
                      formatter={(v: number) => [`${v}%`, "Asignación"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pocket Legend Items (Sin solapamientos) */}
              <div className="md:col-span-7 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {pockets.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 hover:border-slate-700/80 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ background: p.color }} />
                        <span className="font-semibold text-slate-100 text-xs sm:text-sm truncate">{p.name}</span>
                        {!isAccessible(p) && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 shrink-0">
                            no disponible
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-emerald-400 shrink-0">
                        {money((salary * Number(p.target_percentage)) / 100)}/qna
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pl-5">
                      <span>Saldo actual:</span>
                      <span className="font-medium text-slate-200">{money(p.current_balance as number)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Yield Projection Card */}
        <Card className="p-5 bg-slate-900/80 border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="mb-4 pb-2 border-b border-slate-800">
              <h2 className="font-bold text-slate-100 text-base">Rendimiento compuesto</h2>
              <p className="text-xs text-slate-400 font-medium">
                Solo bolsillos activos · Valor actual:{" "}
                <span className="text-emerald-400 font-bold">{money(accruedTotal)}</span>
              </p>
            </div>

            {/* Chart with Bright Axes */}
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    stroke="#94A3B8"
                    tick={{ fill: "#CBD5E1", fontSize: 12, fontWeight: 500 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    tick={{ fill: "#CBD5E1", fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "0.5rem",
                      color: "#F8FAFC",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                    }}
                    itemStyle={{ color: "#10B981", fontWeight: "700" }}
                    formatter={(v: number) => [money(v), "Proyección"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ fill: "#10B981", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            <div className="text-xs font-semibold text-slate-200">¿Qué bolsillos generan rendimiento?</div>
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {pockets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-800/40"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate text-slate-200 font-medium">{p.name}</span>
                  </span>
                  <Switch
                    checked={p.earns_yield}
                    onCheckedChange={(on) => toggleYield.mutate({ id: p.id, on, balance: Number(p.current_balance) })}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 pt-1 leading-tight">{YIELD_DISCLAIMER}</p>
          </div>
        </Card>
      </div>

      {/* Debts + Transactions + Flows Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cards & Debts */}
        <Card className="p-5 bg-slate-900/80 border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="font-bold text-slate-100 text-base">Tarjetas · corte y pago</h2>
              <p className="text-xs text-slate-400 font-medium">
                Deuda: <span className="text-rose-400 font-bold">{money(nw.liabilities)}</span> · Disp.{" "}
                <span className="text-emerald-400 font-bold">{money(invisibleCash)}</span>
              </p>
            </div>
            <Link
              to="/debts"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {debts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Aún no has agregado deudas.</p>
          ) : (
            <div className="space-y-4">
              {cards.slice(0, 3).map((c) => {
                const card = c as DebtLike & { cutoff_day?: number | null; due_day?: number | null };
                if (!card.cutoff_day || !card.due_day) return null;
                const cycle = nextCutoffAndDue(card.cutoff_day, card.due_day);
                const limit = Number(c.credit_limit ?? 0);
                const used = limit > 0 ? Math.min(100, Math.round((Number(c.current_balance) / limit) * 100)) : 0;
                return (
                  <div key={c.id} className="space-y-1.5 p-2 rounded-lg bg-slate-950/40 border border-slate-800/50">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-slate-100 truncate">{c.name}</span>
                      <span className="text-rose-400 font-bold">{money(c.current_balance as number)}</span>
                    </div>
                    <Progress value={used} className="h-1.5 bg-slate-800" />
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium pt-0.5">
                      <span>
                        Corte {formatDateEs(cycle.cutoff)} ({cycle.daysToCutoff}d)
                      </span>
                      <span className="text-amber-300 font-semibold">
                        Pago {formatDateEs(cycle.due)} ({cycle.daysToDue}d)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {limit > 0
                        ? `Disponible: ${money(Math.max(0, limit - Number(c.current_balance)))}`
                        : "Define el límite para ver el disponible"}
                    </div>
                  </div>
                );
              })}
              {debts
                .filter((d) => d.debt_type !== "card")
                .slice(0, 3)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-xs sm:text-sm p-2 rounded bg-slate-950/30"
                  >
                    <span className="font-medium text-slate-200 truncate">{d.name}</span>
                    <span className="text-rose-400 font-bold">{money(d.current_balance as number)}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card className="p-5 bg-slate-900/80 border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h2 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" /> Recientes
            </h2>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Sin transacciones registradas.</p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {recentTx.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-200 truncate">{t.description || t.kind}</div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(t.occurred_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <span className={`font-bold shrink-0 ${t.kind === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                    {t.kind === "income" ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming Flows */}
        <Card className="p-5 bg-slate-900/80 border-slate-800/80 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h2 className="font-bold text-slate-100 text-base">Próximos flujos</h2>
            <Link
              to="/flows"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Gestionar →
            </Link>
          </div>
          {upcomingFlows.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Sin flujos programados.</p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {upcomingFlows.map((f) => (
                <li key={f.id} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                  <div className="pr-2 min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{f.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {f.next_execution_date} · {f.frequency}
                    </div>
                  </div>
                  <span
                    className={`font-bold shrink-0 ${f.flow_type === "deposit" ? "text-emerald-400" : "text-rose-400"}`}
                  >
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
    <Card className="p-4 bg-slate-900/80 border-slate-800/80 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <Icon className={`h-4 w-4 ${accent ?? "text-slate-400"}`} />
      </div>
      <div className="mt-2 text-xl md:text-2xl font-black text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs font-medium text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}
