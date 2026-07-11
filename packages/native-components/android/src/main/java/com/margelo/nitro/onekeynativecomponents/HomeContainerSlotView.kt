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
      (parent as? HomeContainerSurfaceView)?.requestLayout()
    }

  init {
    clipChildren = true
    isClickable = true
    isFocusable = false
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

  override fun dispatchTouchEvent(event: MotionEvent): Boolean = super.dispatchTouchEvent(event)
}
