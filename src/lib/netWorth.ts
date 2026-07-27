// Capital, net worth and period-over-period expense comparison helpers.

export interface PocketLike {
  id: string;
  name: string;
  color: string;
  current_balance: number | string;
  accessibility: string;
  purpose: string;
  earns_yield: boolean;
  yield_rate: number | string | null;
  yield_start_date: string | null;
  yield_base_balance: number | string | null;
}

export interface DebtLike {
  id: string;
  name: string;
  debt_type: string;
  current_balance: number | string;
  credit_limit: number | string | null;
}

export interface TxLike {
  id: string;
  occurred_at: string;
  amount: number | string;
  kind: string;
  purpose: string | null;
  include_in_totals: boolean;
  pocket_id: string | null;
  debt_id: string | null;
}

export const POCKET_PURPOSE: Record<string, string> = {
  spending: "Gasto",
  savings: "Ahorro",
  investment: "Inversión",
  reserve: "Reserva",
};

export const POCKET_ACCESS: Record<string, string> = {
  available: "Disponible",
  restricted: "Restringido",
  locked: "Bloqueado",
};

export function isAccessible(p: { accessibility: string }): boolean {
  return p.accessibility === "available";
}

export function sumPockets(pockets: PocketLike[]): number {
  return pockets.reduce((s, p) => s + Number(p.current_balance), 0);
}

export function sumDebts(debts: DebtLike[]): number {
  return debts.reduce((s, d) => s + Number(d.current_balance), 0);
}

export interface NetWorth {
  assets: number;
  liquid: number;
  restricted: number;
  liabilities: number;
  net: number;
}

export function netWorth(pockets: PocketLike[], debts: DebtLike[]): NetWorth {
  const assets = sumPockets(pockets);
  const liquid = sumPockets(pockets.filter(isAccessible));
  const liabilities = sumDebts(debts);
  return { assets, liquid, restricted: assets - liquid, liabilities, net: assets - liabilities };
}

// --- Period comparison -----------------------------------------------------

export interface MonthRange {
  from: Date;
  to: Date;
  label: string;
}

export function monthRange(offset = 0, today = new Date()): MonthRange {
  const from = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const to = new Date(today.getFullYear(), today.getMonth() + offset + 1, 1);
  return {
    from,
    to,
    label: from.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
  };
}

export interface PeriodTotals {
  income: number;
  expense: number;
  net: number;
}

export function totalsInRange(txs: TxLike[], range: MonthRange): PeriodTotals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!t.include_in_totals) continue;
    const at = new Date(t.occurred_at);
    if (at < range.from || at >= range.to) continue;
    const amt = Number(t.amount);
    if (t.kind === "income") income += amt;
    else if (t.kind === "expense" || t.kind === "payment") expense += amt;
  }
  return { income, expense, net: income - expense };
}

export interface Delta {
  current: number;
  previous: number;
  diff: number;
  pct: number | null;
}

export function delta(current: number, previous: number): Delta {
  const diff = current - previous;
  const pct = previous === 0 ? null : (diff / Math.abs(previous)) * 100;
  return { current, previous, diff, pct };
}

export interface Breakdown {
  key: string;
  label: string;
  amount: number;
  color?: string;
}

export function expenseBreakdown(
  txs: TxLike[],
  range: MonthRange,
  by: "purpose" | "pocket" | "debt",
  names: Record<string, { name: string; color?: string }>,
): Breakdown[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (!t.include_in_totals) continue;
    if (t.kind !== "expense" && t.kind !== "payment") continue;
    const at = new Date(t.occurred_at);
    if (at < range.from || at >= range.to) continue;
    const key =
      by === "purpose" ? t.purpose || "Sin categoría" : (by === "pocket" ? t.pocket_id : t.debt_id) || "__none";
    map.set(key, (map.get(key) ?? 0) + Number(t.amount));
  }
  return [...map.entries()]
    .map(([key, amount]) => ({
      key,
      label: by === "purpose" ? key : key === "__none" ? "Sin asignar" : (names[key]?.name ?? "Desconocido"),
      amount,
      color: by === "purpose" ? undefined : names[key]?.color,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Last 6 months of income/expense/net for charting. */
export function monthlySeries(txs: TxLike[], months = 6, today = new Date()) {
  const out: { label: string; income: number; expense: number; net: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const range = monthRange(-i, today);
    const t = totalsInRange(txs, range);
    out.push({
      label: range.from.toLocaleDateString("es-MX", { month: "short" }),
      ...t,
    });
  }
  return out;
}
