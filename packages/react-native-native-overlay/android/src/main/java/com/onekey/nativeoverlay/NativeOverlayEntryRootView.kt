package com.onekey.nativeoverlay

import android.annotation.SuppressLint
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.coordinatorlayout.widget.CoordinatorLayout
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.uimanager.JSPointerDispatcher
import com.facebook.react.uimanager.JSTouchDispatcher
import com.facebook.react.uimanager.RootView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher

/**
 * Keeps Fabric-assigned frames: the React root inside is laid out by Yoga
 * (window size from JS), so this container must not re-layout it.
 */
internal class NativeOverlayContentView(context: ThemedReactContext) : ViewGroup(context) {
  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit
}

/**
 * One overlay entry. React children mounted here are outside their
 * ReactRootView, so this root mirrors RN Modal's touch dispatch boundary
 * (JSTouchDispatcher / JSPointerDispatcher) to keep Pressability and native
 * gesture cancellation working after reparenting.
 */
@SuppressLint("ViewConstructor")
internal class NativeOverlayEntryRootView(
  private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext), RootView {
  var eventDispatcher: EventDispatcher? = null
  var stackOrder = 0
  var blocking = true
  var dismissOnBackPress = true
  var dismissOnBackdropPress = false
  var isShownForInput = false
  var onRequestDismiss: ((String) -> Unit)? = null

  val backdropView = View(reactContext).apply { alpha = 0f }
  val contentView = NativeOverlayContentView(reactContext)

  /** `sheet` presentation: the draggable surface; otherwise null. */
  var sheetView: FrameLayout? = null
    private set
  private var sheetBehavior: BottomSheetBehavior<FrameLayout>? = null
  private var handleView: View? = null
  var onSheetHiddenByPan: (() -> Unit)? = null

  /** The view that enter / exit animations move. */
  val animatedView: View get() = sheetView ?: contentView

  private val touchDispatcher = JSTouchDispatcher(this)
  private val pointerDispatcher = if (ReactFeatureFlags.dispatchPointerEvents) {
    JSPointerDispatcher(this)
  } else {
    null
  }
  private var passingThrough = false
  private val hitRect = Rect()

  init {
    clipChildren = false
    addView(backdropView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(contentView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    backdropView.setOnClickListener {
      if (dismissOnBackdropPress) onRequestDismiss?.invoke("backdrop")
    }
  }

  fun updateBlocking(value: Boolean) {
    blocking = value
    // A clickable backdrop consumes touches that miss the content.
    backdropView.isClickable = value
    backdropView.importantForAccessibility =
      if (value) IMPORTANT_FOR_ACCESSIBILITY_NO else IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
  }

  /**
   * Hosts the content in a bottom sheet driven by BottomSheetBehavior, the
   * same drag / nested-scroll mechanics as the previous BottomSheetDialog,
   * but inside this layer instead of a separate window.
   */
  fun configureSheet(
    heightPx: Int,
    cornerRadiusPx: Float,
    backgroundColor: Int,
    showHandle: Boolean,
    draggable: Boolean,
  ) {
    val sheet = sheetView ?: createSheet()
    (sheet.background as? GradientDrawable)?.apply {
      setColor(backgroundColor)
      cornerRadii = floatArrayOf(
        cornerRadiusPx, cornerRadiusPx, cornerRadiusPx, cornerRadiusPx, 0f, 0f, 0f, 0f,
      )
    }
    handleView?.visibility = if (showHandle) VISIBLE else GONE
    sheetBehavior?.apply {
      isDraggable = draggable
      isHideable = draggable
    }
    val params = sheet.layoutParams
    if (params.height != heightPx) {
      params.height = heightPx
      sheet.layoutParams = params
    }
  }

  private fun createSheet(): FrameLayout {
    removeView(contentView)
    val coordinator = CoordinatorLayout(reactContext)
    addView(coordinator, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    val sheet = FrameLayout(reactContext).apply {
      background = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE }
      clipToOutline = true
      isClickable = true
    }
    sheet.addView(contentView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    val density = resources.displayMetrics.density
    val handle = View(reactContext).apply {
      background = GradientDrawable().apply {
        cornerRadius = 2.5f * density
        setColor(0x33000000)
      }
      importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    sheet.addView(
      handle,
      LayoutParams((36 * density).toInt(), (5 * density).toInt()).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        topMargin = (8 * density).toInt()
      },
    )
    val behavior = BottomSheetBehavior<FrameLayout>().apply {
      skipCollapsed = true
      isFitToContents = true
      state = BottomSheetBehavior.STATE_EXPANDED
      addBottomSheetCallback(object : BottomSheetBehavior.BottomSheetCallback() {
        override fun onStateChanged(bottomSheet: View, newState: Int) {
          if (newState == BottomSheetBehavior.STATE_HIDDEN) onSheetHiddenByPan?.invoke()
        }

        override fun onSlide(bottomSheet: View, slideOffset: Float) {
          // slideOffset runs from 0 (expanded) to -1 (hidden) while dragging down.
          if (slideOffset <= 0f) backdropView.alpha = (1f + slideOffset).coerceIn(0f, 1f)
        }
      })
    }
    coordinator.addView(
      sheet,
      CoordinatorLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        this.behavior = behavior
      },
    )
    sheetView = sheet
    sheetBehavior = behavior
    handleView = handle
    return sheet
  }

  /** Union of the rendered React children; the React root fills the window. */
  fun contentExtent(): Rect {
    sheetView?.let { sheet ->
      val top = height - sheet.layoutParams.height
      return Rect(0, top, width, height)
    }
    val union = Rect()
    for (i in 0 until contentView.childCount) {
      val root = contentView.getChildAt(i) as? ViewGroup ?: continue
      for (j in 0 until root.childCount) {
        val child = root.getChildAt(j)
        if (child.visibility != View.VISIBLE) continue
        child.getHitRect(hitRect)
        hitRect.offset(root.left, root.top)
        union.union(hitRect)
      }
    }
    if (union.isEmpty) union.set(0, 0, width, height)
    return union
  }

  private fun hitsContent(event: MotionEvent): Boolean {
    val extent = contentExtent()
    val x = event.x - contentView.left - contentView.translationX
    val y = event.y - contentView.top - contentView.translationY
    return extent.contains(x.toInt(), y.toInt())
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!isShownForInput) return false
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      // Non-blocking overlays (toasts) only take touches that land on content.
      passingThrough = !blocking && !hitsContent(event)
    }
    if (passingThrough) return false
    return super.dispatchTouchEvent(event)
  }

  override fun handleException(t: Throwable) {
    reactContext.reactApplicationContext.handleException(RuntimeException(t))
  }

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { dispatcher ->
      touchDispatcher.handleTouchEvent(event, dispatcher, reactContext)
      pointerDispatcher?.handleMotionEvent(event, dispatcher, true)
    }
    return super.onInterceptTouchEvent(event)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { dispatcher ->
      touchDispatcher.handleTouchEvent(event, dispatcher, reactContext)
      pointerDispatcher?.handleMotionEvent(event, dispatcher, false)
    }
    super.onTouchEvent(event)
    return true
  }

  override fun onInterceptHoverEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { pointerDispatcher?.handleMotionEvent(event, it, true) }
    return super.onInterceptHoverEvent(event)
  }

  override fun onHoverEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { pointerDispatcher?.handleMotionEvent(event, it, false) }
    return super.onHoverEvent(event)
  }

  @OptIn(UnstableReactNativeAPI::class)
  override fun onChildStartedNativeGesture(childView: View?, ev: MotionEvent) {
    eventDispatcher?.let { dispatcher ->
      touchDispatcher.onChildStartedNativeGesture(ev, dispatcher, reactContext)
      pointerDispatcher?.onChildStartedNativeGesture(childView, ev, dispatcher)
    }
  }

  override fun onChildEndedNativeGesture(childView: View, ev: MotionEvent) {
    eventDispatcher?.let { touchDispatcher.onChildEndedNativeGesture(ev, it) }
    pointerDispatcher?.onChildEndedNativeGesture()
  }

  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) = Unit
}
