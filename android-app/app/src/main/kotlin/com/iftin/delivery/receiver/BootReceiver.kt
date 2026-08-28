package com.iftin.delivery.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.iftin.delivery.service.UssdDialerService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Start service automatically on boot
            try {
                val serviceIntent = Intent(context, UssdDialerService::class.java)
                com.iftin.delivery.util.ServiceStarter.startWithIntent(context, serviceIntent)
            } catch (e: Exception) {
                android.util.Log.e("BootReceiver", "Failed to start service: ${e.message}")
            }
        }
    }
}
