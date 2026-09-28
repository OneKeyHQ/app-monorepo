package com.onekey.nativeoverlay

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup
import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.uimanager.ReactPointerEventsView
import java.lang.ref.WeakReference

/**
 * Page-scope overlays of one root route render inside this view. It sits in
 * the React tree (last child of the root-route screen), so the ReactRootView
 * already dispatches touches to the moved content.
 */
@SuppressLint("ViewConstructor")
class NativeOverlayPageHostView(context: Context) : ViewGroup(context), ReactPointerEventsView {
  // RN's TouchTargetHelper walks the native tree; without box-none this
  // full-screen host would become the JS target of every touch in the route.
  override val pointerEvents: PointerEvents = PointerEvents.BOX_NONE

  var hostKey: String = ""
    set(value) {
      if (field == value) return
      if (field.isNotEmpty() && registry[field]?.get() === this) registry.remove(field)
      field = value
      if (value.isNotEmpty()) registry[value] = WeakReference(this)
    }

  private var suspendedOwners: Set<String> = emptySet()

  fun setSuspendedOwners(joined: String?) {
    val owners = joined.orEmpty().split('\n').filter { it.isNotEmpty() }.toSet()
    if (owners == suspendedOwners) return
    suspendedOwners = owners
    entries().forEach(::applySuspension)
  }

  internal fun attach(entry: NativeOverlayEntryRootView) {
    if (entry.parent !== this) {
      (entry.parent as? ViewGroup)?.removeView(entry)
      val index = entries().indexOfFirst { sortKey(it) > sortKey(entry) }
        .let { if (it < 0) childCount else indexOfChild(entries()[it]) }
      addView(entry, index, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }
    layoutEntries()
    applySuspension(entry)
  }

  internal fun detach(entry: NativeOverlayEntryRootView) {
    removeView(entry)
  }

  /** Visible, input-ready entries in bottom-to-top order. */
  internal fun shownEntries(): List<NativeOverlayEntryRootView> =
    entries().filter { it.visibility == VISIBLE && it.isShownForInput }

  fun invalidateHost() {
    if (hostKey.isNotEmpty() && registry[hostKey]?.get() === this) registry.remove(hostKey)
  }

  private var layoutScheduled = false
  private val layoutRunnable = Runnable {
    layoutScheduled = false
    layoutEntries()
  }

  /**
   * This view sits inside Fabric's tree, where parents ignore requestLayout
   * and only Fabric calls layout(). Entries are native-only children, so lay
   * them out here whenever they (or their content) ask for it.
   */
  override fun requestLayout() {
    super.requestLayout()
    if (!layoutScheduled) {
      layoutScheduled = true
      post(layoutRunnable)
    }
  }

  private fun layoutEntries() {
    onLayout(false, left, top, right, bottom)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val width = r - l
    val height = b - t
    if (width <= 0 || height <= 0) return
    for (i in 0 until childCount) {
      val child = getChildAt(i)
      child.measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
      )
      child.layout(0, 0, width, height)
    }
  }

  private fun applySuspension(entry: NativeOverlayEntryRootView) {
    val hidden = entry.ownerKey in suspendedOwners
    val target = if (hidden) INVISIBLE else VISIBLE
    if (entry.visibility == target) return
    entry.visibility = target
    if (!hidden) {
      entry.alpha = 0f
      entry.animate().alpha(1f).setDuration(150).start()
    }
  }

  private fun entries(): List<NativeOverlayEntryRootView> =
    (0 until childCount).mapNotNull { getChildAt(it) as? NativeOverlayEntryRootView }

  private fun sortKey(entry: NativeOverlayEntryRootView): Long =
    entry.levelOrder.toLong() * 1_000_000_000L + entry.stackOrder

  companion object {
    private val registry = HashMap<String, WeakReference<NativeOverlayPageHostView>>()

    internal fun host(key: String): NativeOverlayPageHostView? = registry[key]?.get()

    internal fun allHosts(): List<NativeOverlayPageHostView> = registry.values.mapNotNull { it.get() }
  }
}
