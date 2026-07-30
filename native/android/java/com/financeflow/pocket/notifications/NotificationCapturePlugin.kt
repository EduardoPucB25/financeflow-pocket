package com.financeflow.pocket.notifications

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin bridging `NotificationCaptureService` to the web layer.
 *
 * JS side (see src/lib/native/notificationCapture.ts):
 *   - `isPermissionGranted()`
 *   - `openPermissionSettings()`
 *   - `getWatchedPackages()` / `setWatchedPackages({ packages })`
 *   - event `bankNotification` (payload matches `ParsedNotification`)
 */
@CapacitorPlugin(name = "NotificationCapture")
class NotificationCapturePlugin : Plugin() {

    override fun load() {
        instance = this
    }

    @PluginMethod
    fun isPermissionGranted(call: PluginCall) {
        val enabled = NotificationManagerCompat.getEnabledListenerPackages(context)
            .contains(context.packageName)
        val ret = JSObject()
        ret.put("granted", enabled)
        call.resolve(ret)
    }

    @PluginMethod
    fun openPermissionSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun getWatchedPackages(call: PluginCall) {
        val prefs = context.getSharedPreferences(NotificationCaptureService.PREFS, Context.MODE_PRIVATE)
        val packages = NotificationCaptureService.getWatchedPackages(prefs)
        val ret = JSObject()
        // JSArray (not a raw Kotlin List) so the bridge delivers a real JS
        // array; a List serializes as a string and crashes array consumers.
        ret.put("packages", JSArray(packages.toList()))
        call.resolve(ret)
    }

    @PluginMethod
    fun openExternal(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("url required")
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun setWatchedPackages(call: PluginCall) {
        val arr = call.getArray("packages") ?: return call.reject("packages array required")
        val set = mutableSetOf<String>()
        for (i in 0 until arr.length()) set.add(arr.getString(i))
        val prefs = context.getSharedPreferences(NotificationCaptureService.PREFS, Context.MODE_PRIVATE)
        NotificationCaptureService.setWatchedPackages(prefs, set)
        call.resolve()
    }

    companion object {
        @Volatile private var instance: NotificationCapturePlugin? = null

        /** Called from `NotificationCaptureService` when a bank notification is parsed. */
        fun emit(parsed: ParsedNotification) {
            val plugin = instance ?: return
            val payload = JSObject().apply {
                put("packageName", parsed.packageName)
                put("title", parsed.title)
                put("text", parsed.text)
                put("amount", parsed.amount)
                put("currency", parsed.currency)
                put("merchant", parsed.merchant)
                put("type", parsed.type)
                put("rawText", parsed.rawText)
                put("timestamp", parsed.timestamp)
            }
            plugin.notifyListeners("bankNotification", payload, true)
        }
    }
}
