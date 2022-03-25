package so.onekey.app.wallet

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import so.onekey.app.wallet.reactModule.OKLiteManager
import so.onekey.app.wallet.reactModule.PermissionManager
import java.util.*


class MainReactNativePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
    val modules = mutableListOf<NativeModule>()
    modules.add(OKLiteManager(reactContext))
    modules.add(PermissionManager(reactContext))
    return modules
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<View, ReactShadowNode<*>>> {
    return Collections.emptyList();
  }
}
