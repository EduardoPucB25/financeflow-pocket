import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Finance Flow Pocket Android app.
 *
 * DEV LOOP:
 *   Uncomment `server.url` and point it to the Lovable preview URL to test UI
 *   changes on the device without rebuilding the APK. For a production APK,
 *   leave it commented so the bundled `dist/` is served.
 */
const config: CapacitorConfig = {
  appId: "com.financeflow.pocket",
  appName: "Finance Flow Pocket",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
    url: "https://financeflow-pocket.lovable.app",
    cleartext: false,
  },
};

export default config;
