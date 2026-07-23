# Finance Flow Pocket — Android build guide

Empaquetar la web app como APK Android con lectura de notificaciones bancarias.

## Requisitos (una sola vez)

- **Node/Bun** ya lo usas para el proyecto web.
- **Android Studio** (última estable) → instala también el Android SDK y el Java 21 (viene con Android Studio).
- Variables de entorno (Linux/macOS):
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk        # o la ruta que muestre Android Studio
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
  ```
- Un dispositivo Android con **Depuración USB** activada (Ajustes → Opciones de desarrollador).

## 1. Generar la carpeta `android/`

Solo la primera vez, y también si borras `android/`:

```bash
bun install
npx cap add android
```

Esto crea `android/` (proyecto Gradle) usando `capacitor.config.ts`.

## 2. Copiar el plugin nativo

Los fuentes Kotlin están en `native/android/`. Cópialos al proyecto Gradle recién creado:

```bash
mkdir -p android/app/src/main/java/com/financeflow/pocket/notifications
cp native/android/java/com/financeflow/pocket/notifications/*.kt \
   android/app/src/main/java/com/financeflow/pocket/notifications/
cp native/android/java/com/financeflow/pocket/MainActivity.kt \
   android/app/src/main/java/com/financeflow/pocket/MainActivity.kt
```

> `MainActivity.kt` reemplaza el que generó Capacitor para registrar el plugin.

## 3. Editar el `AndroidManifest.xml`

Abre `android/app/src/main/AndroidManifest.xml` y **fusiona** los bloques de
`native/android/manifest-snippet.xml`:

- Agrega los `<uses-permission>` arriba de `<application>`.
- Agrega el `<service ... NotificationCaptureService>` **dentro** de `<application>`.

## 4. Construir el bundle web + sincronizar

Cada vez que cambies código web:

```bash
bun run build
npx cap sync android
```

`sync` copia `dist/` a `android/app/src/main/assets/public/` y actualiza plugins.

## 5. Generar el APK debug

```bash
cd android
./gradlew assembleDebug
```

APK resultante:
`android/app/build/outputs/apk/debug/app-debug.apk`

## 6. Instalar en tu teléfono

Con el teléfono conectado por USB y depuración activada:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

O copia el APK al teléfono, activa **Ajustes → Seguridad → Orígenes desconocidos**
para el explorador de archivos, y toca el APK.

## 7. Otorgar permiso de notificaciones

Dentro de la app:

1. Ve a **Ajustes → Detección automática (Android)**.
2. Toca **Otorgar acceso a notificaciones**.
3. Android abrirá la lista de listeners → activa **Finance Flow Pocket**.
4. Además: **Ajustes → Batería → Finance Flow Pocket → Sin restricciones**
   (evita que Android mate el servicio).

## 8. Probar

Realiza una compra o recibe una transferencia. En segundos deberías ver la
transacción en la ruta **Bandeja** de la app, lista para aprobar/editar/rechazar.

## Publicar en Play Store (opcional)

Requiere:
- Cuenta de desarrollador ($25 USD, una vez).
- Firmar el APK con un keystore propio (`./gradlew assembleRelease`).
- **Declaración especial** justificando el uso de `BIND_NOTIFICATION_LISTENER_SERVICE`
  (Google es estricto: hay que demostrar que la lectura es esencial para la
  función principal de la app y que solo se procesa lo necesario).

Para uso personal o beta cerrada, con sideload (APK debug) es suficiente.

## Agregar un banco nuevo

1. Reproduce una notificación real del banco en tu teléfono.
2. Filtra Logcat por `NotificationCapture` para ver el texto exacto.
3. Agrega un parser en `native/android/java/com/financeflow/pocket/notifications/BankParsers.kt`:
   - añade el `packageName` a `DEFAULT_WATCHED_PACKAGES`
   - agrega un `parseXxx` con un regex específico
   - regístralo en el mapa `PARSERS`
4. Copia el archivo actualizado a `android/app/src/main/...`, rebuild, reinstala.
