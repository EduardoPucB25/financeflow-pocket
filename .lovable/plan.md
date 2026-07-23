# Plan: APK Android + Plugin de Lectura de Notificaciones

Objetivo: convertir Finance Flow Pocket en app descargable Android (APK) que lea notificaciones del sistema (solo bancos / pagos / transferencias), parsee monto + comercio + tipo, y las envíe a la web app como transacciones borrador para que el usuario confirme.

## Alcance

Incluye:
- Empaquetado Capacitor (Android). iOS queda fuera (iOS no permite leer notificaciones de otras apps).
- Plugin nativo Kotlin usando `NotificationListenerService`.
- Filtro por paquetes bancarios/pagos (BBVA, Santander, Banorte, Nu, Mercado Pago, etc. — lista configurable).
- Parser de texto (regex) por banco para extraer: monto, moneda, comercio/persona, tipo (cargo/abono/transferencia), fecha.
- Bandeja "Transacciones detectadas" en la web app → usuario confirma / edita / descarta → se inserta en `transactions`.
- Build de APK debug firmado localmente para instalar por sideload.

Fuera de alcance (fases futuras):
- Publicación en Play Store (requiere justificación especial para permiso `BIND_NOTIFICATION_LISTENER_SERVICE` + cuenta developer $25).
- iOS.
- OCR de SMS / lectura de correos.
- Sincronización offline avanzada (usaremos la sesión Supabase existente + cola simple).

## Arquitectura

```text
[Notificación banco] 
      ↓
NotificationListenerService (Kotlin, background)
      ↓ filtra por packageName ∈ WATCHED_APPS
BankNotificationParser (regex por banco → {amount, merchant, type, currency})
      ↓
Capacitor Plugin bridge → JS event "bankNotification"
      ↓
Web app (React) recibe → guarda en tabla detected_transactions (status=pending)
      ↓
UI "Bandeja de detección" → usuario aprueba → INSERT en transactions + delete pending
```

## Fases

### Fase 1 — Capacitor base
- `bun add @capacitor/core @capacitor/cli @capacitor/android`
- `npx cap init "Finance Flow Pocket" com.financeflow.pocket --web-dir=dist`
- Configurar `capacitor.config.ts` con `server.androidScheme=https` y (para dev) `server.url` apuntando al preview.
- `npx cap add android` genera carpeta `android/`.
- Ajustar `AndroidManifest.xml`: `INTERNET`, `POST_NOTIFICATIONS`, y el permiso especial `BIND_NOTIFICATION_LISTENER_SERVICE` en el `<service>`.
- Script `build:android` que hace `vite build && cap sync android`.

### Fase 2 — Plugin nativo Kotlin
Estructura en `android/app/src/main/java/com/financeflow/pocket/notifications/`:
- `NotificationCaptureService.kt` — extiende `NotificationListenerService`. En `onNotificationPosted`:
  - Verifica `sbn.packageName` contra allowlist.
  - Extrae `extras.getString(Notification.EXTRA_TITLE / EXTRA_TEXT / EXTRA_BIG_TEXT)`.
  - Llama a `BankParsers.parse(pkg, title, text)`.
  - Si hay match → `NotificationBridge.emit(payload)`.
- `BankParsers.kt` — mapa `packageName → List<Regex>` con parsers específicos. Estructura extensible.
- `NotificationCapturePlugin.kt` — `@CapacitorPlugin(name="NotificationCapture")` expone:
  - `isPermissionGranted()` — revisa `NotificationManagerCompat.getEnabledListenerPackages`.
  - `openPermissionSettings()` — lanza `ACTION_NOTIFICATION_LISTENER_SETTINGS`.
  - `setWatchedPackages({packages: string[]})` — guarda en SharedPreferences.
  - Evento `bankNotification` con `{packageName, amount, currency, merchant, type, rawText, timestamp}`.
- Registrar plugin en `MainActivity.kt`.

### Fase 3 — Puente TS + hook React
- `src/lib/native/notificationCapture.ts` — wrapper tipado:
  ```ts
  registerPlugin<NotificationCapturePlugin>('NotificationCapture')
  ```
- `src/hooks/useNotificationCapture.ts`:
  - Detecta plataforma nativa (`Capacitor.isNativePlatform()`).
  - Suscribe a `bankNotification` → inserta en `detected_transactions`.
  - Expone `permissionGranted`, `requestPermission()`, `watchedApps`.

### Fase 4 — Backend (tabla borrador)
Migración nueva:
- Tabla `detected_transactions`: `id, user_id, amount, currency, merchant, type, raw_text, package_name, detected_at, status ('pending'|'approved'|'rejected'), approved_transaction_id`.
- RLS + GRANTs siguiendo convención del proyecto.
- Índice por `user_id, status, detected_at desc`.

### Fase 5 — UI de aprobación
- Ruta nueva `src/routes/_authenticated/inbox.tsx` "Bandeja de detección":
  - Lista de pendientes con monto, comercio parseado, texto crudo colapsable.
  - Botones: Aprobar (abre dialog con pocket/categoría/contraparte pre-rellenados) → INSERT en `transactions`, marca pending como approved.
  - Rechazar → status=rejected.
  - Editar antes de aprobar.
- Badge con contador en sidebar/bottom-nav.
- En `settings.tsx`: sección "Detección automática (Android)" que sólo aparece en nativo, con:
  - Estado del permiso + botón "Otorgar acceso a notificaciones".
  - Lista editable de apps vigiladas (nombre + package).

### Fase 6 — Build & distribución
- Documento `docs/android-build.md` con pasos:
  1. `bun run build`
  2. `npx cap sync android`
  3. `cd android && ./gradlew assembleDebug`
  4. APK en `android/app/build/outputs/apk/debug/app-debug.apk`
  5. Sideload: activar "orígenes desconocidos" e instalar.
- Nota clara al usuario: para producción hay que firmar con keystore propio y (si va a Play Store) justificar el permiso.

## Detalles técnicos

- **Parsers iniciales** (allowlist configurable en runtime, valores por defecto):
  - `com.bbva.bbvacontigo` — `/Cargo por \$([\d,.]+) en (.+?)\./`
  - `mx.com.santander.appsantander` — patrones de "Compra", "Transferencia recibida".
  - `com.banorte.rmb.movil`
  - `com.nu.production`
  - `com.mercadopago.wallet`
  - Fallback genérico: detectar `\$[\d,]+\.\d{2}` + palabras clave (`compra`, `cargo`, `abono`, `transfer`).
- Los parsers viven en Kotlin (rápido, sin depender de red). Estructura permite agregar más sin tocar el service.
- **Privacidad**: `rawText` se guarda cifrado en reposo (Supabase default) y sólo el `user_id` dueño lo lee (RLS). Nada sale del dispositivo salvo hacia el backend del propio usuario.
- **Dev loop**: `capacitor.config.ts` con `server.url = 'https://id-preview--…lovable.app'` permite iterar UI sin rebuild; para probar el plugin nativo sí hay que reconstruir el APK.
- **Duplicados**: dedupe por `(package_name, raw_text, floor(timestamp / 60s))` antes de insertar en pending.

## Riesgos y limitaciones

- Android puede matar el listener si el usuario restringe batería → agregar guía "excluir de optimización de batería".
- Cada banco cambia formato de notificación ocasionalmente → parsers versionados; si no matchea, la notificación cae como "detectada sin parsear" para que el usuario la complete manualmente en vez de perderla.
- El permiso `BIND_NOTIFICATION_LISTENER_SERVICE` requiere que el usuario lo active a mano en Ajustes del sistema (Android no permite prompt directo).
- iOS: no viable. Si algún día se necesita, sería vía Shortcuts + compartir manual.

## Entregables al terminar

- APK debug instalable.
- Plugin `NotificationCapture` funcionando con al menos 2 bancos parseados.
- Bandeja de detección con flujo aprobar/rechazar.
- Documento de build y de cómo agregar un nuevo parser.

## Preguntas antes de implementar

1. ¿Qué bancos/apps de pago usas tú específicamente? (Para priorizar parsers reales: BBVA, Santander, Nu, Mercado Pago, otros).
2. ¿Quieres que las notificaciones detectadas se auto-aprueben si el parser tiene alta confianza, o siempre pasar por bandeja manual? (Recomiendo bandeja manual al inicio).
3. ¿Necesitas que también capture SMS bancarios, o sólo notificaciones push de apps?
