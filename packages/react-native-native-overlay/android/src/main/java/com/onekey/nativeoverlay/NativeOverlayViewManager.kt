package com.onekey.nativeoverlay

import android.view.View
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RNCNativeOverlayManagerDelegate
import com.facebook.react.viewmanagers.RNCNativeOverlayManagerInterface

@ReactModule(name = NativeOverlayViewManager.NAME)
class NativeOverlayViewManager :
  ViewGroupManager<NativeOverlayView>(),
  RNCNativeOverlayManagerInterface<NativeOverlayView> {
  private val delegate = RNCNativeOverlayManagerDelegate<NativeOverlayView, NativeOverlayViewManager>(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<NativeOverlayView> = delegate

  override fun createViewInstance(context: ThemedReactContext): NativeOverlayView {
    val view = NativeOverlayView(context)
    fun dispatch(event: (surfaceId: Int) -> com.facebook.react.uimanager.events.Event<*>) {
      val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
      dispatcher?.dispatchEvent(event(UIManagerHelper.getSurfaceId(context)))
    }
    view.onPresented = { stackOrder ->
      dispatch { NativeOverlayPresentedEvent(it, view.id, stackOrder) }
    }
    view.onDismissed = { reason ->
      dispatch { NativeOverlayReasonEvent(it, view.id, NativeOverlayReasonEvent.DISMISSED, reason) }
    }
    view.onRequestDismiss = { reason ->
      dispatch { NativeOverlayReasonEvent(it, view.id, NativeOverlayReasonEvent.REQUEST_DISMISS, reason) }
    }
    return view
  }

  override fun addEventEmitters(context: ThemedReactContext, view: NativeOverlayView) {
    view.eventDispatcher = UIManagerHelper.getEventDispatcher(context)
  }

  override fun onAfterUpdateTransaction(view: NativeOverlayView) {
    super.onAfterUpdateTransaction(view)
    view.commitConfiguration()
  }

  override fun onDropViewInstance(view: NativeOverlayView) {
    view.onDropViewInstance()
    super.onDropViewInstance(view)
  }

  override fun addView(parent: NativeOverlayView, child: View, index: Int) {
    parent.addReactChild(child)
  }

  override fun getChildCount(parent: NativeOverlayView): Int = parent.getReactChildCount()

  override fun getChildAt(parent: NativeOverlayView, index: Int): View? = parent.getReactChildAt(index)

  override fun removeView(parent: NativeOverlayView, view: View) {
    parent.removeReactChild(view)
  }

  override fun removeAllViews(parent: NativeOverlayView) {
    parent.getReactChildAt(0)?.let(parent::removeReactChild)
  }

  override fun removeViewAt(parent: NativeOverlayView, index: Int) {
    parent.getReactChildAt(index)?.let(parent::removeReactChild)
  }

  override fun setVisible(view: NativeOverlayView, value: Boolean) {
    view.visible = value
  }

  override fun setLevel(view: NativeOverlayView, value: String?) {
    view.level = value ?: "modal"
  }

  override fun setScope(view: NativeOverlayView, value: String?) {
    view.scope = value ?: "global"
  }

  override fun setHostKey(view: NativeOverlayView, value: String?) {
    view.hostKey = value.orEmpty()
  }

  override fun setOwnerKey(view: NativeOverlayView, value: String?) {
    view.ownerKey = value.orEmpty()
  }

  override fun setPresentation(view: NativeOverlayView, value: String?) {
    view.presentation = value ?: "center"
  }

  override fun setStackOrder(view: NativeOverlayView, value: Int) {
    view.stackOrder = value
  }

  override fun setBlocking(view: NativeOverlayView, value: Boolean) {
    view.blocking = value
  }

  override fun setDismissOnBackPress(view: NativeOverlayView, value: Boolean) {
    view.dismissOnBackPress = value
  }

  override fun setDismissOnBackdropPress(view: NativeOverlayView, value: Boolean) {
    view.dismissOnBackdropPress = value
  }

  override fun setBackdropColor(view: NativeOverlayView, value: Int?) {
    view.backdropColor = value
  }

  override fun setSheetHeight(view: NativeOverlayView, value: Double) {
    view.sheetHeight = value
  }

  override fun setSheetCornerRadius(view: NativeOverlayView, value: Double) {
    view.sheetCornerRadius = value
  }

  override fun setShowHandle(view: NativeOverlayView, value: Boolean) {
    view.showHandle = value
  }

  override fun setSheetBackgroundColor(view: NativeOverlayView, value: Int?) {
    view.sheetBackgroundColor = value
  }

  override fun setDismissOnPanDown(view: NativeOverlayView, value: Boolean) {
    view.dismissOnPanDown = value
  }

  override fun setAnimationConfig(view: NativeOverlayView, value: String?) {
    view.animationConfig = value
  }

  companion object {
    const val NAME = "RNCNativeOverlay"
  }
}
