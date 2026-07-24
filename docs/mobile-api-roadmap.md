# Roadmap de API para la app móvil — Finance Flow Pocket

Mejoras **funcionales** (nada visual) para solicitar en Lovable. Cada una indica por qué
importa en la experiencia móvil y qué pedir concretamente (tablas · funciones · endpoints).

La app móvil es el APK de Capacitor que carga la web publicada; todo lo listado aquí es
trabajo de backend (Supabase/Edge Functions) que potencia esa experiencia.

---

## P0 — Crítico

### 1. Notificaciones push (FCM)
- **Por qué (móvil):** sin recordatorios oportunos (llegó la quincena, se acerca el corte
  de una tarjeta, hay detecciones pendientes en la bandeja) la app no genera hábito.
- **Qué pedir:**
  - Tabla `push_tokens (user_id, token, platform, updated_at)` con RLS por usuario.
  - Endpoint/función para registrar y rotar el token del dispositivo.
  - Jobs programados (pg_cron o Edge Function programada) que disparen FCM:
    día de quincena, N días antes de cada fecha de corte, y resumen de pendientes.

### 2. Idempotencia de detecciones (sync offline)
- **Por qué (móvil):** el listener nativo de notificaciones puede reenviar la misma
  notificación tras una reconexión o reinicio del servicio; hoy la deduplicación es
  solo de corto plazo en el cliente.
- **Qué pedir:**
  - Columna única `dedupe_hash` en `detected_transactions` (hash de
    package + texto + timestamp redondeado) y upsert `on conflict do nothing`.

### 3. Eliminación de cuenta
- **Por qué (móvil):** requisito obligatorio de Google Play (y LFPDPPP/GDPR) para
  publicar la app. Sin esto no pasa revisión de la tienda.
- **Qué pedir:**
  - Edge Function `delete_account`: borra datos del usuario en cascada
    (profiles, pockets, transactions, detected_transactions, debts, subscriptions,
    billing_events, etc.) y elimina el usuario de auth.
  - URL pública de solicitud de eliminación (Play Console la pide).

### 4. Categorías + reglas de auto-categorización
- **Por qué (móvil):** convierte la bandeja de detecciones en un triage de un toque —
  la app ya sabe que "OXXO" es "Comida/Conveniencia" y solo pides confirmar.
- **Qué pedir:**
  - Tabla `categories (id, user_id, name, icon, color)`.
  - Tabla `categorization_rules (user_id, matcher_type: merchant|package|regex, pattern, category_id)`.
  - Aplicación de reglas al insertar en `detected_transactions` y al aprobar.

---

## P1 — Alto valor

### 5. Fechas de corte/pago por tarjeta + Invisible Cash en servidor
- **Por qué (móvil):** es la promesa central de la app; calculado en servidor queda
  consistente para push, widget y web.
- **Qué pedir:** columnas `cut_day`/`payment_day` en `credit_cards` + función o vista
  `invisible_cash(user_id)` que calcule el disponible por periodo de gracia.

### 6. Presupuestos por categoría
- **Por qué (móvil):** la decisión de gasto ocurre en el momento; hace falta un semáforo
  de "cuánto me queda este mes en X".
- **Qué pedir:** tabla `budgets (user_id, category_id, month, amount)` + vista de gasto
  acumulado mensual por categoría.

### 7. Metas de ahorro por bolsillo
- **Por qué (móvil):** refuerza el loop de progreso (barra de meta al abrir la app).
- **Qué pedir:** columnas `target_amount`/`target_date` en `pockets` + progreso derivado.

### 8. Endpoint ligero de resumen
- **Por qué (móvil):** habilita un futuro widget de Android y arranque instantáneo
  (pintar datos clave antes de cargar todo).
- **Qué pedir:** Edge Function `GET /summary` que devuelva JSON < 1 KB:
  efectivo disponible, invisible cash, pendientes en bandeja, próximo corte.

---

## P2 — Deseable

### 9. Export CSV
- **Por qué:** portabilidad y confianza; en móvil se comparte vía share sheet.
- **Qué pedir:** Edge Function que genere CSV por rango de fechas con URL temporal firmada.

### 10. Gestión de sesiones/dispositivos
- **Por qué:** el token de sesión vive en un teléfono que se puede perder o robar.
- **Qué pedir:** listado de sesiones activas por usuario + revocación remota.

### 11. Multi-moneda
- **Por qué:** usuarios MX con cuentas/suscripciones en USD.
- **Qué pedir:** campo `currency` consistente en tablas de dinero + tabla de tipos de
  cambio diarios.

---

## Seguimientos nativos (requieren recompilar el APK — no son de Lovable)

- Reemplazar el `splash.png` nativo de Capacitor (11 densidades en
  `android/app/src/main/res/drawable*`, referenciado por `values/styles.xml`) con arte
  estático de FinFloPo, para continuidad visual splash nativo → splash web animado.
- `@capacitor/status-bar`: colorear la barra de estado (#0F172A).
- `@capacitor/app`: manejar el botón atrás de Android integrado con el router
  (hoy aplica el goBack por defecto del WebView).
- (Opcional) `@capacitor/splash-screen` para controlar el fade del splash nativo.
