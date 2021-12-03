package so.onekey.app.wallet

import android.content.Context
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import so.onekey.app.wallet.channel.AppUpdateTypes
import so.onekey.app.wallet.channel.IAppCheckUpdate

class AppCheckUpdate(context: Context) : IAppCheckUpdate {
    private val mAppUpdateManager = AppUpdateManagerFactory.create(context)


    override fun checkAppUpdate(callback: (Int) -> Unit) {
        // Returns an intent object that you use to check for an update.
        val appUpdateInfoTask = mAppUpdateManager.appUpdateInfo

        // Checks that the platform will allow the specified type of update.
        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    // This example applies an immediate update. To apply a flexible update
                    // instead, pass in AppUpdateType.FLEXIBLE
                    && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
            ) {
                when {
                    appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> {
                        // 只有更新提醒
                        callback.invoke(AppUpdateTypes.RECOMMEND)
                    }
                    appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> {
                        if (appUpdateInfo.updatePriority() >= 4) {
                            // 强制更新
                            callback.invoke(AppUpdateTypes.FORCE)
                            return@addOnSuccessListener
                        }
                        // 推荐立即更新
                        callback.invoke(AppUpdateTypes.IMMEDIATELY)
                    }
                }
            }
        }
    }
}