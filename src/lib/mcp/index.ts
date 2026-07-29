import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPockets from "./tools/list-pockets";
import listDebts from "./tools/list-debts";
import listTransactions from "./tools/list-transactions";
import recordTransaction from "./tools/record-transaction";
import financialSummary from "./tools/financial-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "finance-flow-poket",
  title: "Finance Flow Poket",
  version: "0.1.0",
  instructions:
    "Herramientas de Finance Flow Pocket: consulta bolsillos, deudas y tarjetas, movimientos y el resumen de patrimonio del usuario autenticado, y registra nuevos movimientos (los saldos se ajustan automáticamente).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [financialSummary, listPockets, listDebts, listTransactions, recordTransaction],
});
