import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_pockets",
  title: "Listar bolsillos",
  description: "Lista los bolsillos (apartados) del usuario con saldo, propósito y accesibilidad.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;
    const { data, error } = await supabaseForUser(ctx)
      .from("pockets")
      .select(
        "id,name,current_balance,target_percentage,purpose,accessibility,earns_yield,yield_rate,spend_limit_daily,spend_limit_weekly,spend_limit_monthly",
      )
      .order("sort_order");
    if (error) return errorResult(error.message);
    return textResult({ pockets: data ?? [] });
  },
});
