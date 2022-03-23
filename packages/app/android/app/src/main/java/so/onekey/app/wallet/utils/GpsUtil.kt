package so.onekey.app.wallet.utils

import android.content.Context
import android.content.Intent
import android.provider.Settings


object GpsUtil {
    /**
     * 判断GPS是否开启，GPS或者AGPS开启一个就认为是开启的
     * @param context
     * @return true 表示开启
     */
    fun isOpen(context: Context?): Boolean {
        if (context == null) {
            return true
        }
        var locationMode = 0
        val locationProviders: String

        locationMode = try {
            Settings.Secure.getInt(context.getContentResolver(), Settings.Secure.LOCATION_MODE)
        } catch (e: Settings.SettingNotFoundException) {
            e.printStackTrace()
            return false
        }
        return locationMode != Settings.Secure.LOCATION_MODE_OFF
    }

    /**
     * 跳转设置 打开GPS
     * @param context
     */
    fun openGPS(context: Context) {
        val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        context.startActivity(intent)
    }
}