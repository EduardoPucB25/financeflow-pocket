package com.financeflow.pocket.notifications

import android.app.Notification
import android.content.SharedPreferences
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Background service that receives every posted notification once the user
 * grants "Notification access" in Android settings.
 *
 * Responsibilities:
 *   1. Filter by package against the runtime allowlist (SharedPreferences,
 *      seeded with `BankParsers.DEFAULT_WATCHED_PACKAGES`).
 *   2. Extract title + text from the notification extras.
 *   3. Delegate parsing to `BankParsers`.
 *   4. Forward the parsed result to the Capacitor bridge, which surfaces it
 *      as a `bankNotification` event to the web app.
 */
class NotificationCaptureService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        try {
            val pkg = sbn.packageName ?: return
            if (!watchedPackages().contains(pkg)) return

            val extras = sbn.notification?.extras ?: return
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            val text = (
                extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                    ?: extras.getCharSequence(Notification.EXTRA_TEXT)
                    ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
                )?.toString() ?: return

            if (text.isBlank()) return

            val parsed = BankParsers.parse(pkg, title, text, sbn.postTime)
            NotificationCapturePlugin.emit(parsed)
        } catch (t: Throwable) {
            Log.e(TAG, "onNotificationPosted failed", t)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) { /* no-op */ }

    private fun watchedPackages(): Set<String> {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val saved = prefs.getStringSet(KEY_WATCHED, null)
        return saved ?: BankParsers.DEFAULT_WATCHED_PACKAGES
    }

    companion object {
        private const val TAG = "NotificationCapture"
        const val PREFS = "notification_capture_prefs"
        const val KEY_WATCHED = "watched_packages"

        fun setWatchedPackages(prefs: SharedPreferences, packages: Set<String>) {
            prefs.edit().putStringSet(KEY_WATCHED, packages).apply()
        }

        fun getWatchedPackages(prefs: SharedPreferences): Set<String> =
            prefs.getStringSet(KEY_WATCHED, null) ?: BankParsers.DEFAULT_WATCHED_PACKAGES
    }
}
