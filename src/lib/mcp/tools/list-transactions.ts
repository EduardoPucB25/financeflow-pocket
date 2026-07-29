import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "Listar movimientos",
  description:
    "Lista los movimientos (gastos, ingresos, pagos, transferencias) del usuario, opcionalmente filtrados por fecha o tipo.",
  inputSchema: {
    since: z.string().optional().describe("Fecha ISO (yyyy-mm-dd) desde la cual listar."),
    until: z.string().optional().describe("Fecha ISO (yyyy-mm-dd) hasta la cual listar."),
    kind: z
      .enum(["expense", "income", "payment", "transfer", "adjustment"])
      .optional()
      .describe("Tipo de movimiento a filtrar."),
    limit: z.number().int().optional().describe("Máximo de filas a devolver (por defecto 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ since, until, kind, limit }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;
    const max = Math.min(Math.max(limit ?? 50, 1), 200);
    let q = supabaseForUser(ctx)
      .from("transactions")
      .select(
        "id,description,amount,kind,occurred_at,pocket_id,debt_id,statement_cutoff,purpose,include_in_totals,notes",
      )
      .order("occurred_at", { ascending: false })
      .limit(max);
    if (since) q = q.gte("occurred_at", since);
    if (until) q = q.lte("occurred_at", until);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ transactions: data ?? [] });
  },
});
