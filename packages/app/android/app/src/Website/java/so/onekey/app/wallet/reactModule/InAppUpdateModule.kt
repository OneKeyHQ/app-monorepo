package so.onekey.app.wallet.reactModule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod


class InAppUpdateModule internal constructor(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

    override fun getName() = "InAppUpdate"

    @ReactMethod
    fun checkUpdate() {
    }
}
