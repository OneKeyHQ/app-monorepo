package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout

internal class HomeContainerSurfaceView(context: Context) : FrameLayout(context) {
  private val reactChildren = mutableListOf<View>()
  private val slotParkingView = FrameLayout(context)
  private var engine: HomeContainerView? = null
  private var isSlotLayoutScheduled = false
  private val slotLayoutRunnable = Runnable {
    isSlotLayoutScheduled = false
    layoutSlotChildren()
  }

  init {
    clipChildren = true
    slotParkingView.visibility = GONE
    super.addView(slotParkingView, LayoutParams(0, 0))
  }

  fun addReactChild(child: View, index: Int) {
    val safeIndex = index.coerceIn(0, reactChildren.size)
    reactChildren.add(safeIndex, child)
    if (child is HomeContainerSlotView) {
      slotParkingView.addView(child)
      child.visibility = GONE
    } else {
      val physicalIndex = reactChildren
        .take(safeIndex)
        .count { reactChild -> reactChild !is HomeContainerSlotView }
      super.addView(child, physicalIndex)
    }
    connectEngineIfNeeded()
    requestLayout()
  }

  fun removeReactChildAt(index: Int) {
    val child = reactChildren.removeAt(index)
    (child.parent as? ViewGroup)?.removeView(child)
    connectEngineIfNeeded()
    requestLayout()
  }

  fun removeAllReactChildren() {
    reactChildren.forEach { child ->
      (child.parent as? ViewGroup)?.removeView(child)
    }
    reactChildren.clear()
    connectEngineIfNeeded()
  }

  fun reactChildCount(): Int = reactChildren.size

  fun reactChildAt(index: Int): View = reactChildren[index]

  fun dispose() {
    removeCallbacks(slotLayoutRunnable)
    isSlotLayoutScheduled = false
    engine?.onSlotLayoutChange = null
    engine = null
  }

  fun layoutManagedChildren() {
    connectEngineIfNeeded()
    val currentEngine = engine
    updateMountedSlotMetadata(currentEngine)
    reactChildren.forEach { child ->
      if (child !is HomeContainerSlotView) {
        child.visibility = VISIBLE
        child.layout(0, 0, width, height)
      }
    }
    layoutSlotChildren(currentEngine)
  }

  fun onSlotMetadataChanged() {
    connectEngineIfNeeded()
    updateMountedSlotMetadata(engine)
    requestLayout()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    layoutManagedChildren()
  }

  private fun connectEngineIfNeeded() {
    val nextEngine = reactChildren.firstNotNullOfOrNull { child ->
      if (child is HomeContainerSlotView) null else findEngine(child)
    }
    if (engine === nextEngine) return
    engine?.onSlotLayoutChange = null
    engine = nextEngine
    nextEngine?.onSlotLayoutChange = { scheduleSlotLayout() }
  }

  private fun layoutSlotChildren(currentEngine: HomeContainerView? = engine) {
    reactChildren.filterIsInstance<HomeContainerSlotView>().forEach { child ->
      val host = currentEngine?.slotHostView(child.slotKey)
      if (
        host == null ||
        host.visibility != VISIBLE ||
        !host.isAttachedToWindow ||
        host.width <= 0 ||
        host.height <= 0
      ) {
        parkSlot(child)
      } else {
        if (child.parent !== host) {
          (child.parent as? ViewGroup)?.removeView(child)
          host.addView(
            child,
            ViewGroup.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT,
            ),
          )
        }
        child.visibility = VISIBLE
        child.measure(
          MeasureSpec.makeMeasureSpec(host.width, MeasureSpec.EXACTLY),
          MeasureSpec.makeMeasureSpec(host.height, MeasureSpec.EXACTLY),
        )
        child.layout(0, 0, host.width, host.height)
      }
    }
  }

  private fun parkSlot(slot: HomeContainerSlotView) {
    if (slot.parent !== slotParkingView) {
      (slot.parent as? ViewGroup)?.removeView(slot)
      slotParkingView.addView(slot)
    }
    slot.visibility = GONE
    slot.layout(0, 0, 0, 0)
  }

  private fun scheduleSlotLayout() {
    if (isSlotLayoutScheduled) return
    isSlotLayoutScheduled = true
    post(slotLayoutRunnable)
  }

  private fun updateMountedSlotMetadata(currentEngine: HomeContainerView?) {
    val mountedSlots = reactChildren.filterIsInstance<HomeContainerSlotView>()
    currentEngine?.setMountedSlotMetadata(
      keys = mountedSlots.mapTo(mutableSetOf()) { it.slotKey },
      metadata = mountedSlots.mapNotNull(HomeContainerSlotView::mountedMetadata),
    )
  }

  private fun findEngine(view: View): HomeContainerView? {
    if (view is HomeContainerView) return view
    if (view !is ViewGroup) return null
    for (index in 0 until view.childCount) {
      findEngine(view.getChildAt(index))?.let { return it }
    }
    return null
  }
}
