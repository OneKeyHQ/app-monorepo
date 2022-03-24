package so.onekey.app.wallet.reactModule

import com.facebook.react.bridge.BaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import so.onekey.app.wallet.utils.GpsUtil

class PermissionManager(private val context: ReactApplicationContext) : BaseJavaModule() {
    override fun getName() = "OKPermissionManager"

    @ReactMethod
    fun isOpenLocation(): Boolean {
        return GpsUtil.isOpen(context)
    }

    @ReactMethod
    fun openLocationSetting() {
        GpsUtil.openGPS(context)
    }
}