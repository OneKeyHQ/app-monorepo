package so.onekey.app.wallet.utils

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.annotation.IntDef
import androidx.annotation.RequiresApi
import so.onekey.app.wallet.utils.MiUtil.PermissionResult.Companion.PERMISSION_ASK
import so.onekey.app.wallet.utils.MiUtil.PermissionResult.Companion.PERMISSION_DENIED
import so.onekey.app.wallet.utils.MiUtil.PermissionResult.Companion.PERMISSION_GRANTED
import so.onekey.app.wallet.utils.MiUtil.PermissionResult.Companion.PERMISSION_UNKNOWN

object MiUtil {
    val TAG = MiUtil::class.simpleName

    @IntDef(value = [PERMISSION_GRANTED, PERMISSION_DENIED, PERMISSION_ASK, PERMISSION_UNKNOWN])
    @kotlin.annotation.Retention(
            AnnotationRetention.SOURCE
    )
    annotation class PermissionResult {
        companion object {
            /**
             * Permission check result: this is returned by [.check]
             * if the permission has been granted to the given package.
             */
            const val PERMISSION_GRANTED = 0

            /**
             * Permission check result: this is returned by [.check]
             * if the permission has not been granted to the given package.
             */
            const val PERMISSION_DENIED = -1

            const val PERMISSION_ASK = 1

            const val PERMISSION_UNKNOWN = 2
        }
    }

    /**
     * 检测NFC权限是否有授权.
     */
    @PermissionResult
    @RequiresApi(Build.VERSION_CODES.KITKAT)
    fun checkNfcPermission(context: Context): Int {
        try {
            val mAppOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val pkg = context.applicationContext.packageName
            val uid = context.applicationInfo.uid
            val appOpsClass = Class.forName(AppOpsManager::class.java.name)
            val checkOpNoThrowMethod = appOpsClass.getDeclaredMethod(
                    "checkOpNoThrow", Integer.TYPE, Integer.TYPE,
                    String::class.java
            )
            //the ops of NFC is 10016,check /data/system/appops/xxx.xml
            val invoke = checkOpNoThrowMethod.invoke(mAppOps, 10016, uid, pkg)
            if (invoke == null) {
                Log.d(TAG,
                        "MIUI check permission checkOpNoThrowMethod(AppOpsManager) invoke result is null"
                )
                return PERMISSION_UNKNOWN
            }
            val result = invoke.toString()
            Log.d(TAG,
                    "MIUI check permission checkOpNoThrowMethod(AppOpsManager) invoke result = $result"
            )
            when (result) {
                "0" -> return PERMISSION_GRANTED
                "1" -> return PERMISSION_DENIED
                "5" -> return PERMISSION_ASK
            }
        } catch (e: Exception) {
            Log.d(TAG, "check nfc permission fail ${e.message}", e)
        }
        return PERMISSION_UNKNOWN
    }

    fun intentToAppSetting(context: Context): Boolean {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        intent.data = Uri.fromParts("package", context.packageName, null)
        return try {
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.d(TAG, "open app setting fail ${e.message}", e)
            false
        }
    }
}