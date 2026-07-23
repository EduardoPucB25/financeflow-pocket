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

/** Days until the next payday given day-of-month schedule. */
export function daysUntilPayday(days: number[], today = new Date()): number {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const upcoming: Date[] = [];
  for (const day of days) {
    const thisMonth = new Date(y, m, day);
    const nextMonth = new Date(y, m + 1, day);
    upcoming.push(day >= d ? thisMonth : nextMonth);
  }
  upcoming.sort((a, b) => a.getTime() - b.getTime());
  return Math.round((upcoming[0].getTime() - today.getTime()) / 86400000);
}
