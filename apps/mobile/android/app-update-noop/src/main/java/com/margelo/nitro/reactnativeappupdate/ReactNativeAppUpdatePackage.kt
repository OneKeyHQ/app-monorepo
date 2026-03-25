package com.margelo.nitro.reactnativeappupdate

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

class ReactNativeAppUpdatePackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null
    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider { HashMap() }
}
