package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout

internal class HomeContainerSlotView(context: Context) : FrameLayout(context) {
  private val reactChildren = mutableListOf<View>()

  var slotKey: String = ""
    set(value) {
      if (field == value) return
      field = value
      findSurface()?.requestLayout()
    }

  var ownerScopeKey: String = ""
    set(value) {
      if (field == value) return
      field = value
      notifyMetadataChanged()
    }

  var ownerSessionId: String = ""
    set(value) {
      if (field == value) return
      field = value
      notifyMetadataChanged()
    }

  var ownerAuthorized: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      importantForAccessibility = if (value) {
        IMPORTANT_FOR_ACCESSIBILITY_AUTO
      } else {
        IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
      }
    }

  init {
    clipChildren = true
    isClickable = true
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
  }

  fun addReactChild(child: View, index: Int) {
    val safeIndex = index.coerceIn(0, reactChildren.size)
    reactChildren.add(safeIndex, child)
    super.addView(child, safeIndex)
    requestLayout()
  }

  fun removeReactChildAt(index: Int) {
    reactChildren.removeAt(index)
    super.removeViewAt(index)
  }

  fun removeAllReactChildren() {
    reactChildren.clear()
    super.removeAllViews()
  }

  fun reactChildCount(): Int = reactChildren.size

  fun reactChildAt(index: Int): View = reactChildren[index]

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    reactChildren.forEach { child ->
      child.layout(0, 0, width, height)
    }
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean =
    if (ownerAuthorized) super.dispatchTouchEvent(event) else true

  private fun notifyMetadataChanged() {
    findSurface()?.onSlotMetadataChanged()
  }

  private fun findSurface(): HomeContainerSurfaceView? {
    var ancestor = parent
    while (ancestor is View) {
      if (ancestor is HomeContainerSurfaceView) return ancestor
      ancestor = ancestor.parent
    }
    return null
  }
}
