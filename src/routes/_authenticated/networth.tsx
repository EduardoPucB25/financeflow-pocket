import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { pocketsQuery, debtsQuery, transactionsQuery } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  netWorth,
  monthRange,
  totalsInRange,
  delta,
  expenseBreakdown,
  monthlySeries,
  isAccessible,
  POCKET_ACCESS,
  type PocketLike,
  type DebtLike,
  type TxLike,
} from "@/lib/netWorth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { Wallet, TrendingDown, TrendingUp, Landmark, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/_authenticated/networth")({
  head: () => ({
    meta: [
      { title: "Capital y Patrimonio — Finance Flow Pocket" },
      {
        name: "description",
        content:
          "Patrimonio neto, capital líquido y la diferencia de gastos entre este mes y el anterior.",
      },
      { property: "og:title", content: "Capital y Patrimonio — Finance Flow Pocket" },
      {
        property: "og:description",
        content: "Mide tu patrimonio neto y compara tus gastos mes contra mes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(debtsQuery());
    context.queryClient.ensureQueryData(transactionsQuery());
  },
  component: NetWorthPage,
});

function NetWorthPage() {
  const { data: pockets } = useSuspenseQuery(pocketsQuery());
  const { data: debts } = useSuspenseQuery(debtsQuery());
  const { data: txs } = useSuspenseQuery(transactionsQuery());

  const p = pockets as unknown as PocketLike[];
  const d = debts as unknown as DebtLike[];
  const t = txs as unknown as TxLike[];

  const nw = useMemo(() => netWorth(p, d), [p, d]);
  const thisMonth = useMemo(() => monthRange(0), []);
  const lastMonth = useMemo(() => monthRange(-1), []);
  const cur = useMemo(() => totalsInRange(t, thisMonth), [t, thisMonth]);
  const prev = useMemo(() => totalsInRange(t, lastMonth), [t, lastMonth]);
  const expenseDelta = delta(cur.expense, prev.expense);
  const incomeDelta = delta(cur.income, prev.income);

  const pocketNames = useMemo(
    () => Object.fromEntries(p.map((x) => [x.id, { name: x.name, color: x.color }])),
    [p],
  );
  const debtNames = useMemo(() => Object.fromEntries(d.map((x) => [x.id, { name: x.name }])), [d]);

  const byPurpose = useMemo(() => expenseBreakdown(t, thisMonth, "purpose", {}), [t, thisMonth]);
  const byPocket = useMemo(
    () => expenseBreakdown(t, thisMonth, "pocket", pocketNames),
    [t, thisMonth, pocketNames],
  );
  const byDebt = useMemo(
    () => expenseBreakdown(t, thisMonth, "debt", debtNames),
    [t, thisMonth, debtNames],
  );
  const series = useMemo(() => monthlySeries(t, 6), [t]);

  const debtRatio = nw.assets > 0 ? Math.min(100, Math.round((nw.liabilities / nw.assets) * 100)) : 0;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Capital y patrimonio</h1>
        <p className="text-sm text-muted-foreground">
          Tu balance real: lo que tienes menos lo que debes, y cómo cambian tus gastos.
        </p>
      </div>

      <div data-guide="nw-stats" className="grid gap-4 md:grid-cols-4">
        <Stat
          icon={PiggyBank}
          label="Patrimonio neto"
          value={money(nw.net)}
          accent={nw.net >= 0 ? "text-primary" : "text-destructive"}
          sub="Bolsillos − deudas"
        />
        <Stat icon={Wallet} label="Capital líquido" value={money(nw.liquid)} accent="text-accent" sub="Solo bolsillos disponibles" />
        <Stat icon={Landmark} label="Pasivos" value={money(nw.liabilities)} accent="text-destructive" sub={`${debtRatio}% de tus activos`} />
        <Stat
          icon={expenseDelta.diff <= 0 ? TrendingDown : TrendingUp}
          label="Gastos vs mes anterior"
          value={`${expenseDelta.diff >= 0 ? "+" : "−"}${money(Math.abs(expenseDelta.diff))}`}
          accent={expenseDelta.diff <= 0 ? "text-primary" : "text-destructive"}
          sub={expenseDelta.pct === null ? "Sin mes previo" : `${expenseDelta.pct >= 0 ? "+" : ""}${expenseDelta.pct.toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-guide="nw-flujo" className="p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-semibold">Ingresos vs gastos (6 meses)</h2>
            <p className="text-xs text-muted-foreground">Solo movimientos que cuentan en totales.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series}>
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={70}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem" }}
                  formatter={(v: number) => money(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Ingresos" dataKey="income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar name="Gastos" dataKey="expense" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                <Line name="Neto" type="monotone" dataKey="net" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Resumen del mes</h2>
          <Row label="Ingresos" value={money(cur.income)} tone="text-primary" />
          <Row
            label="Mes anterior"
            value={money(prev.income)}
            tone="text-muted-foreground"
            sub={incomeDelta.pct === null ? undefined : `${incomeDelta.pct >= 0 ? "+" : ""}${incomeDelta.pct.toFixed(1)}%`}
          />
          <div className="border-t border-border pt-3 space-y-3">
            <Row label="Gastos" value={money(cur.expense)} tone="text-destructive" />
            <Row
              label="Mes anterior"
              value={money(prev.expense)}
              tone="text-muted-foreground"
              sub={expenseDelta.pct === null ? undefined : `${expenseDelta.pct >= 0 ? "+" : ""}${expenseDelta.pct.toFixed(1)}%`}
            />
          </div>
          <div className="border-t border-border pt-3">
            <Row label="Neto del mes" value={money(cur.net)} tone={cur.net >= 0 ? "text-primary" : "text-destructive"} />
          </div>
          <div className="pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Apalancamiento (deuda / activos)</span>
              <span>{debtRatio}%</span>
            </div>
            <Progress value={debtRatio} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BreakdownCard title="Gastos por categoría" rows={byPurpose} total={cur.expense} />
        <BreakdownCard title="Gastos por bolsillo" rows={byPocket} total={cur.expense} />
        <BreakdownCard title="Gastos por tarjeta / deuda" rows={byDebt} total={cur.expense} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Composición de tu capital</h2>
        <div className="divide-y divide-border">
          {p.map((pocket) => (
            <div key={pocket.id} className="py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pocket.color }} />
                <span className="truncate">{pocket.name}</span>
                <span
                  className={`text-[10px] rounded px-1.5 py-0.5 border shrink-0 ${
                    isAccessible(pocket)
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {POCKET_ACCESS[pocket.accessibility] ?? pocket.accessibility}
                </span>
              </div>
              <span className="font-medium">{money(pocket.current_balance as number)}</span>
            </div>
          ))}
          {d.map((debt) => (
            <div key={debt.id} className="py-2 flex items-center justify-between text-sm">
              <span className="truncate text-muted-foreground">{debt.name}</span>
              <span className="font-medium text-destructive">−{money(debt.current_balance as number)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { key: string; label: string; amount: number; color?: string }[];
  total: number;
}) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin gastos este mes.</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 8).map((r) => {
            const share = total > 0 ? Math.round((r.amount / total) * 100) : 0;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    {r.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />}
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {money(r.amount)} · {share}%
                  </span>
                </div>
                <Progress value={share} className="mt-1 h-1.5" />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className={`font-medium ${tone ?? ""}`}>{value}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

// Maps a Stat `accent` text-color class to a matching translucent
// background chip. Kept as a literal map (not template-literal string
// concatenation) so Tailwind's static class scanner can discover every
// class used in this file.
const ACCENT_CHIP: Record<string, string> = {
  "text-primary": "bg-primary/10",
  "text-destructive": "bg-destructive/10",
  "text-accent": "bg-accent/10",
  "text-warning": "bg-warning/10",
};

function Stat({
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
        <div className={cn("rounded-lg p-2", accent ? (ACCENT_CHIP[accent] ?? "bg-muted/50") : "bg-muted/50")}>
          <Icon className={cn("h-4 w-4", accent ?? "text-muted-foreground")} />
        </div>
      </div>
      <div className={`mt-2 text-xl md:text-2xl font-bold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
