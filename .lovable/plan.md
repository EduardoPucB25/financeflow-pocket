## Diagnóstico

El archivo de migración `supabase/migrations/20260728120000_add_debt_statements.sql` existe en el repositorio (llegó por el sync de GitHub), pero **la tabla nunca se creó en la base de datos**: la consulta a `public.debt_statements` responde `PGRST205 — Could not find the table`. El código del frontend (`StatementsDialog.tsx`, `debtStatementsQuery`) ya está completo y correcto; solo falta el respaldo en base de datos.

## Solución

1. Aplicar la migración de la tabla `debt_statements` con:
   - Campos: deuda asociada, año y mes del periodo, monto, fecha de vencimiento, estado (pendiente/pagado), fecha de pago, movimiento vinculado y notas.
   - Restricción de un solo estado de cuenta por deuda y mes.
   - Permisos de acceso vía API y reglas de seguridad: cada usuario solo ve y gestiona sus propios estados de cuenta.
   - Índices por usuario/vencimiento y por deuda, más actualización automática de la marca de tiempo.

2. Regenerar los tipos de la base de datos y quitar los `as any` / el fallback silencioso de `debtStatementsQuery` en `src/lib/queries.ts`, ya que la tabla pasará a existir de verdad y conviene que los errores reales sí se muestren.

3. Verificar en la preview: crear un estado de cuenta en una tarjeta, pagarlo desde un bolsillo y deshacer el pago, confirmando que saldo del bolsillo y de la deuda se ajustan.

### Detalles técnicos

- La migración es idéntica al SQL ya versionado en el repo (mismo nombre de archivo y contenido), por lo que el repositorio y la base quedan consistentes.
- El pago sigue usando el trigger existente `tx_balance_sync` mediante una transacción `kind = 'payment'`; no se toca esa lógica.
