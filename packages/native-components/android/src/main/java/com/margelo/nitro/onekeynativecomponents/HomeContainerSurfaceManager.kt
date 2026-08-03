package com.margelo.nitro.onekeynativecomponents

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.OneKeyHomeContainerSurfaceManagerDelegate
import com.facebook.react.viewmanagers.OneKeyHomeContainerSurfaceManagerInterface

@ReactModule(name = HomeContainerSurfaceManager.NAME)
internal class HomeContainerSurfaceManager(
  @Suppress("UNUSED_PARAMETER") reactContext: ReactApplicationContext,
) : ViewGroupManager<HomeContainerSurfaceView>(),
  OneKeyHomeContainerSurfaceManagerInterface<HomeContainerSurfaceView> {

  private val delegate = OneKeyHomeContainerSurfaceManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<HomeContainerSurfaceView> = delegate

  override fun createViewInstance(context: ThemedReactContext): HomeContainerSurfaceView =
    HomeContainerSurfaceView(context)

  override fun addView(parent: HomeContainerSurfaceView, child: View, index: Int) {
    parent.addReactChild(child, index)
  }

  override fun getChildCount(parent: HomeContainerSurfaceView): Int = parent.reactChildCount()

  override fun getChildAt(parent: HomeContainerSurfaceView, index: Int): View =
    parent.reactChildAt(index)

  override fun removeViewAt(parent: HomeContainerSurfaceView, index: Int) {
    parent.removeReactChildAt(index)
  }

  override fun removeAllViews(parent: HomeContainerSurfaceView) {
    parent.removeAllReactChildren()
  }

  override fun onDropViewInstance(view: HomeContainerSurfaceView) {
    view.dispose()
    super.onDropViewInstance(view)
  }

  override fun needsCustomLayoutForChildren(): Boolean = true

  companion object {
    const val NAME = "OneKeyHomeContainerSurface"
  }
}
