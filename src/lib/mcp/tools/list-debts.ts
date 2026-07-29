import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_debts",
  title: "Listar deudas y tarjetas",
  description:
    "Lista las deudas y tarjetas de crédito del usuario con saldo actual, saldo del corte, límite y días de corte/pago.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;
    const { data, error } = await supabaseForUser(ctx)
      .from("debts")
      .select(
        "id,name,debt_type,status,current_balance,statement_balance,credit_limit,cutoff_day,due_day,interest_rate,minimum_payment,target_payoff_date",
      )
      .order("created_at");
    if (error) return errorResult(error.message);
    const debts = (data ?? []).map((d) => ({
      ...d,
      available_credit:
        d.credit_limit && d.credit_limit > 0 ? Number(d.credit_limit) - Number(d.current_balance) : null,
    }));
    return textResult({ debts });
  },
});
