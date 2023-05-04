package so.onekey.app.wallet.reactModule

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context.ALARM_SERVICE
import android.content.Intent
import android.os.Process
import com.facebook.react.bridge.BaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod


class AppRestartManager(private val context: ReactApplicationContext) : BaseJavaModule() {
    override fun getName() = "NativeAppRestart"

    @ReactMethod
    fun restart() {
        // Gets the intent to start
        val intent: Intent? =
            context.packageManager.getLaunchIntentForPackage(context.packageName)
        val restartIntent: PendingIntent =
            PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
        // Set 1.5 seconds to restart after killing an application
        val alarmManager = context.getSystemService(ALARM_SERVICE) as AlarmManager
        alarmManager.set(AlarmManager.RTC, System.currentTimeMillis() + 1500, restartIntent)
        // Restart the application
        Process.killProcess(Process.myPid())
    }
}