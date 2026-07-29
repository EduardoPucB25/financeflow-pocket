import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "financial_summary",
  title: "Resumen financiero",
  description:
    "Devuelve el resumen del usuario: capital en bolsillos, capital líquido, deuda total y patrimonio neto.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;
    const supabase = supabaseForUser(ctx);
    const [pockets, debts] = await Promise.all([
      supabase.from("pockets").select("name,current_balance,accessibility"),
      supabase.from("debts").select("name,current_balance,status"),
    ]);
    if (pockets.error) return errorResult(pockets.error.message);
    if (debts.error) return errorResult(debts.error.message);
    const totalPockets = (pockets.data ?? []).reduce((s, p) => s + Number(p.current_balance), 0);
    const liquid = (pockets.data ?? [])
      .filter((p) => p.accessibility === "available")
      .reduce((s, p) => s + Number(p.current_balance), 0);
    const totalDebt = (debts.data ?? [])
      .filter((d) => d.status !== "paid")
      .reduce((s, d) => s + Number(d.current_balance), 0);
    const summary = {
      total_pockets: totalPockets,
      liquid_capital: liquid,
      total_debt: totalDebt,
      net_worth: totalPockets - totalDebt,
      currency: "MXN",
    };
    return { ...textResult(summary), structuredContent: summary };
  },
});
