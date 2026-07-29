// Financial utility calculations.

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "one_time";

/** Convert an APY (as percent, e.g. 15 = 15%) to a daily compounding rate. */
export function dailyRate(annualPct: number): number {
  return annualPct / 100 / 365;
}

/** Compound a balance forward N days at annual rate (as percent). */
export function compoundDaily(balance: number, annualPct: number, days: number): number {
  return balance * Math.pow(1 + dailyRate(annualPct), days);
}

/** Projection point. */
export interface ProjectionPoint {
  day: number;
  date: string;
  balance: number;
}

/**
 * Simulate a balance forward day-by-day with periodic deposits/withdrawals.
 * Returns one point per week for chart rendering (plus final day).
 */
export function simulateYield(params: {
  initialBalance: number;
  annualPct: number;
  depositAmount: number;
  depositFreq: Frequency;
  withdrawalAmount: number;
  withdrawalFreq: Frequency;
  months: number;
  startDate?: Date;
}): ProjectionPoint[] {
  const start = params.startDate ?? new Date();
  const totalDays = Math.round(params.months * 30.44);
  const rate = dailyRate(params.annualPct);
  const depDays = frequencyDays(params.depositFreq);
  const wdDays = frequencyDays(params.withdrawalFreq);
  let balance = params.initialBalance;
  const points: ProjectionPoint[] = [];
  for (let d = 0; d <= totalDays; d++) {
    if (d > 0) balance = balance * (1 + rate);
    if (depDays && d > 0 && d % depDays === 0) balance += params.depositAmount;
    if (wdDays && d > 0 && d % wdDays === 0) balance -= params.withdrawalAmount;
    if (d % 7 === 0 || d === totalDays) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + d);
      points.push({
        day: d,
        date: dt.toISOString().slice(0, 10),
        balance: Math.max(0, balance),
      });
    }
  }
  return points;
}

function frequencyDays(freq: Frequency): number | null {
  switch (freq) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "one_time":
      return null;
  }
}

/**
 * Credit-card grace period info given cutoff/due days of the month.
 * "Invisible cash" window = days from today until due, when a charge made
 * today would still be due on that due date without interest.
 */
export function graceInfo(cutoffDay: number, dueDay: number, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // Next cutoff date
  let cutoff = new Date(y, m, cutoffDay);
  if (d > cutoffDay) cutoff = new Date(y, m + 1, cutoffDay);
  // Due date: next occurrence of dueDay after cutoff
  const dueMonth = cutoff.getMonth() + (dueDay <= cutoffDay ? 1 : 0);
  const due = new Date(cutoff.getFullYear(), dueMonth, dueDay);

  const daysToCutoff = Math.round((cutoff.getTime() - today.getTime()) / 86400000);
  const daysToDue = Math.round((due.getTime() - today.getTime()) / 86400000);
  // Maximum float window (charge on day after previous cutoff → next due)
  const maxFloat = Math.round(
    (due.getTime() - new Date(cutoff.getFullYear(), cutoff.getMonth() - 1, cutoffDay + 1).getTime()) /
      86400000,
  );

  return { cutoff, due, daysToCutoff, daysToDue, maxFloat };
}

// ---------------------------------------------------------------------------
// Payday schedule with user-configurable rules.
// ---------------------------------------------------------------------------

export interface PaydayRule {
  /** Day-of-month anchors; 31 means "fin de mes" (clamped in short months). */
  days: number[];
  /** Pay N days BEFORE each anchor (0-5). */
  offsetDays: number;
  /** If the computed date lands on Sat/Sun, move back to the previous Friday. */
  weekendToFriday: boolean;
}

export const DEFAULT_PAYDAY_RULE: PaydayRule = {
  days: [15, 31],
  offsetDays: 0,
  weekendToFriday: false,
};

export interface NextPayday {
  date: Date;
  daysUntil: number;
}

/**
 * Next payday under the given rule. Scans anchors over this month and the
 * next two (worst-case backward shift is offset 5 + weekend 2 = 7 days, so a
 * candidate >= today always exists in that window).
 */
export function nextPayday(rule: PaydayRule, today = new Date()): NextPayday {
  const t = startOfDay(today);
  const days = rule.days.length > 0 ? rule.days : DEFAULT_PAYDAY_RULE.days;
  const candidates: Date[] = [];
  for (let mo = 0; mo <= 2; mo++) {
    for (const anchor of days) {
      let d = safeDate(t.getFullYear(), t.getMonth() + mo, anchor);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - rule.offsetDays);
      if (rule.weekendToFriday) {
        const dow = d.getDay();
        if (dow === 6) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
        else if (dow === 0) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 2);
      }
      if (d.getTime() >= t.getTime()) candidates.push(d);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  const date = candidates[0];
  return { date, daysUntil: diffDays(t, date) };
}

// ---------------------------------------------------------------------------
// Credit-card cycle: real dates instead of rounded day counts.
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clamp a day-of-month to the actual length of that month. */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export interface CardCycle {
  /** Date the current statement closes. */
  cutoff: Date;
  /** Date the statement that closes on `cutoff` must be paid. */
  due: Date;
  daysToCutoff: number;
  daysToDue: number;
  /** Longest interest-free float achievable on this card, in days. */
  maxFloat: number;
}

/**
 * Next cutoff and its matching due date, using whole calendar days
 * (no millisecond rounding drift, month lengths respected).
 */
export function nextCutoffAndDue(cutoffDay: number, dueDay: number, today = new Date()): CardCycle {
  const t = startOfDay(today);
  let cutoff = safeDate(t.getFullYear(), t.getMonth(), cutoffDay);
  if (cutoff < t) cutoff = safeDate(t.getFullYear(), t.getMonth() + 1, cutoffDay);

  // The due date is the next occurrence of dueDay strictly after the cutoff.
  let due = safeDate(cutoff.getFullYear(), cutoff.getMonth(), dueDay);
  if (due <= cutoff) due = safeDate(cutoff.getFullYear(), cutoff.getMonth() + 1, dueDay);

  const prevCutoff = safeDate(cutoff.getFullYear(), cutoff.getMonth() - 1, cutoffDay);
  const graceDays = diffDays(cutoff, due);
  const cycleDays = diffDays(prevCutoff, cutoff);

  return {
    cutoff,
    due,
    daysToCutoff: diffDays(t, cutoff),
    daysToDue: diffDays(t, due),
    maxFloat: cycleDays + graceDays,
  };
}

/** Whole calendar days between two dates (b - a). */
export function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

export function formatDateEs(d: Date | string): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Yield accrual (display-only representation)
// ---------------------------------------------------------------------------

export interface Accrual {
  days: number;
  base: number;
  /** base compounded daily up to today */
  current: number;
  /** current - base */
  earned: number;
}

/**
 * Accrued compound interest from a fixed start date and base amount.
 * Purely a representation for planning — it never changes stored balances.
 */
export function accruedYield(
  baseBalance: number,
  annualPct: number,
  startDate: string | Date | null | undefined,
  today = new Date(),
): Accrual {
  const base = Number(baseBalance ?? 0);
  if (!startDate) return { days: 0, base, current: base, earned: 0 };
  const start = typeof startDate === "string" ? new Date(`${startDate}T00:00:00`) : startDate;
  const days = Math.max(0, diffDays(start, today));
  const current = compoundDaily(base, annualPct, days);
  return { days, base, current, earned: current - base };
}

// ---------------------------------------------------------------------------
// Spending periods & limits
// ---------------------------------------------------------------------------

export type SpendPeriod = "daily" | "weekly" | "monthly";

/** Inclusive start of the current daily / weekly (Mon) / monthly period. */
export function periodStart(period: SpendPeriod, today = new Date()): Date {
  const t = startOfDay(today);
  if (period === "daily") return t;
  if (period === "weekly") {
    const dow = (t.getDay() + 6) % 7; // Monday = 0
    return new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow);
  }
  return new Date(t.getFullYear(), t.getMonth(), 1);
}

/** Days remaining in the current period, including today. */
export function daysLeftInPeriod(period: SpendPeriod, today = new Date()): number {
  const t = startOfDay(today);
  if (period === "daily") return 1;
  if (period === "weekly") {
    const dow = (t.getDay() + 6) % 7;
    return 7 - dow;
  }
  const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return lastDay - t.getDate() + 1;
}

export interface SpendTx {
  occurred_at: string;
  amount: number | string;
  kind: string;
  include_in_totals: boolean;
  pocket_id: string | null;
  debt_id: string | null;
}

/** Total spent in the current period, optionally filtered by pocket or debt. */
export function periodSpend(
  txs: SpendTx[],
  period: SpendPeriod,
  filter?: { pocketId?: string; debtId?: string },
  today = new Date(),
): number {
  const from = periodStart(period, today).getTime();
  return txs.reduce((sum, t) => {
    if (!t.include_in_totals) return sum;
    if (t.kind !== "expense" && t.kind !== "payment") return sum;
    if (new Date(t.occurred_at).getTime() < from) return sum;
    if (filter?.pocketId && t.pocket_id !== filter.pocketId) return sum;
    if (filter?.debtId && t.debt_id !== filter.debtId) return sum;
    return sum + Number(t.amount);
  }, 0);
}

export type LimitLevel = "ok" | "warn" | "over";

export interface LimitStatus {
  period: SpendPeriod;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  level: LimitLevel;
}

/** Compare spend against a limit. Warn at 75%, over at 100%. */
export function limitStatus(period: SpendPeriod, limit: number, spent: number): LimitStatus {
  const ratio = limit > 0 ? spent / limit : 0;
  const level: LimitLevel = limit <= 0 ? "ok" : ratio >= 1 ? "over" : ratio >= 0.75 ? "warn" : "ok";
  return { period, limit, spent, remaining: limit - spent, ratio, level };
}

/**
 * How much can still be safely charged to a card without exceeding the
 * available credit before the payment date, spread over the remaining days.
 */
export function safeToSpend(params: {
  creditLimit: number;
  currentBalance: number;
  cutoffDay?: number | null;
  dueDay?: number | null;
  today?: Date;
}) {
  const today = params.today ?? new Date();
  const available = Math.max(0, Number(params.creditLimit ?? 0) - Number(params.currentBalance ?? 0));
  const cycle =
    params.cutoffDay && params.dueDay ? nextCutoffAndDue(params.cutoffDay, params.dueDay, today) : null;
  const daysToCutoff = Math.max(1, cycle?.daysToCutoff ?? 30);
  return {
    available,
    cycle,
    perDay: available / daysToCutoff,
    perWeek: (available / daysToCutoff) * Math.min(7, daysToCutoff),
    perCycle: available,
    daysToCutoff,
  };
}

export const YIELD_DISCLAIMER =
  "Representación estimada para cálculos — no refleja el rendimiento real de tu banco.";


// ---------------------------------------------------------------------------
// Statement cycles (estados de cuenta) — each cycle is anchored to a real month
// ---------------------------------------------------------------------------

export type StatementStatus = "closed" | "open" | "future";

export interface StatementCycle {
  /** ISO date (yyyy-mm-dd) of the cutoff — stable key for a statement. */
  key: string;
  /** First day included in this statement (day after the previous cutoff). */
  start: Date;
  cutoff: Date;
  due: Date;
  status: StatementStatus;
  daysToCutoff: number;
  daysToDue: number;
  /** "Julio 2026" — the month the statement closes in. */
  monthLabel: string;
  /** "Corte 12 jul 2026 · paga 2 ago 2026" */
  label: string;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Cutoff date of the statement that contains `date`. */
export function cutoffForDate(cutoffDay: number, date: Date | string): Date {
  const d = startOfDay(typeof date === "string" ? new Date(date) : date);
  const same = safeDate(d.getFullYear(), d.getMonth(), cutoffDay);
  return d <= same ? same : safeDate(d.getFullYear(), d.getMonth() + 1, cutoffDay);
}

/** Build the full statement info for a given cutoff date. */
export function statementForCutoff(
  cutoff: Date,
  cutoffDay: number,
  dueDay: number,
  today = new Date(),
): StatementCycle {
  const t = startOfDay(today);
  let due = safeDate(cutoff.getFullYear(), cutoff.getMonth(), dueDay);
  if (due <= cutoff) due = safeDate(cutoff.getFullYear(), cutoff.getMonth() + 1, dueDay);
  const prevCutoff = safeDate(cutoff.getFullYear(), cutoff.getMonth() - 1, cutoffDay);
  const start = new Date(prevCutoff.getFullYear(), prevCutoff.getMonth(), prevCutoff.getDate() + 1);
  const currentCutoff = cutoffForDate(cutoffDay, t);
  const status: StatementStatus =
    cutoff < currentCutoff ? "closed" : cutoff.getTime() === currentCutoff.getTime() ? "open" : "future";
  const monthLabel = cutoff.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return {
    key: toISODate(cutoff),
    start,
    cutoff,
    due,
    status,
    daysToCutoff: diffDays(t, cutoff),
    daysToDue: diffDays(t, due),
    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    label: `Corte ${formatDateEs(cutoff)} · paga ${formatDateEs(due)}`,
  };
}

/**
 * Statement cycles around today: `back` already-closed ones, the open one,
 * and `forward` upcoming ones. Ordered oldest → newest.
 */
export function listStatementCycles(
  cutoffDay: number,
  dueDay: number,
  opts: { back?: number; forward?: number } = {},
  today = new Date(),
): StatementCycle[] {
  const back = opts.back ?? 3;
  const forward = opts.forward ?? 1;
  const current = cutoffForDate(cutoffDay, startOfDay(today));
  const out: StatementCycle[] = [];
  for (let i = -back; i <= forward; i++) {
    const c = safeDate(current.getFullYear(), current.getMonth() + i, cutoffDay);
    out.push(statementForCutoff(c, cutoffDay, dueDay, today));
  }
  return out;
}

export interface StatementTx extends SpendTx {
  statement_cutoff?: string | null;
}

/** Statement a transaction belongs to: explicit assignment wins, else its date. */
export function txStatementKey(tx: StatementTx, cutoffDay: number): string {
  if (tx.statement_cutoff) return tx.statement_cutoff;
  return toISODate(cutoffForDate(cutoffDay, new Date(tx.occurred_at)));
}

export interface StatementTotals {
  charges: number;
  payments: number;
  net: number;
  count: number;
}

/** Charges (expenses) and payments recorded against a debt, per statement. */
export function statementTotals(
  txs: StatementTx[],
  debtId: string,
  cutoffDay: number,
): Record<string, StatementTotals> {
  const map: Record<string, StatementTotals> = {};
  for (const t of txs) {
    if (t.debt_id !== debtId || !t.include_in_totals) continue;
    if (t.kind !== "expense" && t.kind !== "payment") continue;
    const key = txStatementKey(t, cutoffDay);
    const row = (map[key] ??= { charges: 0, payments: 0, net: 0, count: 0 });
    const amt = Number(t.amount);
    if (t.kind === "expense") row.charges += amt;
    else row.payments += amt;
    row.net = row.charges - row.payments;
    row.count += 1;
  }
  return map;
}
