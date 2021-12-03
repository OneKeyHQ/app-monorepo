package so.onekey.app.wallet.reactModule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.tasks.Task
import so.onekey.app.wallet.reactModule.exceptions.AppUpdateExceptions

class AndroidUpdateModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val UPDATE_PROGRESS_EVENT = "update_progress_event"
        const val UPDATE_INSTALL_EVENT = "update_install_event"
    }

    private val mAppUpdateManager: AppUpdateManager = AppUpdateManagerFactory.create(reactContext)
    private var isDownloadSuccess = false

    private val mDownloadListener = InstallStateUpdatedListener { state ->
        reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, state.installStatus())
        if (state.installStatus() == InstallStatus.DOWNLOADING) {
            val percentageDownloaded: Long = state.bytesDownloaded() * 100 / state.totalBytesToDownload()
            val downloadInfo: WritableMap = WritableNativeMap()
            downloadInfo.putString("bytesDownloaded", state.bytesDownloaded().toString())
            downloadInfo.putString("totalSize", state.totalBytesToDownload().toString())
            downloadInfo.putString("percent", percentageDownloaded.toString())
            reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_PROGRESS_EVENT, downloadInfo)
        }
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            isDownloadSuccess = true
        }
    }

    override fun getName() = "AndroidUpdateModule"

    override fun onCatalystInstanceDestroy() {
        mAppUpdateManager.unregisterListener(mDownloadListener)
    }

    private fun checkUpdate(promise: Promise, appUpdateType: Int) {
        val appUpdateInfoTask: Task<AppUpdateInfo> = mAppUpdateManager.appUpdateInfo
        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo: AppUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE && appUpdateInfo.isUpdateTypeAllowed(appUpdateType)) {
                currentActivity?.let {
                    val options: AppUpdateOptions = AppUpdateOptions.newBuilder(appUpdateType).build()
                    val startUpdateFlow: Task<Int> = mAppUpdateManager.startUpdateFlow(appUpdateInfo, it, options)
                    startUpdateFlow.addOnFailureListener { failure: Exception -> promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.DownloadNotComplete("startUpdateFlow failure $failure").toJson()) }
                    startUpdateFlow.addOnSuccessListener { result: Int -> promise.resolve(if (result == 0) "Canceled" else "Successful") }
                }
            } else {
                promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.NoUpdateAvailable("No update available").toJson())
            }
        }
        appUpdateInfoTask.addOnFailureListener { failure: Exception -> promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.ObtainUpdatesFailed("checkAppUpdate failure: $failure").toJson()) }
    }

    @ReactMethod
    fun appUpdate(updateType: Int, promise: Promise) {
        checkUpdate(promise, updateType)
    }

    @ReactMethod
    fun checkUpdateStatus(promise: Promise) {
        val appUpdateInfoTask: Task<AppUpdateInfo> = mAppUpdateManager.appUpdateInfo
        appUpdateInfoTask.addOnSuccessListener { appUpdateInfo: AppUpdateInfo ->
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                if (appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    val updateInfoMap: WritableMap = WritableNativeMap()
                    updateInfoMap.putInt("updateType", AppUpdateType.IMMEDIATE)
                    updateInfoMap.putString("versionName", null)
                    promise.resolve(updateInfoMap)
                } else {
                    val updateInfoMap: WritableMap = WritableNativeMap()
                    updateInfoMap.putInt("updateType", AppUpdateType.FLEXIBLE)
                    updateInfoMap.putString("versionName", null)
                    promise.resolve(updateInfoMap)
                }
            } else {
                promise.reject("reject", AppUpdateExceptions.NoUpdateAvailable("No update available").toJson())
            }
        }.addOnFailureListener { failure: Exception ->
            promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.ObtainUpdatesFailed(" checkUpdateStatus failure: $failure").toJson())
        }
    }

    @ReactMethod
    fun installUpdate(promise: Promise) {
        if (isDownloadSuccess) {
            mAppUpdateManager.completeUpdate()
            promise.resolve("success")
        } else {
            promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.DownloadNotComplete("Download is not completed").toJson())
        }
    }

    @ReactMethod
    fun cancelUpdate(promise: Promise) {
        promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.IrrevocableUpdate().toJson())
    }

    init {
        mAppUpdateManager.registerListener(mDownloadListener)
    }
}