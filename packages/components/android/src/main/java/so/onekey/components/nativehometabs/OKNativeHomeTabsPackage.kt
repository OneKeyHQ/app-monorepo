package so.onekey.components.nativehometabs

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OKNativeHomeTabsPackage : ReactPackage {
  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> {
    return listOf(OKNativeHomeTabsManager(reactContext))
  }

  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> {
    return emptyList()
  }
}
