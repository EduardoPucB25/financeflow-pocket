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

export interface NotificationCapturePlugin {
  isPermissionGranted(): Promise<{ granted: boolean }>;
  openPermissionSettings(): Promise<void>;
  getWatchedPackages(): Promise<{ packages: string[] }>;
  setWatchedPackages(options: { packages: string[] }): Promise<void>;
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
      addListener: async () => ({ remove: async () => {} }) as PluginListenerHandle,
    };
