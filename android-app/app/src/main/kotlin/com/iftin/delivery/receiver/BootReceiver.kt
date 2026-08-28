package com.iftin.delivery.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.iftin.delivery.service.UssdDialerService
import com.iftin.delivery.util.ServiceStarter

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return

        // Android 15/16 restrict which foreground service types may start from
        // BOOT_COMPLETED, so always arm the WorkManager fallback as well.
        try {
            val serviceIntent = Intent(context, UssdDialerService::class.java)
            val started = ServiceStarter.startWithIntent(context, serviceIntent, "boot")
            if (!started) {
                android.util.Log.w("BootReceiver", "⚠️ FGS blocked at boot — WorkManager fallback armed")
            }
        } catch (e: Exception) {
            android.util.Log.e("BootReceiver", "Failed to start service: ${e.message}")
            ServiceStarter.scheduleFallbackWork(context)
        }
    }
}
