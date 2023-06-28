package so.onekey.app.wallet.utils

import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

fun sendEvent(
    reactContext: ReactContext,
    eventName: String,
    params: String? = null
) {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
}