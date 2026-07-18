package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.FrameLayout
import kotlin.math.abs

internal class HomeContainerSurfaceView(context: Context) : FrameLayout(context) {
  private val reactChildren = mutableListOf<View>()
  private var engine: HomeContainerView? = null
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var slotGestureCandidate: HomeContainerSlotView? = null
  private var forwardingSlotGesture = false
  private var horizontalSlotGesture = false
  private var slotDownX = 0f
  private var slotDownY = 0f
  private var slotDownEvent: MotionEvent? = null
  private var isSlotLayoutScheduled = false
  private val slotLayoutRunnable = Runnable {
    isSlotLayoutScheduled = false
    layoutSlotChildren()
  }

  init {
    clipChildren = true
  }

  fun addReactChild(child: View, index: Int) {
    val safeIndex = index.coerceIn(0, reactChildren.size)
    reactChildren.add(safeIndex, child)
    super.addView(child, safeIndex)
    connectEngineIfNeeded()
    requestLayout()
  }

  fun removeReactChildAt(index: Int) {
    val child = reactChildren.removeAt(index)
    super.removeView(child)
    connectEngineIfNeeded()
    requestLayout()
  }

  fun removeAllReactChildren() {
    reactChildren.clear()
    super.removeAllViews()
    connectEngineIfNeeded()
  }

  fun reactChildCount(): Int = reactChildren.size

  fun reactChildAt(index: Int): View = reactChildren[index]

  fun dispose() {
    resetSlotGesture()
    removeCallbacks(slotLayoutRunnable)
    isSlotLayoutScheduled = false
    engine?.onSlotLayoutChange = null
    engine = null
  }

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        resetSlotGesture()
        slotGestureCandidate = interactiveSlotAt(event.x, event.y)
        if (slotGestureCandidate != null) {
          slotDownX = event.x
          slotDownY = event.y
          slotDownEvent = MotionEvent.obtain(event)
        }
      }
      MotionEvent.ACTION_MOVE -> {
        val candidate = slotGestureCandidate ?: return false
        val dx = abs(event.x - slotDownX)
        val dy = abs(event.y - slotDownY)
        if (dx > touchSlop || dy > touchSlop) {
          horizontalSlotGesture = dx > dy
          if (
            horizontalSlotGesture &&
            candidate.slotKey.startsWith("content.footer.")
          ) {
            return false
          }
          forwardingSlotGesture = true
          return true
        }
      }
      MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_UP -> resetSlotGesture()
    }
    return false
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!forwardingSlotGesture) return super.onTouchEvent(event)
    val currentEngine = engine ?: run {
      resetSlotGesture()
      return false
    }
    slotDownEvent?.let { downEvent ->
      currentEngine.dispatchExternalTouchEvent(downEvent, horizontalSlotGesture)
      downEvent.recycle()
      slotDownEvent = null
    }
    currentEngine.dispatchExternalTouchEvent(event, horizontalSlotGesture)
    if (event.actionMasked == MotionEvent.ACTION_CANCEL ||
      event.actionMasked == MotionEvent.ACTION_UP
    ) {
      resetSlotGesture()
    }
    return true
  }

  fun layoutManagedChildren() {
    connectEngineIfNeeded()
    val currentEngine = engine
    currentEngine?.setMountedSlotKeys(
      reactChildren
        .filterIsInstance<HomeContainerSlotView>()
        .mapTo(mutableSetOf()) { it.slotKey },
    )
    reactChildren.forEach { child ->
      if (child !is HomeContainerSlotView) {
        child.visibility = VISIBLE
        child.layout(0, 0, width, height)
      }
    }
    layoutSlotChildren(currentEngine)
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
      val frame = currentEngine?.slotFrame(child.slotKey)
      if (frame == null || frame.width() <= 0 || frame.height() <= 0) {
        child.visibility = GONE
      } else {
        child.visibility = VISIBLE
        child.layout(frame.left, frame.top, frame.right, frame.bottom)
      }
    }
  }

  private fun scheduleSlotLayout() {
    if (isSlotLayoutScheduled) return
    isSlotLayoutScheduled = true
    post(slotLayoutRunnable)
  }

  private fun findEngine(view: View): HomeContainerView? {
    if (view is HomeContainerView) return view
    if (view !is ViewGroup) return null
    for (index in 0 until view.childCount) {
      findEngine(view.getChildAt(index))?.let { return it }
    }
    return null
  }

  private fun interactiveSlotAt(x: Float, y: Float): HomeContainerSlotView? =
    reactChildren.asReversed().firstOrNull { child ->
      child is HomeContainerSlotView &&
        child.visibility == VISIBLE &&
        x >= child.left && x <= child.right &&
        y >= child.top && y <= child.bottom
    } as? HomeContainerSlotView

  private fun resetSlotGesture() {
    slotDownEvent?.recycle()
    slotDownEvent = null
    slotGestureCandidate = null
    forwardingSlotGesture = false
    horizontalSlotGesture = false
  }
}
