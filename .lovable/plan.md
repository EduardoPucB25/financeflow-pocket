# Detección de movimientos: bandeja más lista y selector de apps más simple

## Lo que encontré al revisar el repo y la base de datos

- Los últimos commits (`282cb39`, `5231a36`) sí traen el soporte de Revolut (parser nativo + clasificador web ES/EN) y el asistente de movimientos.
- **Bloqueante real de la pantalla de error del celular:** las tablas del asistente nunca se aplicaron a la base. En la base existen 11 tablas y **no está `detection_rules`**, y en `profiles` **no existen** `detection_default_mode` ni `detection_autopilot`. Por eso sale "Could not find the table 'public.detection_rules'".
- `detected_transactions` hoy solo guarda: monto, moneda, comercio, tipo, texto crudo, app y fecha de la notificación. No hay campo para quién envía, a qué cuenta llegó, ni la fecha/hora que viene escrita dentro del mensaje.
- El selector de apps hoy lista todas las apps instaladas (24 de 108) mezcladas con las de banco, y muestra el nombre de paquete en cada renglón.

## Qué se va a hacer

### 1. Aplicar lo que falta en la base (primero, desbloquea la app)
- Crear `detection_rules` con sus permisos y reglas de acceso (cada quien ve solo lo suyo).
- Agregar a `profiles` las preferencias del asistente (modo por defecto y "registrar automáticamente").
- Activar tiempo real en las detecciones para que aparezcan al instante en web y APK.

### 2. Guardar más datos de cada notificación
Nuevos campos en las detecciones:
- **Quién envía / recibe** (`sender_name`) y si ese nombre es el propio usuario (`is_self_transfer`).
- **Cuenta o app destino** (`account_hint`, ej. "Nu", "BBVA ...1234").
- **Fecha y hora leídas del mensaje** (`occurred_at`), separadas de la hora en que llegó la notificación.
- **Dirección** (entrada / salida) y **confianza** de la lectura.
- En `profiles`, una lista de **alias propios** (nombres con los que aparece el usuario en sus bancos) para reconocer traspasos entre sus propias cuentas.

### 3. Mejorar el lector de mensajes
Ampliar el clasificador (`src/lib/detection/classify.ts`) para entender frases tipo
`"Eduardo hizo una transferencia a tu cuenta Nu de 200 el 01/08/26 10:15"`:
- Nombre de la persona/comercio (antes de "te envió", "hizo una transferencia", "de parte de", "from", "to").
- Monto y moneda (ya funciona, se afina).
- Fecha en formatos `01-08-26`, `01/08/2026`, `1 de agosto de 2026`, `hoy`, `ayer`, y hora `10:15`, `10:15 a.m.`.
- Cuenta/banco mencionado en el texto.
- Palabras clave de entrada/salida: pago, ingreso, te enviaron, enviaste, pagaste, recibiste, depósito, cobro, retiro, compra, más equivalentes en inglés (Revolut).
- Perfiles por app para **BBVA, Nu, Revolut, DiDi y Mercado Pago** (agrego DiDi al catálogo y a la lista vigilada por defecto).

### 4. Selector de apps más limpio
En Ajustes:
- De inicio se muestran **solo las apps ya seleccionadas** (chips con nombre y logo/emoji, con opción de quitar).
- Botón **"Agregar app"** abre un diálogo con **solo apps de banco o billetera**, mostrando el **nombre** (no el paquete). El filtro combina el catálogo conocido con las apps instaladas que hagan match por nombre/paquete de banco.
- El campo de paquete manual queda escondido bajo "Avanzado", para casos raros.

### 5. Bandeja de entrada más útil
En `/inbox` cada detección mostrará: app, quién envía, monto, fecha/hora del mensaje, cuenta destino, y una etiqueta **"Entre mis cuentas"** cuando el nombre coincida con un alias propio. Un toque para elegir **bolsillo** (o deuda) y registrar, con la opción de recordar la regla como ya existe.

## Nota sobre el aviso en el celular
El "avisito de la app para registrar el movimiento" al llegar la transferencia necesita una notificación local del lado nativo (Android). Puedo dejar el código web listo y la pieza nativa escrita en `native/android/`, pero **el APK hay que recompilarlo localmente** para que aparezca esa notificación. Mientras tanto, con la app abierta seguirá saliendo el aviso emergente actual.

## Detalles técnicos
- Migración con `CREATE TABLE` + `GRANT` + RLS por usuario en `detection_rules`; `ALTER TABLE` para los nuevos campos de `detected_transactions` y `profiles`.
- Se regeneran los tipos de la base y se eliminan los `as any` temporales de `useNotificationCapture.ts`.
- Nuevo módulo `src/lib/detection/parse.ts` (nombre, fecha/hora, cuenta) usado tanto por el clasificador como por la bandeja; `apps.ts` gana `kind: "bank" | "wallet"` para filtrar el selector.
- El parser nativo (`BankParsers.kt`) queda como primer vistazo; la lógica fina vive en el web para poder afinarla sin recompilar el APK.
