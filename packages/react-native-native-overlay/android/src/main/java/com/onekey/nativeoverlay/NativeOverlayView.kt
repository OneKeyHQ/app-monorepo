package com.onekey.nativeoverlay

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Color
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher

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
  var presentation: String = "center"
  var stackOrder = 0
  var blocking = true
  var dismissOnBackPress = true
  var dismissOnBackdropPress = false
  var backdropColor: Int? = null
  var animationConfig: String? = null
  var onPresented: ((Int) -> Unit)? = null
  var onDismissed: ((String) -> Unit)? = null
  var onRequestDismiss: ((String) -> Unit)? = null
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
    entry?.let { attachContent(it) }
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
    if (phase != Phase.HIDDEN) finishDismiss("system")
  }

  private fun present() {
    val activity = reactContext.currentActivity ?: return
    if (!isAttachedToWindow) return
    val overlayHost = NativeOverlayHost.of(activity)
    val target = entry ?: makeEntry()
    applyEntryConfiguration(target)
    host = overlayHost
    overlayHost.attach(target, NativeOverlayLevel.from(level))
    attachContent(target)

    val transition = config.enter.reduceMotionAdjusted(isReduceMotionEnabled())
    if (phase == Phase.HIDDEN) {
      hiddenState(target, transition).applyTo(target.contentView)
      target.backdropView.alpha = 0f
    }
    cancelAnimators()
    phase = Phase.ENTERING
    target.isShownForInput = true
    overlayHost.onEntriesChanged()
    if (blocking) {
      target.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
    }
    if (transition.kind == "none") {
      OverlayVisualState.IDENTITY.applyTo(target.contentView)
      target.backdropView.alpha = 1f
      phase = Phase.SHOWN
      onPresented?.invoke(stackOrder)
      return
    }
    animate(target, OverlayVisualState.IDENTITY, 1f, transition.motion) {
      if (phase == Phase.ENTERING) {
        phase = Phase.SHOWN
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
      contentChild?.let { child -> (child.parent as? ViewGroup)?.removeView(child) }
      host?.detach(target)
    }
    entry = null
    host = null
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
    val from = OverlayVisualState.of(target.contentView)
    contentAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = motion.durationMs()
      interpolator = motion.interpolator()
      addUpdateListener { from.lerp(to, it.animatedValue as Float).applyTo(target.contentView) }
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
    return when (transition.kind) {
      "slide" -> {
        val travel = transition.distanceDp?.let { (it * density).toFloat() } ?: when (transition.edge) {
          "top" -> extent.bottom.toFloat()
          "left" -> extent.right.toFloat()
          "right" -> (target.width - extent.left).toFloat()
          else -> (target.height - extent.top).toFloat()
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
        target.contentView.pivotX = extent.exactCenterX()
        target.contentView.pivotY = extent.exactCenterY()
        OverlayVisualState(alpha, 0f, (transition.offsetYDp * density).toFloat(), transition.scale)
      }
      else -> OverlayVisualState(alpha = alpha)
    }
  }

  private fun makeEntry(): NativeOverlayEntryRootView {
    val target = NativeOverlayEntryRootView(reactContext)
    target.eventDispatcher = eventDispatcher
    target.onRequestDismiss = { reason -> onRequestDismiss?.invoke(reason) }
    entry = target
    return target
  }

  private fun applyEntryConfiguration(target: NativeOverlayEntryRootView) {
    target.stackOrder = stackOrder
    target.updateBlocking(blocking)
    target.dismissOnBackPress = dismissOnBackPress
    target.dismissOnBackdropPress = dismissOnBackdropPress
    target.backdropView.setBackgroundColor(backdropColor ?: Color.TRANSPARENT)
  }

  private fun attachContent(target: NativeOverlayEntryRootView) {
    val child = contentChild ?: return
    if (child.parent === target.contentView) return
    (child.parent as? ViewGroup)?.removeView(child)
    target.contentView.addView(child)
  }

  private fun isReduceMotionEnabled(): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
}
