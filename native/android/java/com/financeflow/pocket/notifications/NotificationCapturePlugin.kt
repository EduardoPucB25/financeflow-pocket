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

    /**
     * Lists user-facing installed apps (those with a launcher activity) so the
     * web layer can offer a "pick the apps you use" selector without the user
     * typing package names. Requires QUERY_ALL_PACKAGES in the manifest.
     *
     * Returns { apps: [{ packageName, label }] } sorted by label. Uses JSArray
     * of JSObject (never a Kotlin List) so the bridge yields a real JS array.
     */
    @PluginMethod
    fun getInstalledApps(call: PluginCall) {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos = pm.queryIntentActivities(intent, 0)
        val seen = HashSet<String>()
        val list = ArrayList<Pair<String, String>>() // (label, packageName)
        for (ri in resolveInfos) {
            val pkg = ri.activityInfo?.packageName ?: continue
            if (pkg == context.packageName) continue
            if (!seen.add(pkg)) continue
            val label = try { ri.loadLabel(pm)?.toString() } catch (e: Exception) { null } ?: pkg
            list.add(Pair(label, pkg))
        }
        list.sortBy { it.first.lowercase() }
        val apps = JSArray()
        for ((label, pkg) in list) {
            apps.put(JSObject().apply {
                put("packageName", pkg)
                put("label", label)
            })
        }
        val ret = JSObject()
        ret.put("apps", apps)
        call.resolve(ret)
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
