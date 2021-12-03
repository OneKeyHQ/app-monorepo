package so.onekey.app.wallet.reactModule

import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.tasks.Task
import android.content.IntentSender
import android.graphics.Color
import android.content.Intent
import android.app.Activity
import android.view.View
import com.facebook.react.bridge.*
import com.google.android.material.snackbar.Snackbar
import com.google.android.play.core.install.InstallState

// see https://github.com/sandeshnaroju/react-native-in-app-update/blob/master/InAppUpdateModule.java
class InAppUpdateModule internal constructor(context: ReactApplicationContext) : ReactContextBaseJavaModule(context), InstallStateUpdatedListener, LifecycleEventListener {
    private var appUpdateManager: AppUpdateManager? = null
    private val mActivityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, intent: Intent) {
            if (requestCode == MY_REQUEST_CODE) {
                if (resultCode != Activity.RESULT_OK) {
                    println("Update flow failed! Result code: $resultCode")
                }
            }
        }
    }

    override fun getName() = "InAppUpdate"

    @ReactMethod
    fun checkUpdate() {
        appUpdateManager = AppUpdateManagerFactory.create(reactContext)
        appUpdateManager?.let {
            it.registerListener(this)
            val appUpdateInfoTask: Task<AppUpdateInfo> = it.appUpdateInfo
            appUpdateInfoTask.addOnSuccessListener { appUpdateInfo ->
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE && appUpdateInfo.clientVersionStalenessDays() ?: -1 > STALE_DAYS && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    try {
                        reactContext.currentActivity?.let { it1 ->
                            it.startUpdateFlowForResult(
                                    appUpdateInfo,
                                    AppUpdateType.IMMEDIATE,
                                    it1,
                                    MY_REQUEST_CODE)
                        }
                    } catch (e: IntentSender.SendIntentException) {
                        e.printStackTrace()
                    }
                } else {
                    if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                            && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                        try {
                            reactContext.currentActivity?.let { it1 ->
                                it.startUpdateFlowForResult(
                                        appUpdateInfo,
                                        AppUpdateType.FLEXIBLE,
                                        it1,
                                        MY_REQUEST_CODE)
                            }
                        } catch (e: IntentSender.SendIntentException) {
                            e.printStackTrace()
                        }
                    }
                }
            }
        }
    }

    override fun onStateUpdate(state: InstallState) {
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            popupSnackbarForCompleteUpdate()
        }
    }

    private fun popupSnackbarForCompleteUpdate() {
        reactContext.currentActivity?.findViewById<View>(android.R.id.content)?.rootView?.let {
            val snackbar: Snackbar = Snackbar.make(it, "An update has just been downloaded.",
                    Snackbar.LENGTH_INDEFINITE)
            snackbar.setAction("RESTART") { appUpdateManager?.completeUpdate() }
            snackbar.setActionTextColor(Color.GREEN)
            snackbar.show()
        }
    }

    override fun onHostResume() {
        appUpdateManager?.let {
            it
                    .appUpdateInfo
                    .addOnSuccessListener { appUpdateInfo ->
                        if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                            popupSnackbarForCompleteUpdate()
                        }
                        if (appUpdateInfo.updateAvailability()
                                == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                            try {
                                reactContext.currentActivity?.let { it1 ->
                                    it.startUpdateFlowForResult(
                                            appUpdateInfo,
                                            AppUpdateType.IMMEDIATE,
                                            it1,
                                            MY_REQUEST_CODE)
                                }
                            } catch (e: IntentSender.SendIntentException) {
                                e.printStackTrace()
                            }
                        }
                    }
        }
    }

    override fun onHostPause() {}
    override fun onHostDestroy() {
        appUpdateManager?.unregisterListener(this)
    }

    companion object {
        private lateinit var reactContext: ReactApplicationContext
        private const val STALE_DAYS = 5
        private const val MY_REQUEST_CODE = 0
    }

    init {
        reactContext = context
        reactContext.addActivityEventListener(mActivityEventListener)
        reactContext.addLifecycleEventListener(this)
    }


}
