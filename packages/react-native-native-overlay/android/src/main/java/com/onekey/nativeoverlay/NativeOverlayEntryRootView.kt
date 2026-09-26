package com.onekey.nativeoverlay

import android.annotation.SuppressLint
import android.graphics.Rect
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
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

  /** Union of the rendered React children; the React root fills the window. */
  fun contentExtent(): Rect {
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
