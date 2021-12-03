package so.onekey.app.wallet.utils

import android.content.Context
import android.os.Build
import kotlin.math.max

object VersionUtils {
    /**
     * 获取当前app的升级版本号
     *
     * @param context 上下文
     */
    @JvmStatic
    fun getVersionCode(context: Context): Long {
        return try {
            val packageManager = context.packageManager
            val packageInfo = packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                packageInfo.versionCode.toLong()
            }
        } catch (e: java.lang.Exception) {
            e.printStackTrace()
            1L
        }
    }

    private fun getVersionList(versionName: String): List<Int> {
        return versionName
                .replace(Regex("[^0-9.]"), "")
                .split(".")
                .map {
                    try {
                        it.toInt()
                    } catch (e: Exception) {
                        0
                    }
                }
                .toList()
    }
    
    /**
     * 版本号对比
     * [versionNameOne] 是否大于 [versionNameTwo]
     *
     * @param versionNameOne
     * @param versionNameTwo
     * @return [versionNameOne] 大于 [versionNameTwo] 返回 true
     */
    fun versionNameCompareTo(versionNameOne: String?, versionNameTwo: String?): Boolean {
        if (versionNameOne.isNullOrEmpty()) {
            return false
        }
        if (versionNameTwo.isNullOrEmpty()) {
            return true
        }
        val oneVerList = getVersionList(versionNameOne)
        val twoVerList = getVersionList(versionNameTwo)
        for (index in 0 until max(twoVerList.size, oneVerList.size)) {
            val oneVer = oneVerList.getOrElse(index) { 0 }
            val twoVer = twoVerList.getOrElse(index) { 0 }
            if (oneVer > twoVer) {
                return true
            }
        }
        return false
    }
}