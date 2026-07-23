package com.financeflow.pocket

import com.financeflow.pocket.notifications.NotificationCapturePlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(NotificationCapturePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
