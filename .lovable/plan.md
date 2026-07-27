## Qué encontré (verificado)

- **Bug del día de corte**: en `debts.tsx` el formulario de edición inicializa su estado una sola vez al montarse y nunca se vuelve a sincronizar con los datos guardados. Al reabrir la ventana ves valores viejos aunque la base sí guardó el cambio (confirmé en la base: "Pago Revolut Julio" y "Junio" ya tienen corte 12 / pago 3).
- **Invisible Cash negativo**: las 4 tarjetas tienen `credit_limit = 0`, y el cálculo es `límite − saldo`, por eso sale `-$3,763.18`. Falta validar el límite y ocultar el dato cuando no está definido.
- **Los movimientos no afectan nada**: `transactions` ya guarda `pocket_id` y `debt_id`, pero ningún saldo de bolsillo ni de tarjeta se recalcula al registrar un gasto.
- **Bolsillos**: solo existe `is_locked_savings`; no hay concepto de "para qué sirve" ni de "cuenta para rendimientos".

---

## 1. Base de datos

**Bolsillos** — nuevas columnas:
- `purpose`: gasto / ahorro / inversión / reserva
- `accessibility`: disponible / restringido / bloqueado
- `earns_yield` (sí/no) y `yield_rate` propio (si se deja vacío, usa el general del perfil)
- `yield_start_date` y `yield_base_balance`: punto de partida del interés compuesto
- `spend_limit_daily`, `spend_limit_weekly`, `spend_limit_monthly`

**Deudas** — nuevas columnas:
- `statement_balance` (saldo del último corte, lo que realmente se paga)
- `spend_limit_daily`, `spend_limit_weekly`, `spend_limit_monthly`
- `auto_apply_transactions` (sí/no)

**Perfil** — `global_spend_limit_monthly` y `net_worth_note`.

Todas con valores por defecto para no romper registros actuales.

**Automatización de saldos**: un disparador en la base ajusta saldos al insertar, editar o borrar un movimiento:
- Gasto con bolsillo → resta del bolsillo
- Gasto con tarjeta → suma al saldo de la tarjeta
- Pago de deuda → resta del bolsillo y baja el saldo de la tarjeta
- Ingreso con bolsillo → suma al bolsillo
- Movimientos marcados "no cuenta" se ignoran

Los campos de saldo pasan a ser de solo lectura en la interfaz (con un botón "ajustar saldo" que crea un movimiento de ajuste, para que todo quede trazable).

---

## 2. Deudas — correcciones y precisión

- Arreglar el formulario para que siempre cargue los valores actuales al abrirlo.
- Mostrar **fechas reales** en vez de solo días: "Corte: 12 ago 2026 · Pago: 3 sep 2026 (en 37 días)".
- Validar límite de crédito: si es 0 o vacío, se pide y no se muestra Invisible Cash negativo.
- Nueva sección por tarjeta: **crédito disponible** = límite − saldo, con barra de uso y el saldo del corte separado del saldo actual.
- **Simulador de crédito disponible**: cuánto puedes gastar hoy / esta semana / este mes sin pasarte, calculado con el disponible real y los días que faltan al corte y al pago.
- **Alertas**: aviso ámbar al 75% del límite de gasto configurado y rojo al superarlo, tanto por tarjeta como global.

---

## 3. Bolsillos con función y accesibilidad

- Cada bolsillo declara su **función** (gasto / ahorro / inversión / reserva) y su **accesibilidad** (disponible, restringido, bloqueado), con agrupación visual: "Disponible para gastar" vs "No disponible".
- Interruptor **"Cuenta para rendimientos"** con su propia tasa opcional.
- Presupuesto por bolsillo con límite diario/semanal/mensual y barra de consumo del periodo actual, calculada con los movimientos reales ligados a ese bolsillo.

---

## 4. Capital y Patrimonio (nueva pantalla `/patrimonio`)

- **Patrimonio neto** = bolsillos − deudas, con su evolución.
- **Capital líquido** = solo bolsillos accesibles.
- **Diferencia de gastos**: comparativa ingresos vs gastos del periodo actual contra el anterior (variación en $ y %), desglose por categoría, por bolsillo y por tarjeta.
- Gráfica de barras ingresos/gastos y línea de patrimonio.

---

## 5. Rendimiento aplicable (interés compuesto diario)

- Se calcula al vuelo: desde `yield_start_date` y `yield_base_balance`, con la tasa del bolsillo, hasta hoy. Cada día que pasa el rendimiento sube solo, sin procesos nocturnos.
- Botón **"Aplicar rendimiento"** en el balance: fija la fecha y el monto base para empezar a acumular; y **"Reiniciar base"** cuando cambie el saldo.
- Etiqueta visible en todos lados: *"Representación estimada para cálculos — no refleja el rendimiento real de tu banco."*
- El Balance total del panel gana un selector para elegir qué bolsillos entran al cálculo de rendimientos (se recuerda la selección).

---

## 6. Proyecciones ligadas a la selección

- La proyección deja de usar "todos los bolsillos" y usa solo los marcados para rendimiento.
- Vista **individual por bolsillo** (una línea por bolsillo con su propia tasa) y vista **en conjunto**.
- El simulador existente puede precargar un bolsillo real como punto de partida.

---

## Detalles técnicos

- Migración con las columnas nuevas + disparador `apply_transaction_effects` (insert/update/delete) sobre `transactions`, con `GRANT` correspondientes.
- Nuevos helpers en `src/lib/finance.ts`: `nextCutoffAndDue` (fechas reales, corrige el redondeo actual), `accruedYield`, `safeToSpend`, `periodSpend`.
- Nuevo `src/lib/netWorth.ts` para patrimonio y comparativas de periodo.
- Nueva ruta `src/routes/_authenticated/networth.tsx` + entrada en el menú.
- Reescritura parcial de `debts.tsx` (formulario sincronizado, fechas, alertas), `pockets.tsx` (función/accesibilidad/rendimiento/presupuesto), `dashboard.tsx` (selector de rendimiento, tarjeta de patrimonio) y `simulator.tsx` (proyección individual y conjunta).
- Se mantienen los límites del plan gratuito y el bloqueo Pro actual de Invisible Cash.
