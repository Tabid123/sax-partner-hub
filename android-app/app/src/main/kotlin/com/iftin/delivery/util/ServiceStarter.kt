package com.iftin.delivery.util

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.work.*
import com.iftin.delivery.service.UssdDialerService
import com.iftin.delivery.worker.UssdPollingWorker
import java.util.concurrent.TimeUnit

/**
 * Centralized, Android 14/15/16-safe way to start UssdDialerService.
 *
 * Android 12+ throws ForegroundServiceStartNotAllowedException when the app tries to
 * start a foreground service from the background, and Android 14/15/16 tighten this
 * further (BOOT_COMPLETED restrictions + dataSync runtime quotas).
 *
 * Instead of crashing, we fall back to WorkManager so delivery polling keeps running.
 */
object ServiceStarter {

    private const val TAG = "ServiceStarter"
    const val FALLBACK_WORK_NAME = "ussd_fallback_work"

    /** Runtime permissions the delivery loop actually needs. */
    val REQUIRED_PERMISSIONS: List<String>
        get() {
            val list = mutableListOf(
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.SEND_SMS
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                list.add(Manifest.permission.READ_PHONE_NUMBERS)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                list.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            return list
        }

    fun hasPermission(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun missingPermissions(context: Context): List<String> =
        REQUIRED_PERMISSIONS.filterNot { hasPermission(context, it) }

    fun canPostNotifications(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)

    fun isServiceRunning(context: Context): Boolean {
        return try {
            @Suppress("DEPRECATION")
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            @Suppress("DEPRECATION")
            manager.getRunningServices(Integer.MAX_VALUE).any {
                it.service.className == UssdDialerService::class.java.name
            }
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Try to start the delivery service. Returns true if the service start was accepted.
     * If the OS refuses (background start / FGS restrictions on Android 14-16),
     * we silently degrade to WorkManager-driven polling.
     */
    fun start(context: Context, reason: String = "unknown"): Boolean {
        val appContext = context.applicationContext
        val intent = Intent(appContext, UssdDialerService::class.java)
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(intent)
            } else {
                appContext.startService(intent)
            }
            android.util.Log.d(TAG, "✅ Service start requested ($reason)")
            true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "⚠️ Foreground service start denied ($reason): ${e.javaClass.simpleName} ${e.message}")
            // Last resort: plain background start (works when app is in foreground-ish state)
            val started = try {
                appContext.startService(intent)
                true
            } catch (e2: Exception) {
                android.util.Log.e(TAG, "⚠️ Background service start also denied: ${e2.message}")
                false
            }
            if (!started) scheduleFallbackWork(appContext)
            started
        }
    }

    /**
     * WorkManager fallback: keeps polling / heartbeat alive even when the OS
     * refuses foreground services (Android 14+ background start restrictions).
     */
    fun scheduleFallbackWork(context: Context) {
        try {
            val request = OneTimeWorkRequestBuilder<UssdPollingWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                FALLBACK_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
            android.util.Log.d(TAG, "🛟 Fallback WorkManager job scheduled (FGS unavailable)")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ Failed to schedule fallback work: ${e.message}")
        }
    }
}
