/**
 * Memoria de asignaciones: emparejar una detección con una regla guardada
 * (ej. comercio "OXXO" → bolsillo "Esenciales") y construir el insert de
 * `transactions` de forma centralizada (la misma forma que usa ApproveDialog).
 */

export type RuleMode = "auto" | "confirm" | "ask";
export type MatchScope = "merchant" | "package";

export const RULE_MODE_LABEL: Record<RuleMode, string> = {
  auto: "Registrar solo",
  confirm: "Confirmar 1 toque",
  ask: "Preguntar siempre",
};

export interface DetectionRule {
  id: string;
  match_scope: MatchScope;
  match_value: string;
  kind: string;
  pocket_id: string | null;
  debt_id: string | null;
  counterparty_id: string | null;
  mode: RuleMode;
}

export interface DetectionLike {
  merchant: string | null;
  package_name: string;
}

/** lower + sin acentos + espacios colapsados. Clave estable para reglas. */
export function normalizeKey(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca una regla que aplique: primero por comercio, luego por app. */
export function matchRule(d: DetectionLike, rules: DetectionRule[]): DetectionRule | null {
  const mk = normalizeKey(d.merchant);
  if (mk) {
    const byMerchant = rules.find((r) => r.match_scope === "merchant" && r.match_value === mk);
    if (byMerchant) return byMerchant;
  }
  const pk = normalizeKey(d.package_name);
  return rules.find((r) => r.match_scope === "package" && r.match_value === pk) ?? null;
}

export interface TxSelection {
  kind: string;
  amount: number;
  description: string;
  notes?: string | null;
  occurredAt: string; // ISO
  pocketId: string | null;
  debtId: string | null;
  counterpartyId: string | null;
}

/** Arma el objeto de inserción para `transactions` (dispara apply_tx_effects). */
export function buildTransactionInsert(userId: string, sel: TxSelection) {
  return {
    user_id: userId,
    amount: sel.amount,
    kind: sel.kind,
    description: sel.description,
    notes: sel.notes ?? null,
    occurred_at: sel.occurredAt,
    pocket_id: sel.pocketId,
    counterparty_id: sel.counterpartyId,
    debt_id: sel.debtId,
    include_in_totals: true,
  };
}
