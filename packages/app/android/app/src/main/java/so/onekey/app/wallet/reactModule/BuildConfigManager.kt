package so.onekey.app.wallet.reactModule

import com.facebook.react.bridge.BaseJavaModule
import com.facebook.react.bridge.ReactMethod
import so.onekey.app.wallet.BuildConfig


class BuildConfigManager : BaseJavaModule() {
    override fun getName() = "BuildConfigManager"

    @ReactMethod
    fun getChannel() = BuildConfig.channel
}