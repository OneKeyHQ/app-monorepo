package com.onekey.nativeoverlay

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Color
import android.provider.Settings
import android.view.View
import android.view.View.OnLayoutChangeListener
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher
import kotlin.math.abs

/** Visual state of the content between "hidden" (off stage) and identity. */
private data class OverlayVisualState(
  val alpha: Float = 1f,
  val translationX: Float = 0f,
  val translationY: Float = 0f,
  val scale: Float = 1f,
) {
  fun lerp(to: OverlayVisualState, t: Float) = OverlayVisualState(
    alpha + (to.alpha - alpha) * t,
    translationX + (to.translationX - translationX) * t,
    translationY + (to.translationY - translationY) * t,
    scale + (to.scale - scale) * t,
  )

  fun applyTo(view: View) {
    view.alpha = alpha.coerceIn(0f, 1f)
    view.translationX = translationX
    view.translationY = translationY
    view.scaleX = scale
    view.scaleY = scale
  }

  companion object {
    val IDENTITY = OverlayVisualState()

    fun of(view: View) = OverlayVisualState(view.alpha, view.translationX, view.translationY, view.scaleX)
  }
}

/**
 * The React-facing view. It never draws: its single React child is moved
 * into a [NativeOverlayEntryRootView] inside the activity's
 * [NativeOverlayHost] while visible.
 */
class NativeOverlayView(
  private val reactContext: ThemedReactContext,
) : ViewGroup(reactContext) {
  var visible = false
  var level: String = "modal"
  var scope: String = "global"
  var hostKey: String = ""
  var ownerKey: String = ""
  var presentation: String = "center"
  var stackOrder = 0
  var blocking = true
  var dismissOnBackPress = true
  var dismissOnBackdropPress = false
  var backdropColor: Int? = null
  var sheetHeight = 0.0
  var sheetCornerRadius = 24.0
  var showHandle = false
  var sheetBackgroundColor: Int? = null
  var dismissOnPanDown = true
  var animationConfig: String? = null
  var onPresented: ((Int) -> Unit)? = null
  var onDismissed: ((String) -> Unit)? = null
  var onRequestDismiss: ((String) -> Unit)? = null

  /**
   * Fabric state of the hand-written shadow node: the window origin (dp) of
   * wherever the content is drawn, so `measure` reports on-screen frames.
   */
  var stateWrapper: StateWrapper? = null
    set(value) {
      field = value
      pushContentOffset()
    }
  private var contentOffsetX = 0.0
  private var contentOffsetY = 0.0
  private val contentLayoutListener =
    OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> reportContentOffset() }
  var eventDispatcher: EventDispatcher? = null
    set(value) {
      field = value
      entry?.eventDispatcher = value
    }

  private enum class Phase { HIDDEN, ENTERING, SHOWN, EXITING }

  private var phase = Phase.HIDDEN
  private var contentChild: View? = null
  private var entry: NativeOverlayEntryRootView? = null
  private var host: NativeOverlayHost? = null
  private var pageHost: NativeOverlayPageHostView? = null
  private var contentAnimator: ValueAnimator? = null
  private var backdropAnimator: ValueAnimator? = null
  private var parsedConfigSource: String? = null
  private var config = OverlayAnimationConfig()
  private var cycleOpen = false

  init {
    visibility = INVISIBLE
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) = Unit

  fun addReactChild(child: View) {
    contentChild?.takeIf { it !== child }?.let(::removeReactChild)
    contentChild = child
    entry?.let { attachContent(it) } ?: stageContent()
  }

  fun getReactChildCount(): Int = if (contentChild == null) 0 else 1

  fun getReactChildAt(index: Int): View? = if (index == 0) contentChild else null

  fun removeReactChild(child: View) {
    if (contentChild !== child) return
    (child.parent as? ViewGroup)?.removeView(child)
    contentChild = null
  }

  fun commitConfiguration() {
    if (parsedConfigSource != animationConfig) {
      parsedConfigSource = animationConfig
      config = OverlayAnimationConfig.parse(animationConfig)
    }
    entry?.let(::applyEntryConfiguration)
    if (visible) {
      cycleOpen = true
      if (phase == Phase.HIDDEN || phase == Phase.EXITING) present()
    } else if (cycleOpen) {
      when (phase) {
        Phase.ENTERING, Phase.SHOWN -> dismiss()
        Phase.HIDDEN -> {
          cycleOpen = false
          onDismissed?.invoke("programmatic")
        }
        Phase.EXITING -> Unit
      }
    }
  }

  fun onDropViewInstance() {
    if (phase != Phase.HIDDEN) finishDismiss(null)
    onPresented = null
    onDismissed = null
    onRequestDismiss = null
    eventDispatcher = null
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    commitConfiguration()
  }

  // Detach from window (screen removed, activity destroyed) ends the overlay.
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    // A page overlay's owner screen detaches when another screen covers it;
    // the page host hides the entry, it is not closed.
    if (phase != Phase.HIDDEN && scope != "page") finishDismiss("system")
  }

  private fun present() {
    val activity = reactContext.currentActivity ?: return
    if (!isAttachedToWindow && scope != "page") return
    val overlayHost = NativeOverlayHost.of(activity)
    val target = entry ?: makeEntry()
    applyEntryConfiguration(target)
    if (scope == "page") {
      val page = NativeOverlayPageHostView.host(hostKey) ?: return
      target.dispatchesJsTouches = false
      target.levelOrder = NativeOverlayLevel.from(level).order
      target.ownerKey = ownerKey
      pageHost = page
      page.attach(target)
      // Back for page entries is resolved through the activity interceptor.
      overlayHost.installBackInterceptor()
    } else {
      host = overlayHost
      overlayHost.attach(target, NativeOverlayLevel.from(level))
    }
    attachContent(target)

    val transition = config.enter.reduceMotionAdjusted(isReduceMotionEnabled())
    if (phase == Phase.HIDDEN) {
      hiddenState(target, transition).applyTo(target.animatedView)
      target.backdropView.alpha = 0f
    }
    cancelAnimators()
    phase = Phase.ENTERING
    target.isShownForInput = true
    host?.onEntriesChanged()
    if (blocking) {
      target.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
    }
    if (transition.kind == "none") {
      OverlayVisualState.IDENTITY.applyTo(target.animatedView)
      target.backdropView.alpha = 1f
      phase = Phase.SHOWN
      reportContentOffset()
      onPresented?.invoke(stackOrder)
      return
    }
    animate(target, OverlayVisualState.IDENTITY, 1f, transition.motion) {
      if (phase == Phase.ENTERING) {
        phase = Phase.SHOWN
        reportContentOffset()
        onPresented?.invoke(stackOrder)
      }
    }
  }

  private fun dismiss() {
    val target = entry ?: return finishDismiss("programmatic")
    cancelAnimators()
    phase = Phase.EXITING
    target.isShownForInput = false
    host?.onEntriesChanged()
    val transition = config.exit.reduceMotionAdjusted(isReduceMotionEnabled())
    if (transition.kind == "none") return finishDismiss("programmatic")
    animate(target, hiddenState(target, transition), 0f, transition.motion) {
      if (phase == Phase.EXITING) finishDismiss("programmatic")
    }
  }

  /** `reason == null` tears down without notifying JS (view dropped). */
  private fun finishDismiss(reason: String?) {
    cancelAnimators()
    phase = Phase.HIDDEN
    entry?.let { target ->
      target.isShownForInput = false
      stageContent()
      host?.detach(target)
      pageHost?.detach(target)
    }
    entry = null
    host = null
    pageHost = null
    if (reason == null || !cycleOpen) return
    cycleOpen = visible
    onDismissed?.invoke(reason)
  }

  private fun animate(
    target: NativeOverlayEntryRootView,
    to: OverlayVisualState,
    backdropTo: Float,
    motion: OverlayMotion,
    onEnd: () -> Unit,
  ) {
    // Start from the current values so an interrupted run retargets smoothly.
    val animated = target.animatedView
    val from = OverlayVisualState.of(animated)
    contentAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = motion.durationMs()
      interpolator = motion.interpolator()
      addUpdateListener { from.lerp(to, it.animatedValue as Float).applyTo(animated) }
      addListener(object : AnimatorListenerAdapter() {
        private var cancelled = false

        override fun onAnimationCancel(animation: Animator) {
          cancelled = true
        }

        override fun onAnimationEnd(animation: Animator) {
          if (!cancelled) onEnd()
        }
      })
      start()
    }
    val backdropFrom = target.backdropView.alpha
    val backdropMotion = config.backdropMotion
    backdropAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = backdropMotion.durationMs()
      interpolator = backdropMotion.interpolator()
      addUpdateListener {
        val t = it.animatedValue as Float
        target.backdropView.alpha = (backdropFrom + (backdropTo - backdropFrom) * t).coerceIn(0f, 1f)
      }
      start()
    }
  }

  private fun cancelAnimators() {
    contentAnimator?.cancel()
    backdropAnimator?.cancel()
    contentAnimator = null
    backdropAnimator = null
  }

  /** The off-stage state: where enter starts and exit ends. */
  private fun hiddenState(target: NativeOverlayEntryRootView, transition: OverlayTransition): OverlayVisualState {
    val alpha = if (transition.hidesOpacity) 0f else 1f
    val extent = target.contentExtent()
    val density = resources.displayMetrics.density
    val isSheet = target.sheetView != null
    return when (transition.kind) {
      "slide" -> {
        val travel = transition.distanceDp?.let { (it * density).toFloat() } ?: when {
          // The sheet may not be laid out yet; its own height is the travel.
          isSheet && transition.edge == "bottom" ->
            maxOf(target.sheetHeightPx(), (sheetHeight * density).toInt()).toFloat()
          else -> when (transition.edge) {
          "top" -> extent.bottom.toFloat()
          "left" -> extent.right.toFloat()
          "right" -> (target.width - extent.left).toFloat()
          else -> (target.height - extent.top).toFloat()
          }
        }
        when (transition.edge) {
          "top" -> OverlayVisualState(alpha, 0f, -travel, 1f)
          "left" -> OverlayVisualState(alpha, -travel, 0f, 1f)
          "right" -> OverlayVisualState(alpha, travel, 0f, 1f)
          else -> OverlayVisualState(alpha, 0f, travel, 1f)
        }
      }
      "scale" -> {
        // Scale around the content's center, not the full-window root's.
        target.animatedView.pivotX = extent.exactCenterX() - target.animatedView.left
        target.animatedView.pivotY = extent.exactCenterY() - target.animatedView.top
        OverlayVisualState(alpha, 0f, (transition.offsetYDp * density).toFloat(), transition.scale)
      }
      else -> OverlayVisualState(alpha = alpha)
    }
  }

  private fun makeEntry(): NativeOverlayEntryRootView {
    val target = NativeOverlayEntryRootView(reactContext)
    target.eventDispatcher = eventDispatcher
    target.onRequestDismiss = { reason -> onRequestDismiss?.invoke(reason) }
    target.onSheetHiddenByPan = {
      if (phase == Phase.SHOWN || phase == Phase.ENTERING) {
        // Already off screen: tear down, then let JS close the entry; the
        // next visible=false commit reports onDismissed.
        finishDismiss(null)
        onRequestDismiss?.invoke("pan")
      }
    }
    entry = target
    return target
  }

  private fun applyEntryConfiguration(target: NativeOverlayEntryRootView) {
    target.stackOrder = stackOrder
    target.updateBlocking(blocking)
    target.dismissOnBackPress = dismissOnBackPress
    target.dismissOnBackdropPress = dismissOnBackdropPress
    target.backdropView.setBackgroundColor(backdropColor ?: Color.TRANSPARENT)
    if (presentation == "sheet") {
      val density = resources.displayMetrics.density
      target.configureSheet(
        heightPx = (sheetHeight * density).toInt().coerceAtLeast(1),
        cornerRadiusPx = (sheetCornerRadius * density).toFloat(),
        backgroundColor = sheetBackgroundColor ?: Color.WHITE,
        showHandle = showHandle,
        draggable = dismissOnPanDown,
      )
    }
  }

  /**
   * While hidden, keep the React child inside this invisible view. Fabric only
   * reports onLayout for attached views, and fitted sheets size themselves
   * from that measurement before presenting.
   */
  private fun stageContent() {
    val child = contentChild ?: return
    if (child.parent === this) return
    moveContent(child, this)
  }

  private fun attachContent(target: NativeOverlayEntryRootView) {
    val child = contentChild ?: return
    if (child.parent === target.contentView) return
    moveContent(child, target.contentView)
  }

  private fun moveContent(child: View, container: ViewGroup) {
    (child.parent as? ViewGroup)?.let { previous ->
      previous.removeOnLayoutChangeListener(contentLayoutListener)
      previous.removeView(child)
    }
    container.addView(child)
    container.addOnLayoutChangeListener(contentLayoutListener)
    reportContentOffset()
  }

  /** Window origin of the content's container, ignoring running animations. */
  private fun reportContentOffset() {
    val container = contentChild?.parent as? View ?: return
    var x = 0f
    var y = 0f
    var current: View? = container
    while (current != null) {
      x += current.left
      y += current.top
      val parent = current.parent as? View
      if (parent != null) {
        x -= parent.scrollX
        y -= parent.scrollY
      }
      current = parent
    }
    val density = resources.displayMetrics.density
    contentOffsetX = (x / density).toDouble()
    contentOffsetY = (y / density).toDouble()
    pushContentOffset()
  }

  private fun pushContentOffset() {
    val wrapper = stateWrapper ?: return
    val data = wrapper.stateData
    if (data != null && data.hasKey("x") && data.hasKey("y") &&
      abs(data.getDouble("x") - contentOffsetX) < 0.5 &&
      abs(data.getDouble("y") - contentOffsetY) < 0.5
    ) {
      return
    }
    wrapper.updateState(
      Arguments.createMap().apply {
        putDouble("x", contentOffsetX)
        putDouble("y", contentOffsetY)
      },
    )
  }

  private fun isReduceMotionEnabled(): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
}
