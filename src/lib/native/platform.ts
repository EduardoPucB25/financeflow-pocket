import { Capacitor } from "@capacitor/core";

/**
 * True when running inside the Capacitor native shell (the Android APK).
 * Dev-only override for testing the mobile UI in a desktop browser:
 *   localStorage.setItem("ffp-force-native", "1") + reload.
 * The override is stripped from production bundles by import.meta.env.DEV.
 */
export const isNativeApp = (): boolean => {
  if (Capacitor.isNativePlatform()) return true;
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem("ffp-force-native") === "1"
  );
};
