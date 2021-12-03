package so.onekey.app.wallet.reactModule

import com.azhon.appupdate.config.UpdateConfiguration
import com.azhon.appupdate.listener.OnDownloadListener
import com.azhon.appupdate.manager.DownloadManager
import com.azhon.appupdate.utils.ApkUtil
import com.azhon.appupdate.utils.Constant
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import so.onekey.app.wallet.BuildConfig
import so.onekey.app.wallet.R
import so.onekey.app.wallet.constant.checkUpdateInfoUrl
import so.onekey.app.wallet.reactModule.exceptions.AppUpdateExceptions
import so.onekey.app.wallet.utils.VersionUtils
import java.io.File
import java.net.HttpURLConnection

class AndroidUpdateModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), OnDownloadListener, CoroutineScope by MainScope() {
    companion object {
        const val UPDATE_PROGRESS_EVENT = "update_progress_event"
        const val UPDATE_INSTALL_EVENT = "update_install_event"
    }

    private var mDownloadManager: DownloadManager? = null
    private val mConfiguration: UpdateConfiguration = UpdateConfiguration()
            .setEnableLog(BuildConfig.DEBUG)
            .setJumpInstallPage(true)
            .setShowNotification(true)
            .setForcedUpgrade(false)
            .setOnDownloadListener(this)
    private var isDownloadSuccess = false
    private var mUpdateInfo: Website? = null
    private var mTempDownLoadApk: File? = null

    override fun getName() = "AndroidUpdateModule"

    override fun onCatalystInstanceDestroy() {
        mDownloadManager?.release()
    }

    private fun checkUpdate(promise: Promise, appUpdateType: Int) {
        launch(Dispatchers.IO) {
            if (mUpdateInfo == null) {
                mUpdateInfo = getUpdateInfo()?.android?.website
            }
            if (mUpdateInfo == null) {
                promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.ObtainUpdatesFailed("Failed to get updates").toJson())
                return@launch
            }
            if (mDownloadManager == null) {
                mDownloadManager = DownloadManager.getInstance(reactContext)
            }
            mDownloadManager?.let {
                if (!it.isDownloading) {
                    it
                            .setApkName("oneKey.apk")
                            .setApkUrl(mUpdateInfo!!.url)
                            .setSmallIcon(R.mipmap.ic_launcher_round)
                            .configuration = mConfiguration
                }
                it.download()
            }
        }
    }

    private fun getCheckUpdateUrl() = checkUpdateInfoUrl()

    private fun getUpdateInfo(): UpdateInfo? {
        val url = getCheckUpdateUrl()
        val request: Request = Request.Builder().url(url).build()
        val response = OkHttpClient().newCall(request).execute()
        if (response.code() != HttpURLConnection.HTTP_OK) {
            Exception(response.body()?.toString() ?: "").printStackTrace()
            return null
        }

        return try {
            val info = response.body()?.string() ?: ""
            Gson().fromJson(info, UpdateInfo::class.java)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    @ReactMethod
    fun appUpdate(updateType: Int, promise: Promise) {
        checkUpdate(promise, updateType)
    }

    @ReactMethod
    fun checkUpdateStatus(promise: Promise) {
        if (mDownloadManager == null) {
            mDownloadManager = DownloadManager.getInstance(reactContext)
        }
        if (mDownloadManager?.isDownloading == true) {
            promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.UpdatingApp().toJson())
            return
        }
        launch(Dispatchers.IO) {
            val updateInfo = getUpdateInfo()
            if (updateInfo == null) {
                promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.ObtainUpdatesFailed("Failed to get updates").toJson())
                return@launch
            }

            val website = updateInfo.android.website
            mUpdateInfo = website
            val currentVersionCode = VersionUtils.getVersionCode(reactContext)
            when {
                website.forceVersionCode?.toLong() ?: 0 > currentVersionCode -> {
                    val updateInfoMap: WritableMap = WritableNativeMap()
                    updateInfoMap.putInt("updateType", AppUpdateType.IMMEDIATE)
                    updateInfoMap.putString("versionName", website.versionName)
                    promise.resolve(updateInfoMap)
                }
                website.versionCode.toLong() > currentVersionCode -> {
                    val updateInfoMap: WritableMap = WritableNativeMap()
                    updateInfoMap.putInt("updateType", AppUpdateType.FLEXIBLE)
                    updateInfoMap.putString("versionName", website.versionName)
                    promise.resolve(updateInfoMap)
                }
                else -> {
                    promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.NoUpdateAvailable().toJson())
                }
            }
        }
    }

    @ReactMethod
    fun installUpdate(promise: Promise) {
        if (isDownloadSuccess) {
            if (mTempDownLoadApk != null) {
                ApkUtil.installApk(reactContext, Constant.AUTHORITIES, mTempDownLoadApk)
            }
            promise.resolve("success")
        } else {
            promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.DownloadNotComplete().toJson())
        }
    }

    @ReactMethod
    fun cancelUpdate(promise: Promise) {
        if (mDownloadManager?.isDownloading == true) {
            mDownloadManager?.cancel()
            promise.resolve("success")
        } else {
            promise.reject(AppUpdateExceptions.REJECT_CODE, AppUpdateExceptions.IrrevocableUpdate().toJson())
        }
    }

    override fun start() {
        reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, InstallState.PENDING)
    }

    private var sendLastTime = 0L
    private var sendIntervalTime = 100
    override fun downloading(max: Int, progress: Int) {
        if (System.currentTimeMillis() - sendIntervalTime > sendLastTime) {
            sendLastTime = System.currentTimeMillis()

            reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, InstallState.DOWNLOADING)
            val percentageDownloaded: Long = (progress.toFloat() / max * 100).toLong()
            val downloadInfo: WritableMap = WritableNativeMap()
            downloadInfo.putString("bytesDownloaded", progress.toString())
            downloadInfo.putString("totalSize", max.toString())
            downloadInfo.putString("percent", percentageDownloaded.toString())
            reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_PROGRESS_EVENT, downloadInfo)
        }
    }

    override fun done(apk: File?) {
        mTempDownLoadApk = apk
        isDownloadSuccess = true
        reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, InstallState.DOWNLOADED)
    }

    override fun cancel() {
        reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, InstallState.CANCELED)
    }

    override fun error(e: java.lang.Exception?) {
        reactContext.getJSModule(RCTDeviceEventEmitter::class.java).emit(UPDATE_INSTALL_EVENT, InstallState.FAILED)
    }
}