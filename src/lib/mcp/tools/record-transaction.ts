import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "record_transaction",
  title: "Registrar movimiento",
  description:
    "Registra un movimiento (gasto, ingreso, pago, transferencia o ajuste). Los saldos del bolsillo o la deuda se ajustan automáticamente.",
  inputSchema: {
    description: z.string().describe("Descripción corta del movimiento."),
    amount: z.number().describe("Monto positivo del movimiento."),
    kind: z
      .enum(["expense", "income", "payment", "transfer", "adjustment"])
      .describe("Tipo de movimiento."),
    occurred_at: z.string().optional().describe("Fecha ISO (yyyy-mm-dd). Por defecto hoy."),
    pocket_id: z.string().optional().describe("UUID del bolsillo afectado."),
    debt_id: z.string().optional().describe("UUID de la deuda o tarjeta afectada."),
    statement_cutoff: z
      .string()
      .optional()
      .describe("Fecha ISO del corte al que se asigna el movimiento en la tarjeta."),
    notes: z.string().optional().describe("Notas adicionales."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;
    if (!(input.amount > 0)) return errorResult("El monto debe ser mayor a cero.");
    const { data, error } = await supabaseForUser(ctx)
      .from("transactions")
      .insert({
        user_id: ctx.getUserId(),
        description: input.description,
        amount: input.amount,
        kind: input.kind,
        occurred_at: input.occurred_at ?? new Date().toISOString().slice(0, 10),
        pocket_id: input.pocket_id ?? null,
        debt_id: input.debt_id ?? null,
        statement_cutoff: input.statement_cutoff ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) return errorResult(error.message);
    return { ...textResult({ transaction: data }), structuredContent: { transaction: data } };
  },
});
