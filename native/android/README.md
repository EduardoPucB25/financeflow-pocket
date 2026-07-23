# Android native sources (Finance Flow Pocket)

These are the Kotlin sources for the `NotificationCapture` Capacitor plugin.
They live outside the Capacitor-generated `android/` folder so the web
sandbox can ship them; you copy them in **after** running `npx cap add android`
locally (which needs the Android SDK).

See `docs/android-build.md` for the full step-by-step build & install guide.

## Layout

```
native/android/
├── java/                      → copy into android/app/src/main/java/
│   └── com/financeflow/pocket/
│       ├── notifications/
│       │   ├── NotificationCaptureService.kt
│       │   ├── NotificationCapturePlugin.kt
│       │   ├── BankParsers.kt
│       │   └── ParsedNotification.kt
│       └── MainActivity.kt
└── manifest-snippet.xml       → merge into android/app/src/main/AndroidManifest.xml
```
