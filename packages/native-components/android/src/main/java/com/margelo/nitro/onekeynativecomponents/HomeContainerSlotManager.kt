package com.margelo.nitro.onekeynativecomponents

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.OneKeyHomeContainerSlotManagerDelegate
import com.facebook.react.viewmanagers.OneKeyHomeContainerSlotManagerInterface

@ReactModule(name = HomeContainerSlotManager.NAME)
internal class HomeContainerSlotManager(
  @Suppress("UNUSED_PARAMETER") reactContext: ReactApplicationContext,
) : ViewGroupManager<HomeContainerSlotView>(),
  OneKeyHomeContainerSlotManagerInterface<HomeContainerSlotView> {

  private val delegate = OneKeyHomeContainerSlotManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<HomeContainerSlotView> = delegate

  override fun createViewInstance(context: ThemedReactContext): HomeContainerSlotView =
    HomeContainerSlotView(context)

  override fun setSlotKey(view: HomeContainerSlotView?, value: String?) {
    view?.slotKey = value.orEmpty()
  }

  override fun addView(parent: HomeContainerSlotView, child: View, index: Int) {
    parent.addReactChild(child, index)
  }

  override fun getChildCount(parent: HomeContainerSlotView): Int = parent.reactChildCount()

  override fun getChildAt(parent: HomeContainerSlotView, index: Int): View =
    parent.reactChildAt(index)

  override fun removeViewAt(parent: HomeContainerSlotView, index: Int) {
    parent.removeReactChildAt(index)
  }

  override fun removeAllViews(parent: HomeContainerSlotView) {
    parent.removeAllReactChildren()
  }

  override fun needsCustomLayoutForChildren(): Boolean = true

  companion object {
    const val NAME = "OneKeyHomeContainerSlot"
  }
}
