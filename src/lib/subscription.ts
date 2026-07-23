/** Central subscription helpers so gating logic stays in one place. */

export const FREE_LIMITS = {
  pockets: 2,
  debts: 2,
  flows: 3,
} as const;

type SubRow = {
  status: string | null;
  current_period_end: string | null;
} | null | undefined;

export function deriveSubStatus(sub: SubRow) {
  if (!sub) return { isPro: false, isPastDue: false, isCanceling: false };
  const now = new Date();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const isActive = sub.status === "active" || sub.status === "trialing";
  const isPastDue = sub.status === "past_due";
  const isCanceling = sub.status === "canceled" && !!periodEnd && periodEnd > now;
  // past_due keeps access while Paddle retries payment.
  const isPro = isActive || isPastDue || isCanceling;
  return { isPro, isPastDue, isCanceling };
}

/** Slice rows to the free plan limit (oldest first, so the excess is what's newer). */
export function limitForFree<T extends { created_at?: string | null }>(
  rows: T[],
  isPro: boolean,
  limit: number,
): { visible: T[]; hiddenCount: number } {
  if (isPro) return { visible: rows, hiddenCount: 0 };
  const sorted = [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  return {
    visible: sorted.slice(0, limit),
    hiddenCount: Math.max(0, sorted.length - limit),
  };
}
