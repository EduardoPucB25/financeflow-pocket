import { registerPlugin, Capacitor, type PluginListenerHandle } from "@capacitor/core";

export type DetectedType = "charge" | "credit" | "transfer" | "payment" | "unknown";

export interface BankNotificationEvent {
  packageName: string;
  title: string | null;
  text: string;
  amount: number | null;
  currency: string;
  merchant: string | null;
  type: DetectedType;
  rawText: string;
  timestamp: number;
}

export interface InstalledApp {
  packageName: string;
  label: string;
}

export interface NotificationCapturePlugin {
  isPermissionGranted(): Promise<{ granted: boolean }>;
  openPermissionSettings(): Promise<void>;
  getWatchedPackages(): Promise<{ packages: string[] }>;
  setWatchedPackages(options: { packages: string[] }): Promise<void>;
  /** Opens a URL in the system browser (v3+ binaries; older ones reject). */
  openExternal(options: { url: string }): Promise<void>;
  /** Lists launchable installed apps (v5+ binaries; older ones reject). */
  getInstalledApps(): Promise<{ apps: InstalledApp[] }>;
  addListener(
    eventName: "bankNotification",
    listenerFunc: (event: BankNotificationEvent) => void,
  ): Promise<PluginListenerHandle>;
}

/**
 * Native bridge to the Android `NotificationCapture` Capacitor plugin.
 * On web (no native runtime), every method is a no-op that reports "not native".
 */
const NativePlugin = registerPlugin<NotificationCapturePlugin>("NotificationCapture");

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const NotificationCapture: NotificationCapturePlugin = isNativeAndroid()
  ? NativePlugin
  : {
      async isPermissionGranted() {
        return { granted: false };
      },
      async openPermissionSettings() {},
      async getWatchedPackages() {
        return { packages: [] };
      },
      async setWatchedPackages() {},
      async openExternal() {},
      async getInstalledApps() {
        return { apps: [] };
      },
      addListener: async () => ({ remove: async () => {} }) as PluginListenerHandle,
    };

/**
 * Open a URL outside the app. Inside the Capacitor WebView `window.open` is a
 * silent no-op, so on native we go through the plugin (fires an ACTION_VIEW
 * intent → system browser). Binaries older than v3 don't implement the method;
 * fall back to `window.open` there so web/dev keep working and old APKs at
 * least attempt something.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const absolute = new URL(url, window.location.origin).toString();
  if (isNativeAndroid()) {
    try {
      await NotificationCapture.openExternal({ url: absolute });
      return;
    } catch {
      // v1/v2 binary without openExternal — fall through.
    }
  }
  window.open(absolute, "_blank", "noopener");
}
