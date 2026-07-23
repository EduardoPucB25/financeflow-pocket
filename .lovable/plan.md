## Objetivo

Agregar una sección de descarga del APK Android en el home (`/`) de Finance Flow Pocket, para que cualquier visitante pueda bajarlo e instalarlo y usar la lectura de notificaciones bancarias.

## Alcance

- Solo Android APK (sin PWA, sin iOS).
- Descarga directa del archivo `.apk` alojado dentro del proyecto.
- Mensaje claro de propósito: lectura local de notificaciones (montos y transacciones), sin rastreo, sin envío a terceros.

## Cambios

### 1. Alojar el APK
- Crear carpeta `public/downloads/` y colocar ahí `finance-flow-pocket.apk`.
  - El archivo binario se sube manualmente (yo no puedo generarlo — requiere Android Studio; ver `docs/android-build.md`).
  - Servido en `/downloads/finance-flow-pocket.apk`.
- Añadir versión visible (ej. `v0.1.0`) en el botón, gestionada como constante en el componente.

### 2. Nueva sección en `src/routes/index.tsx`
Insertar bloque "Descarga la app Android" antes del footer con:
- Título + subtítulo bilingüe corto.
- Botón principal: **Descargar APK (Android)** → `<a href="/downloads/finance-flow-pocket.apk" download>`.
- Chip de versión y tamaño aproximado.
- Bullets de garantías de privacidad:
  - Lee solo notificaciones de apps bancarias que tú autorices.
  - Extrae únicamente monto, comercio y tipo de movimiento.
  - Los datos se guardan en tu cuenta, no se comparten con terceros.
  - No es rastreo: puedes revocar el permiso desde Ajustes de Android en cualquier momento.
- Enlace secundario "Cómo instalar" que abre un `<Dialog>` (shadcn) con pasos:
  1. Descargar el APK.
  2. Permitir "Orígenes desconocidos" para el navegador/archivador.
  3. Abrir el APK e instalar.
  4. En la app, ir a Ajustes → Detección automática → otorgar acceso a notificaciones.
- Nota: "iOS no soporta lectura de notificaciones de otras apps por restricciones de Apple."

### 3. Estilo
- Reutilizar el look glass del home (`bg-card/70 backdrop-blur-md border-border/60`).
- Icono `Download` de `lucide-react`.
- Mantener fondo cósmico ya existente.

### 4. Nada de PWA
- No agregar manifest de instalación, service worker ni prompts de "Add to Home Screen" (regla del proyecto para no romper el preview de Lovable).

## Fuera de alcance

- Generar el APK automáticamente (sigue siendo build local con `docs/android-build.md`).
- Firmar/subir a Play Store.
- Versión iOS.
- Auto-update del APK.

## Nota importante

Para que el botón funcione realmente, tú debes generar el APK localmente siguiendo `docs/android-build.md` y subir el archivo a `public/downloads/finance-flow-pocket.apk`. Mientras no exista, el botón devolverá 404. ¿Quieres que además muestre un estado "Próximamente" si el archivo no existe, o lo dejamos como enlace directo asumiendo que subirás el APK?
