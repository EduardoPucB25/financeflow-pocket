Plan: Monetizar Finance Flow Pocket con suscripción Pro

1. Proveedor y verificación previa
   - Recomendación del sistema: Paddle (Merchant of Record) por calificación de producto.
   - Alternativa: Stripe con cálculo/recaudación de impuestos automático (no full compliance handling para México).
   - Prerrequisito: confirmar que tienes un plan Lovable Pro o superior (Payments lo requiere).
   - Paddle creará un sandbox de pruebas inmediatamente; pagos en vivo requieren verificación posterior.

2. Esquema de productos y precios
   - Crear en Paddle dos planes Pro:
     - Pro Mensual: ~$79 MXN / mes.
     - Pro Anual: ~$790 MXN / año (2 meses gratis).
   - Cada producto incluirá tax code para servicio de software (SaaS).

3. Backend: entitlements y suscripciones
   - Migrar tabla `subscriptions` (`user_id`, `status`, `plan`, `paddle_subscription_id`, `current_period_end`, etc.).
   - Migrar `profiles` con columnas `plan` (free|pro) y `pro_expires_at` para gating rápido.
   - GRANTs y RLS: solo el usuario puede leer su propia suscripción; el webhook usa `service_role`.

4. Gating de funciones (freemium)
   - Free: hasta 2 bolsillos, calculadora de interés compuesto básica, registro manual de transacciones.
   - Pro: bolsillos ilimitados, simulador avanzado con retiros periódicos, estrategia Invisible Cash (cálculo de periodo de gracia) y detección automática de notificaciones Android.
   - Añadir `isPro` helper y mostrar badges/CTAs de upgrade en cada ruta protegida.

5. Checkout y UI de upgrade
   - Página/ruta `/upgrade` con tarjetas de planes y botón de checkout.
   - Botón de suscripción redirige a Paddle Checkout (overlay o redirect).
   - Mostrar estado de suscripción actual en `/settings`.

6. Webhook Paddle
   - Ruta pública `/api/public/webhooks/paddle`.
   - Verificar firma del webhook con `PADDLE_WEBHOOK_SECRET`.
   - Manejar eventos: `checkout.completed`, `subscription.activated`, `subscription.updated`, `subscription.canceled`.
   - Actualizar tabla `subscriptions` y campo `plan` en `profiles`.

7. Testing y go-live
   - Probar checkout con tarjetas de prueba de Paddle.
   - Confirmar que el webhook actualiza el estado del usuario.
   - Una vez validado, pasar Paddle a live y completar verificación del vendedor.

Pregunta de decisión: ¿Confirmas Paddle como proveedor para empezar, o prefieres Stripe? Paddle es la recomendación porque actúa como vendedor legal y maneja impuestos/compliance automáticamente.