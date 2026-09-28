package com.onekey.nativeoverlay

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RNCNativeOverlayPageHostManagerDelegate
import com.facebook.react.viewmanagers.RNCNativeOverlayPageHostManagerInterface

/** No React children: entries are attached natively by `NativeOverlayView`. */
@ReactModule(name = NativeOverlayPageHostViewManager.NAME)
class NativeOverlayPageHostViewManager :
  SimpleViewManager<NativeOverlayPageHostView>(),
  RNCNativeOverlayPageHostManagerInterface<NativeOverlayPageHostView> {
  private val delegate =
    RNCNativeOverlayPageHostManagerDelegate<NativeOverlayPageHostView, NativeOverlayPageHostViewManager>(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<NativeOverlayPageHostView> = delegate

  override fun createViewInstance(context: ThemedReactContext) = NativeOverlayPageHostView(context)

  override fun onDropViewInstance(view: NativeOverlayPageHostView) {
    view.invalidateHost()
    super.onDropViewInstance(view)
  }

  override fun setHostKey(view: NativeOverlayPageHostView, value: String?) {
    view.hostKey = value.orEmpty()
  }

  override fun setSuspendedOwners(view: NativeOverlayPageHostView, value: String?) {
    view.setSuspendedOwners(value)
  }

  companion object {
    const val NAME = "RNCNativeOverlayPageHost"
  }
}
