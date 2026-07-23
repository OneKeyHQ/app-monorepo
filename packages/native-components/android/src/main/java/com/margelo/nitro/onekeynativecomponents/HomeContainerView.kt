package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.graphics.drawable.TransitionDrawable
import android.text.SpannableString
import android.text.Spanned
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.TouchDelegate
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.PathParser
import androidx.core.view.setPadding
import androidx.recyclerview.widget.DefaultItemAnimator
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.ViewPager2
import com.margelo.nitro.skeleton.SkeletonNativeView
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

private fun HomeContainerTheme.skeletonGradientColors(): Array<String> {
  val background = parseHomeContainerColor(backgroundColor, Color.WHITE)
  val red = Color.red(background) / 255.0
  val green = Color.green(background) / 255.0
  val blue = Color.blue(background) / 255.0
  val luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  return if (luminance < 0.5) {
    arrayOf("#111111", "#333333")
  } else {
    arrayOf("#fafafa", "#cdcdcd")
  }
}

private fun SkeletonNativeView.applyHomeContainerSkeletonTheme(theme: HomeContainerTheme) {
  configure(shimmerSpeed = 3.0, shimmerGradientColors = theme.skeletonGradientColors())
}

private data class HomeContainerTabViewKey(
  val id: String,
  val title: String,
  val destination: HomeContainerTabDestination,
)

internal fun homeContainerTabsRequireRebuild(
  previous: List<HomeContainerTab>,
  next: List<HomeContainerTab>,
): Boolean = previous.map { tab ->
  HomeContainerTabViewKey(tab.id, tab.title, tab.destination)
} != next.map { tab ->
  HomeContainerTabViewKey(tab.id, tab.title, tab.destination)
}

internal fun homeContainerChangedInlineTabIds(
  previous: HomeContainerSnapshot?,
  next: HomeContainerSnapshot,
): Set<String> {
  val nextTabs = next.inlineTabs()
  if (previous == null || previous.theme != next.theme) {
    return nextTabs.mapTo(linkedSetOf()) { it.id }
  }
  val previousById = previous.inlineTabs().associateBy { it.id }
  return nextTabs
    .filterTo(mutableListOf()) { tab -> previousById[tab.id] != tab }
    .mapTo(linkedSetOf()) { it.id }
}

private fun HomeContainerItem.isHomeContainerStateItem(): Boolean =
  renderer == "loading" || renderer == "empty"

internal fun homeContainerSectionsForRendering(
  sections: List<HomeContainerSection>,
): List<HomeContainerSection> = sections.filterNot { stateSection ->
    stateSection.items.any(HomeContainerItem::isHomeContainerStateItem) &&
      sections.any { candidate ->
        candidate.id != stateSection.id &&
          candidate.items.any { item -> !item.isHomeContainerStateItem() } &&
          homeContainerSectionsAreStateCounterparts(stateSection.id, candidate.id)
      }
  }

private fun homeContainerSectionsAreStateCounterparts(
  stateSectionId: String,
  terminalSectionId: String,
): Boolean = when (stateSectionId) {
  "portfolio-state" -> terminalSectionId == "portfolio-assets"
  "defi-state" -> terminalSectionId == "defi-protocols"
  "nft-state" -> terminalSectionId == "nft-collectibles"
  "history-state" -> terminalSectionId.startsWith("history:")
  else -> false
}

internal fun homeContainerStatePosition(sections: List<HomeContainerSection>): Int =
  sections.asSequence()
    .flatMap { it.items.asSequence() }
    .indexOfFirst(HomeContainerItem::isHomeContainerStateItem)

internal fun homeContainerShouldIgnoreProgrammaticPageSelection(
  pendingTargetTabId: String?,
  selectedPageTabId: String,
): Boolean = pendingTargetTabId != null && pendingTargetTabId != selectedPageTabId

internal fun homeContainerShouldAnimateTabSelection(
  requestedAnimated: Boolean,
  @Suppress("UNUSED_PARAMETER") isDirectTabPress: Boolean,
): Boolean = requestedAnimated

internal fun homeContainerShouldPreservePendingPageTransition(
  pendingTargetTabId: String?,
  requestedTabId: String,
): Boolean = pendingTargetTabId == requestedTabId

internal fun homeContainerShouldCompletePendingPageTransition(
  pendingTargetTabId: String?,
  currentTabId: String,
  isIdle: Boolean,
): Boolean = isIdle && pendingTargetTabId == currentTabId

internal fun homeContainerShouldReconcileDeferredPageSelection(
  requestedTabId: String,
  selectedTabId: String,
  requestedIndex: Int,
  tabIdAtRequestedIndex: String?,
): Boolean =
  requestedIndex >= 0 &&
    requestedTabId == selectedTabId &&
    tabIdAtRequestedIndex == requestedTabId

internal data class HomeContainerCompletedRender(
  val state: HomeContainerProtocolV2State,
  val acknowledgement: String,
)

private data class HomeContainerPendingRender(
  val state: HomeContainerProtocolV2State,
  var requiredTabId: String,
  val acknowledgement: String,
)

private data class HomeContainerPageRenderProgress(
  val instanceId: String,
  var listCommittedRevision: Long = -1L,
  var preDrawAfterCommitRevision: Long = -1L,
)

internal class HomeContainerRenderCompletionCoordinator {
  private val pendingRenders = sortedMapOf<Long, HomeContainerPendingRender>()
  private val pageProgressByTab = mutableMapOf<String, HomeContainerPageRenderProgress>()

  fun enqueue(
    state: HomeContainerProtocolV2State,
    requiredTabId: String,
    acknowledgement: String,
  ) {
    pendingRenders[state.revision] = HomeContainerPendingRender(
      state = state,
      requiredTabId = requiredTabId,
      acknowledgement = acknowledgement,
    )
  }

  fun retargetPending(tabId: String) {
    pendingRenders.values.forEach { pending -> pending.requiredTabId = tabId }
  }

  fun registerPage(tabId: String, instanceId: String) {
    val current = pageProgressByTab[tabId]
    if (current?.instanceId == instanceId) return
    pageProgressByTab[tabId] = HomeContainerPageRenderProgress(instanceId)
  }

  fun unregisterPage(tabId: String, instanceId: String) {
    if (pageProgressByTab[tabId]?.instanceId == instanceId) {
      pageProgressByTab.remove(tabId)
    }
  }

  fun markListCommitted(tabId: String, instanceId: String, revision: Long) {
    val progress = activePage(tabId, instanceId) ?: return
    progress.listCommittedRevision = maxOf(progress.listCommittedRevision, revision)
  }

  fun markPreDraw(
    tabId: String,
    instanceId: String,
    revision: Long,
  ): List<HomeContainerCompletedRender> {
    val progress = activePage(tabId, instanceId) ?: return emptyList()
    val revisionDrawnAfterCommit = minOf(revision, progress.listCommittedRevision)
    if (revisionDrawnAfterCommit >= 0) {
      progress.preDrawAfterCommitRevision = maxOf(
        progress.preDrawAfterCommitRevision,
        revisionDrawnAfterCommit,
      )
    }
    return drainCompletedRenders()
  }

  fun reset() {
    pendingRenders.clear()
    pageProgressByTab.clear()
  }

  private fun activePage(
    tabId: String,
    instanceId: String,
  ): HomeContainerPageRenderProgress? =
    pageProgressByTab[tabId]?.takeIf { progress -> progress.instanceId == instanceId }

  private fun drainCompletedRenders(): List<HomeContainerCompletedRender> = buildList {
    while (pendingRenders.isNotEmpty()) {
      val (revision, pending) = pendingRenders.entries.first()
      val progress = pageProgressByTab[pending.requiredTabId] ?: break
      if (
        minOf(
          progress.listCommittedRevision,
          progress.preDrawAfterCommitRevision,
        ) < revision
      ) {
        break
      }
      pendingRenders.remove(revision)
      add(
        HomeContainerCompletedRender(
          state = pending.state,
          acknowledgement = pending.acknowledgement,
        ),
      )
    }
  }
}

internal fun homeContainerDuplicateIsRendered(
  renderedState: HomeContainerProtocolV2State?,
  duplicate: HomeContainerProtocolV2ApplyOutcome.Duplicate,
): Boolean = renderedState?.let { state ->
  state.owner == duplicate.owner && state.revision >= duplicate.revision
} == true

internal class HomeContainerView(context: Context) : FrameLayout(context) {
  var onAction: ((String, String, String) -> Unit)? = null
  var onRefresh: ((String, String) -> Unit)? = null
  var onVisibleTabChange: ((String) -> Unit)? = null
  var onRenderError: ((String, String) -> Unit)? = null
  var onIntent: ((String) -> Unit)? = null
  var onTransportResult: ((String) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null

  private val parser = Executors.newSingleThreadExecutor()
  private val disposed = AtomicBoolean(false)
  private val pager = ViewPager2(context)
  private var adapter = HomePagerAdapter()
  private val headerView = HomeHeaderView(context)
  private val tabsView = HomeTabsView(context)
  private val renderCompletionCoordinator = HomeContainerRenderCompletionCoordinator()
  private val refreshPages = mutableMapOf<String, HomePageView>()
  private var snapshot: HomeContainerSnapshot? = null
  private var protocolV2State: HomeContainerProtocolV2State? = null
  private var renderedProtocolV2State: HomeContainerProtocolV2State? = null
  private var protocolV3State: HomeContainerProtocolV3State? = null
  private var renderedProtocolV3State: HomeContainerProtocolV3State? = null
  private var pendingProtocolV3PatchJson: String? = null
  private var pendingProtocolV3PatchRetryScheduled = false
  private var lastNeedSnapshotResultKey: String? = null
  private var fallbackBackgroundColor = Color.WHITE
  private var selectedTabId = ""
  private var pendingProgrammaticTabId: String? = null
  private var suppressPageCallback = false
  private var refreshEnabled = false
  private var headerHeight = 0
  private var collapseOffset = 0
  private var refreshPullOffset = 0
  private var mountedSlotKeys = emptySet<String>()
  private var mountedSlotMetadata = emptyList<HomeContainerProtocolV3MountedSlotMetadata>()
  private val chromeTouchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var chromeGestureCandidate = false
  private var interceptingChromeVertical = false
  private var chromeDownX = 0f
  private var chromeDownY = 0f
  private var chromeDownEvent: MotionEvent? = null
  private var externalHorizontalTarget: View? = null

  init {
    clipChildren = true
    pager.orientation = ViewPager2.ORIENTATION_HORIZONTAL
    // The Store snapshot is the only owner of the selected Home tab. Restoring
    // ViewPager2 state independently can leave currentItem pointing at one tab
    // while its RecyclerView still displays a holder restored for another.
    pager.isSaveEnabled = false
    pager.adapter = adapter
    (pager.getChildAt(0) as? RecyclerView)?.isSaveEnabled = false
    pager.offscreenPageLimit = 5
    addView(pager, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(headerView, LayoutParams(LayoutParams.MATCH_PARENT, 0))
    addView(tabsView, LayoutParams(LayoutParams.MATCH_PARENT, dp(TAB_HEIGHT_DP)))
    headerView.onAction = { actionId, itemId ->
      emitAction(actionId, itemId, selectedTabId)
    }
    tabsView.onAction = { actionId, itemId ->
      emitAction(actionId, itemId, selectedTabId)
    }
    tabsView.onSelect = { tabId ->
      moveToTab(
        tabId,
        homeContainerShouldAnimateTabSelection(
          requestedAnimated = true,
          isDirectTabPress = true,
        ),
        true,
      )
    }
    headerView.onSlotLayoutChange = { onSlotLayoutChange?.invoke() }
    tabsView.onSlotLayoutChange = { onSlotLayoutChange?.invoke() }
    pager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
      override fun onPageSelected(position: Int) {
        if (suppressPageCallback) return
        val tab = adapter.tabAt(position) ?: return
        if (homeContainerShouldIgnoreProgrammaticPageSelection(pendingProgrammaticTabId, tab.id)) {
          return
        }
        val source = adapter.pageForTab(selectedTabId)
        val target = adapter.pageForTab(tab.id)
        if (source != null && target != null) {
          target.synchronizeCollapseOffset(source.collapseOffset)
        }
        if (selectedTabId != tab.id) {
          selectedTabId = tab.id
          adapter.setSelectedTab(tab.id)
          tabsView.setSelectedTab(tab.id)
          collapseOffset = target?.collapseOffset ?: 0
          refreshPullOffset = target?.refreshPullOffset ?: 0
          updateSharedChromePosition()
          emitTabSelection(tab.id)
          protocolV2State?.revision?.let(::awaitSelectedPageRender)
        }
      }

      override fun onPageScrollStateChanged(state: Int) {
        val currentTabId = adapter.tabAt(pager.currentItem)?.id ?: return
        if (
          homeContainerShouldCompletePendingPageTransition(
            pendingProgrammaticTabId,
            currentTabId,
            state == ViewPager2.SCROLL_STATE_IDLE,
          )
        ) {
          pendingProgrammaticTabId = null
          val targetIndex = adapter.positionForTab(currentTabId)
          if (targetIndex >= 0) {
            // ViewPager2 can publish the target currentItem before its internal
            // RecyclerView has physically settled there. Snap once at IDLE so
            // the selected tab and rendered holder cannot diverge.
            setPagerCurrentItem(targetIndex, false)
          }
        }
      }
    })
  }

  fun submitSnapshot(json: String) {
    parser.execute {
      if (disposed.get()) return@execute
      if (HomeContainerProtocolV3Transaction.isProtocolPayload(json, "snapshot")) {
        post {
          pendingProtocolV3PatchJson = null
          handleProtocolV3Outcome(
            HomeContainerProtocolV3Transaction.applySnapshot(json),
          )
        }
        return@execute
      }
      if (HomeContainerProtocolV2Transaction.isProtocolPayload(json, "snapshot")) {
        post {
          pendingProtocolV3PatchJson = null
          protocolV3State = null
          renderedProtocolV3State = null
          handleProtocolV2Outcome(
            HomeContainerProtocolV2Transaction.applySnapshot(json, protocolV2State),
          )
        }
        return@execute
      }
      try {
        val next = HomeContainerJson.parseSnapshot(json)
        if (next.schemaVersion != SCHEMA_VERSION) {
          reportError(
            "unsupported_schema",
            "HomeContainer schema ${next.schemaVersion} is not supported",
          )
          return@execute
        }
        post {
          pendingProtocolV3PatchJson = null
          protocolV2State = null
          renderedProtocolV2State = null
          protocolV3State = null
          renderedProtocolV3State = null
          renderCompletionCoordinator.reset()
          lastNeedSnapshotResultKey = null
          applySnapshot(next)
        }
      } catch (error: Exception) {
        reportError("snapshot_decode_failed", error.message ?: error.javaClass.simpleName)
      }
    }
  }

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        chromeGestureCandidate = isTouchInsideSharedChrome(event.x, event.y)
        interceptingChromeVertical = false
        chromeDownX = event.x
        chromeDownY = event.y
        if (chromeGestureCandidate) {
          chromeDownEvent = MotionEvent.obtain(event)
        }
      }
      MotionEvent.ACTION_MOVE -> {
        if (!chromeGestureCandidate) return false
        val dx = abs(event.x - chromeDownX)
        val dy = abs(event.y - chromeDownY)
        if (dy > chromeTouchSlop && dy > dx) {
          interceptingChromeVertical = true
          parent?.requestDisallowInterceptTouchEvent(true)
          return true
        }
        if (dx > chromeTouchSlop && dx > dy) {
          resetChromeGesture()
        }
      }
      MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_UP -> resetChromeGesture()
    }
    return false
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!interceptingChromeVertical) return super.onTouchEvent(event)
    chromeDownEvent?.let { downEvent ->
      dispatchChromeVerticalTouch(downEvent)
      downEvent.recycle()
      chromeDownEvent = null
    }
    val handled = dispatchChromeVerticalTouch(event)
    if (event.actionMasked == MotionEvent.ACTION_UP ||
      event.actionMasked == MotionEvent.ACTION_CANCEL
    ) {
      resetChromeGesture()
    }
    return handled
  }

  private fun dispatchChromeVerticalTouch(event: MotionEvent): Boolean {
    val page = adapter.pageForTab(selectedTabId) ?: return false
    val forwardedEvent = MotionEvent.obtain(event)
    return try {
      val sourceLocation = IntArray(2)
      getLocationInWindow(sourceLocation)
      page.dispatchExternalTouchEvent(forwardedEvent, sourceLocation)
    } finally {
      forwardedEvent.recycle()
    }
  }

  private fun isTouchInsideSharedChrome(x: Float, y: Float): Boolean =
    isPointInsideView(headerView, x, y) || isPointInsideView(tabsView, x, y)

  private fun isPointInsideView(view: View, x: Float, y: Float): Boolean =
    view.visibility == VISIBLE &&
      x >= view.x && x <= view.x + view.width &&
      y >= view.y && y <= view.y + view.height

  private fun resetChromeGesture() {
    chromeDownEvent?.recycle()
    chromeDownEvent = null
    chromeGestureCandidate = false
    interceptingChromeVertical = false
    parent?.requestDisallowInterceptTouchEvent(false)
  }

  fun submitPatch(json: String) {
    parser.execute {
      if (disposed.get()) return@execute
      if (HomeContainerProtocolV3Transaction.isProtocolPayload(json, "patch")) {
        post {
          applyProtocolV3PatchOrDefer(json)
        }
        return@execute
      }
      if (HomeContainerProtocolV2Transaction.isProtocolPayload(json, "patch")) {
        post {
          pendingProtocolV3PatchJson = null
          protocolV3State = null
          renderedProtocolV3State = null
          handleProtocolV2Outcome(
            HomeContainerProtocolV2Transaction.applyPatch(json, protocolV2State),
          )
        }
        return@execute
      }
      try {
        val patch = HomeContainerJson.parsePatch(json)
        if (patch.schemaVersion != SCHEMA_VERSION) {
          reportError(
            "unsupported_schema",
            "HomeContainer patch schema ${patch.schemaVersion} is not supported",
          )
          return@execute
        }
        post { applyPatch(patch) }
      } catch (error: Exception) {
        reportError("patch_decode_failed", error.message ?: error.javaClass.simpleName)
      }
    }
  }

  fun completeRefresh(requestId: String) {
    post {
      refreshPages.remove(requestId)?.endRefreshing()
    }
  }

  fun selectTab(tabId: String, animated: Boolean) {
    post { moveToTab(tabId, animated, false) }
  }

  fun dispatchExternalTouchEvent(event: MotionEvent, horizontal: Boolean): Boolean {
    val forwardedEvent = MotionEvent.obtain(event)
    return try {
      if (horizontal) {
        if (event.actionMasked == MotionEvent.ACTION_DOWN) {
          val rootLocation = IntArray(2)
          getLocationInWindow(rootLocation)
          val windowX = rootLocation[0] + event.x
          val windowY = rootLocation[1] + event.y
          externalHorizontalTarget =
            headerView.horizontalScrollTargetAt(windowX, windowY)
              ?: tabsView.horizontalScrollTargetAt(windowX, windowY)
              ?: pager
        }
        val target = externalHorizontalTarget ?: pager
        val sourceLocation = IntArray(2)
        val targetLocation = IntArray(2)
        getLocationInWindow(sourceLocation)
        target.getLocationInWindow(targetLocation)
        forwardedEvent.offsetLocation(
          (sourceLocation[0] - targetLocation[0]).toFloat(),
          (sourceLocation[1] - targetLocation[1]).toFloat(),
        )
        val handled = target.dispatchTouchEvent(forwardedEvent)
        if (event.actionMasked == MotionEvent.ACTION_CANCEL ||
          event.actionMasked == MotionEvent.ACTION_UP
        ) {
          externalHorizontalTarget = null
        }
        handled
      } else {
        val sourceLocation = IntArray(2)
        getLocationInWindow(sourceLocation)
        adapter.pageForTab(selectedTabId)
          ?.dispatchExternalTouchEvent(forwardedEvent, sourceLocation)
          ?: dispatchTouchEvent(forwardedEvent)
      }
    } finally {
      forwardedEvent.recycle()
    }
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    if (mountedSlotKeys == keys) return
    mountedSlotKeys = keys
    headerView.setMountedSlotKeys(keys)
    tabsView.setMountedSlotKeys(keys)
    adapter.pages().forEach { it.setMountedSlotKeys(keys) }
    updateSharedChromeLayout()
    requestLayout()
    onSlotLayoutChange?.invoke()
  }

  fun setMountedSlotMetadata(
    keys: Set<String>,
    metadata: List<HomeContainerProtocolV3MountedSlotMetadata>,
  ) {
    mountedSlotMetadata = metadata
    setMountedSlotKeys(keys)
    schedulePendingProtocolV3PatchRetry()
  }

  private fun availableProtocolV3SlotRevisions(): Map<String, Long> =
    protocolV3State?.identity?.owner?.let { owner ->
      homeContainerProtocolV3AvailableSlotRevisions(owner, mountedSlotMetadata)
    }.orEmpty()

  private fun applyProtocolV3PatchOrDefer(json: String) {
    val outcome = HomeContainerProtocolV3Transaction.applyPatch(
      json,
      current = protocolV3State,
      availableSlotRevisions = availableProtocolV3SlotRevisions(),
    )
    if (
      outcome is HomeContainerProtocolV3ApplyOutcome.NeedSnapshot &&
      outcome.reason == HomeContainerProtocolV3NeedSnapshotReason.SLOT_REVISION_GAP
    ) {
      pendingProtocolV3PatchJson = json
      return
    }
    pendingProtocolV3PatchJson = null
    handleProtocolV3Outcome(outcome)
  }

  private fun schedulePendingProtocolV3PatchRetry() {
    if (pendingProtocolV3PatchJson == null || pendingProtocolV3PatchRetryScheduled) return
    pendingProtocolV3PatchRetryScheduled = true
    post {
      pendingProtocolV3PatchRetryScheduled = false
      pendingProtocolV3PatchJson?.let(::applyProtocolV3PatchOrDefer)
    }
  }

  fun slotFrame(key: String): Rect? {
    val statePrefix = "content.state."
    val contentHeaderPrefix = "content.header."
    val footerPrefix = "content.footer.$selectedTabId."
    val target = when {
      key.startsWith(statePrefix) && key.removePrefix(statePrefix) == selectedTabId ->
        adapter.pageForTab(selectedTabId)?.stateSlotTarget()
      key.startsWith(contentHeaderPrefix) && key.removePrefix(contentHeaderPrefix) == selectedTabId ->
        adapter.pageForTab(selectedTabId)?.contentHeaderSlotTarget()
      key.startsWith(footerPrefix) ->
        adapter.pageForTab(selectedTabId)?.footerSlotTarget(key)
      key.startsWith("header.") -> headerView.slotTarget(key)
      key.startsWith("tab.") -> tabsView.slotTarget(key)
      else -> null
    } ?: return null
    if (target.visibility != VISIBLE || target.width <= 0 || target.height <= 0) return null
    val targetLocation = IntArray(2)
    val rootLocation = IntArray(2)
    target.getLocationInWindow(targetLocation)
    getLocationInWindow(rootLocation)
    return Rect(
      targetLocation[0] - rootLocation[0],
      targetLocation[1] - rootLocation[1],
      targetLocation[0] - rootLocation[0] + target.width,
      targetLocation[1] - rootLocation[1] + target.height,
    )
  }

  fun setFallbackBackgroundColor(value: String) {
    val color = parseHomeContainerColor(value, Color.WHITE)
    post {
      fallbackBackgroundColor = color
      if (snapshot == null) {
        setBackgroundColor(color)
      }
    }
  }

  fun setDebugOverlayEnabled(enabled: Boolean) {
    post {
      background = if (enabled) {
        GradientDrawable().apply {
          color = android.content.res.ColorStateList.valueOf(
            snapshot?.theme?.backgroundColor?.let { parseHomeContainerColor(it, Color.WHITE) }
              ?: fallbackBackgroundColor,
          )
          setStroke(dp(1), Color.MAGENTA)
        }
      } else {
        null
      }
      if (!enabled) {
        setBackgroundColor(
          snapshot?.theme?.backgroundColor?.let { parseHomeContainerColor(it, Color.WHITE) }
            ?: fallbackBackgroundColor,
        )
      }
    }
  }

  fun setRefreshEnabled(enabled: Boolean) {
    post {
      refreshEnabled = enabled
      adapter.setRefreshEnabled(enabled)
    }
  }

  fun dispose() {
    if (disposed.compareAndSet(false, true)) {
      resetChromeGesture()
      externalHorizontalTarget = null
      parser.shutdownNow()
      val mountedPages = adapter.pages().toList()
      pager.adapter = null
      mountedPages.forEach(HomePageView::recycle)
      headerView.recycle()
      refreshPages.clear()
      snapshot = null
      protocolV2State = null
      renderedProtocolV2State = null
      protocolV3State = null
      renderedProtocolV3State = null
      pendingProtocolV3PatchJson = null
      pendingProtocolV3PatchRetryScheduled = false
      mountedSlotKeys = emptySet()
      mountedSlotMetadata = emptyList()
      renderCompletionCoordinator.reset()
      onAction = null
      onRefresh = null
      onVisibleTabChange = null
      onRenderError = null
      onIntent = null
      onTransportResult = null
      onSlotLayoutChange = null
    }
  }

  private fun applySnapshot(
    next: HomeContainerSnapshot,
    allowsMissingSelectedTabFallback: Boolean = true,
    enforcesMonotonicRevision: Boolean = true,
  ) {
    if (disposed.get()) return
    val current = snapshot
    if (enforcesMonotonicRevision && current != null && next.revision < current.revision) return
    if (!next.hasValidTabInvariants()) return
    if (
      !allowsMissingSelectedTabFallback &&
      next.tabs.none {
        it.id == next.selectedTabId && it.destination == HomeContainerTabDestination.INLINE
      }
    ) {
      return
    }
    snapshot = next
    setBackgroundColor(parseHomeContainerColor(next.theme.backgroundColor, Color.WHITE))
    val previousHeaderHeight = headerHeight
    headerView.bind(next.header, next.theme)
    headerHeight = headerView.preferredHeight
    val headerHeightChanged = previousHeaderHeight != headerHeight
    tabsView.bind(next.tabs, next.selectedTabId, next.theme)
    updateSharedChromeLayout()
    suppressPageCallback = true
    try {
      adapter.bind(next, forceMountedPageRebind = current != null)
      pager.offscreenPageLimit = next.inlineTabs().size.coerceAtLeast(1)
      val requestedTab = next.tabs.firstOrNull {
        it.id == next.selectedTabId && it.destination == HomeContainerTabDestination.INLINE
      } ?: if (allowsMissingSelectedTabFallback) next.inlineTabs().firstOrNull() else null
      if (requestedTab != null) {
        selectedTabId = requestedTab.id
        adapter.setSelectedTab(requestedTab.id)
        tabsView.setSelectedTab(requestedTab.id)
        val index = adapter.positionForTab(requestedTab.id)
        if (index >= 0) {
          adapter.requestPageRender(requestedTab.id)
          if (
            !homeContainerShouldPreservePendingPageTransition(
              pendingProgrammaticTabId,
              requestedTab.id,
            )
          ) {
            setPagerCurrentItem(index, false)
          }
        }
      }
    } finally {
      suppressPageCallback = false
    }
    if (headerHeightChanged) {
      adapter.updateTopSpacerHeight(headerHeight + dp(TAB_HEIGHT_DP), next.revision)
    }
    awaitSelectedPageRender(next.revision)
  }

  private fun applyPatch(patch: HomeContainerPatch) {
    val current = snapshot ?: return
    val next = current.applyingValidatedPatch(patch) ?: return
    snapshot = next
    patch.header?.let { header ->
      val previousHeaderHeight = headerHeight
      headerView.bind(header, next.theme)
      headerHeight = headerView.preferredHeight
      if (previousHeaderHeight != headerHeight) {
        adapter.updateTopSpacerHeight(headerHeight + dp(TAB_HEIGHT_DP), next.revision)
      }
      updateSharedChromeLayout()
    }
    adapter.applyPatch(next, patch)
  }

  private fun applyProtocolV2Patch(
    next: HomeContainerSnapshot,
    renderPlan: HomeContainerProtocolV2RenderPlan,
  ) {
    if (disposed.get() || !next.hasValidTabInvariants()) return
    snapshot = next
    var headerHeightChanged = false
    if (renderPlan.shouldApplySurface) {
      setBackgroundColor(parseHomeContainerColor(next.theme.backgroundColor, Color.WHITE))
    }
    if (renderPlan.shouldBindHeader || renderPlan.shouldApplySurface) {
      val previousHeaderHeight = headerHeight
      headerView.bind(next.header, next.theme)
      headerHeight = headerView.preferredHeight
      headerHeightChanged = previousHeaderHeight != headerHeight
    }
    if (renderPlan.shouldReconcileNavigation || renderPlan.shouldApplySurface) {
      tabsView.bind(next.tabs, next.selectedTabId, next.theme)
    }
    if (
      renderPlan.shouldBindHeader ||
      renderPlan.shouldReconcileNavigation ||
      renderPlan.shouldApplySurface
    ) {
      updateSharedChromeLayout()
    }

    when {
      renderPlan.shouldReconcileNavigation -> adapter.bind(next)
      renderPlan.shouldApplySurface -> adapter.applyTheme(next)
      renderPlan.sectionTabIds.isNotEmpty() ->
        adapter.updateSections(next, renderPlan.sectionTabIds)
      else -> {
        adapter.advanceSnapshot(next)
        emptySet()
      }
    }

    if (headerHeightChanged) {
      adapter.updateTopSpacerHeight(headerHeight + dp(TAB_HEIGHT_DP), next.revision)
    }

    if (renderPlan.shouldReconcileNavigation) {
      suppressPageCallback = true
      try {
        pager.offscreenPageLimit = next.inlineTabs().size.coerceAtLeast(1)
        val requestedTab = next.tabs.firstOrNull {
          it.id == next.selectedTabId && it.destination == HomeContainerTabDestination.INLINE
        } ?: return
        selectedTabId = requestedTab.id
        adapter.setSelectedTab(requestedTab.id)
        tabsView.setSelectedTab(requestedTab.id)
        val index = adapter.positionForTab(requestedTab.id)
        if (index >= 0) {
          adapter.requestPageRender(requestedTab.id)
          if (
            !homeContainerShouldPreservePendingPageTransition(
              pendingProgrammaticTabId,
              requestedTab.id,
            )
          ) {
            setPagerCurrentItem(index, false)
          }
        }
      } finally {
        suppressPageCallback = false
      }
    }

    awaitSelectedPageRender(next.revision)
  }

  private fun awaitSelectedPageRender(revision: Long) {
    val requiredTabId = selectedTabId
    renderCompletionCoordinator.retargetPending(requiredTabId)
    val page = adapter.pageForTab(requiredTabId)
    if (page != null && page.isAttachedToWindow) {
      renderCompletionCoordinator.registerPage(requiredTabId, page.renderInstanceId)
      page.awaitRenderCommit(revision)
      return
    }
    pager.post {
      if (disposed.get()) return@post
      val latestRequiredTabId = selectedTabId
      val latestRevision = protocolV2State?.revision ?: revision
      renderCompletionCoordinator.retargetPending(latestRequiredTabId)
      val attachedPage = adapter.pageForTab(latestRequiredTabId)
      if (attachedPage != null && attachedPage.isAttachedToWindow) {
        renderCompletionCoordinator.registerPage(
          latestRequiredTabId,
          attachedPage.renderInstanceId,
        )
        attachedPage.awaitRenderCommit(latestRevision)
      } else {
        adapter.requestPageRender(latestRequiredTabId)
      }
    }
  }

  private fun moveToTab(tabId: String, animated: Boolean, notify: Boolean) {
    val tabs = snapshot?.tabs ?: return
    val tab = tabs.firstOrNull { it.id == tabId } ?: return
    if (tab.destination == HomeContainerTabDestination.HANDOFF) {
      emitHandoff(tab)
      return
    }
    val index = adapter.positionForTab(tabId)
    if (index < 0) return
    val didChangeTab = selectedTabId != tabId
    val source = adapter.pageForTab(selectedTabId)
    val target = adapter.pageForTab(tabId)
    if (source != null && target != null) {
      target.synchronizeCollapseOffset(source.collapseOffset)
    }
    selectedTabId = tabId
    adapter.setSelectedTab(tabId)
    tabsView.setSelectedTab(tabId)
    collapseOffset = target?.collapseOffset ?: 0
    refreshPullOffset = target?.refreshPullOffset ?: 0
    updateSharedChromePosition()
    pendingProgrammaticTabId = tabId.takeIf { pager.currentItem != index }
    adapter.requestPageRender(tabId)
    setPagerCurrentItem(index, animated)
    if (notify && didChangeTab) emitTabSelection(tabId)
    protocolV2State?.revision?.let(::awaitSelectedPageRender)
  }

  private fun setPagerCurrentItem(index: Int, animated: Boolean) {
    if (animated) {
      pager.setCurrentItem(index, true)
      return
    }
    val requestedTabId = adapter.tabAt(index)?.id ?: return
    pendingProgrammaticTabId = requestedTabId
    val recycler = pager.getChildAt(0) as? RecyclerView
    recycler?.stopScroll()
    (recycler?.layoutManager as? LinearLayoutManager)
      ?.scrollToPositionWithOffset(index, 0)
    pager.setCurrentItem(index, false)
    reconcileDeferredPagerSelection(requestedTabId, remainingPasses = 2)
  }

  private fun reconcileDeferredPagerSelection(
    requestedTabId: String,
    remainingPasses: Int,
  ) {
    pager.postOnAnimation {
      if (disposed.get()) return@postOnAnimation
      val requestedIndex = adapter.positionForTab(requestedTabId)
      if (
        !homeContainerShouldReconcileDeferredPageSelection(
          requestedTabId = requestedTabId,
          selectedTabId = selectedTabId,
          requestedIndex = requestedIndex,
          tabIdAtRequestedIndex = adapter.tabAt(requestedIndex)?.id,
        )
      ) {
        return@postOnAnimation
      }
      val recycler = pager.getChildAt(0) as? RecyclerView
      recycler?.stopScroll()
      (recycler?.layoutManager as? LinearLayoutManager)
        ?.scrollToPositionWithOffset(requestedIndex, 0)
      pager.setCurrentItem(requestedIndex, false)
      if (remainingPasses > 0) {
        reconcileDeferredPagerSelection(
          requestedTabId,
          remainingPasses - 1,
        )
      } else if (pendingProgrammaticTabId == requestedTabId) {
        pendingProgrammaticTabId = null
      }
    }
  }

  private fun handleProtocolV3Outcome(outcome: HomeContainerProtocolV3ApplyOutcome) {
    if (disposed.get()) return
    when (outcome) {
      is HomeContainerProtocolV3ApplyOutcome.Applied -> {
        if (protocolV3State?.identity?.owner != outcome.state.identity.owner) {
          renderCompletionCoordinator.reset()
          renderedProtocolV2State = null
          renderedProtocolV3State = null
          resetViewportForOwnerChange()
        }
        protocolV3State = outcome.state
        protocolV2State = outcome.state.legacyState
        lastNeedSnapshotResultKey = null
        renderCompletionCoordinator.retargetPending(
          outcome.state.legacyState.snapshot.selectedTabId,
        )
        renderCompletionCoordinator.enqueue(
          state = outcome.state.legacyState,
          requiredTabId = outcome.state.legacyState.snapshot.selectedTabId,
          acknowledgement = HomeContainerProtocolV3Transaction.appliedResult(
            outcome.state,
          ),
        )
        if (outcome.renderPlan.isFullSnapshot) {
          applySnapshot(
            next = outcome.state.legacyState.snapshot,
            allowsMissingSelectedTabFallback = false,
            enforcesMonotonicRevision = false,
          )
        } else {
          applyProtocolV2Patch(
            outcome.state.legacyState.snapshot,
            outcome.renderPlan,
          )
        }
      }
      is HomeContainerProtocolV3ApplyOutcome.Duplicate -> {
        if (
          renderedProtocolV3State?.identity?.owner == outcome.state.identity.owner &&
          renderedProtocolV3State?.transportRevision == outcome.state.transportRevision
        ) {
          emitTransportResult(
            HomeContainerProtocolV3Transaction.duplicateResult(outcome.state),
          )
        }
      }
      is HomeContainerProtocolV3ApplyOutcome.NeedSnapshot -> {
        renderCompletionCoordinator.reset()
        renderedProtocolV2State = null
        renderedProtocolV3State = null
        val result = HomeContainerProtocolV3Transaction.needSnapshotResult(
          protocolV3State,
          outcome.reason,
        )
        if (lastNeedSnapshotResultKey != result) {
          lastNeedSnapshotResultKey = result
          emitTransportResult(result)
        }
      }
    }
  }

  private fun handleProtocolV2Outcome(outcome: HomeContainerProtocolV2ApplyOutcome) {
    if (disposed.get()) return
    when (outcome) {
      is HomeContainerProtocolV2ApplyOutcome.Applied -> {
        if (protocolV2State?.owner != outcome.state.owner) {
          renderCompletionCoordinator.reset()
          renderedProtocolV2State = null
          resetViewportForOwnerChange()
        }
        protocolV2State = outcome.state
        lastNeedSnapshotResultKey = null
        renderCompletionCoordinator.retargetPending(outcome.state.snapshot.selectedTabId)
        renderCompletionCoordinator.enqueue(
          state = outcome.state,
          requiredTabId = outcome.state.snapshot.selectedTabId,
          acknowledgement = outcome.toTransportResultJson(),
        )
        if (outcome.renderPlan.isFullSnapshot) {
          applySnapshot(
            next = outcome.state.snapshot,
            allowsMissingSelectedTabFallback = false,
            enforcesMonotonicRevision = false,
          )
        } else {
          applyProtocolV2Patch(outcome.state.snapshot, outcome.renderPlan)
        }
      }
      is HomeContainerProtocolV2ApplyOutcome.Duplicate -> {
        if (homeContainerDuplicateIsRendered(renderedProtocolV2State, outcome)) {
          emitTransportResult(outcome.toTransportResultJson())
        }
      }
      is HomeContainerProtocolV2ApplyOutcome.NeedSnapshot -> {
        renderCompletionCoordinator.reset()
        renderedProtocolV2State = null
        emitNeedSnapshot(outcome)
      }
    }
  }

  private fun completeProtocolV2Render(completed: HomeContainerCompletedRender) {
    val appliedState = protocolV2State ?: return
    if (
      appliedState.owner != completed.state.owner ||
      completed.state.revision > appliedState.revision
    ) {
      return
    }
    renderedProtocolV2State = if (appliedState.revision == completed.state.revision) {
      appliedState
    } else {
      completed.state
    }
    renderedProtocolV3State = protocolV3State?.takeIf {
      it.identity.owner == completed.state.owner &&
        it.transportRevision == completed.state.revision
    }
    emitTransportResult(completed.acknowledgement)
  }

  private fun emitAction(actionId: String, itemId: String, tabId: String) {
    if (protocolV3State != null) {
      val state = renderedProtocolV3State ?: return
      val sectionId = if (
        actionId.startsWith("home.widget.market") ||
        actionId.startsWith("home.market.")
      ) {
        "market"
      } else {
        tabId
      }
      HomeContainerProtocolV3Transaction.actionIntent(
        state = state,
        commandId = actionId,
        itemId = itemId,
        sectionId = sectionId,
      )?.let(::emitIntent)
      return
    }
    if (protocolV2State == null) {
      onAction?.invoke(actionId, itemId, tabId)
      return
    }
    val state = renderedProtocolV2State ?: return
    emitIntent(
      HomeContainerProtocolV2Intent.action(
        owner = state.owner,
        renderedRevision = state.revision,
        commandId = actionId,
        itemId = itemId,
      ),
    )
  }

  private fun emitRefresh(tabId: String, requestId: String) {
    if (protocolV3State != null) {
      val state = renderedProtocolV3State ?: return
      HomeContainerProtocolV3Transaction.refreshIntent(
        state,
        tabId,
        requestId,
      )?.let(::emitIntent)
      return
    }
    if (protocolV2State == null) {
      onRefresh?.invoke(tabId, requestId)
      return
    }
    val state = renderedProtocolV2State ?: return
    emitIntent(
      HomeContainerProtocolV2Intent.refresh(
        owner = state.owner,
        renderedRevision = state.revision,
        tabId = tabId,
        requestId = requestId,
      ),
    )
  }

  private fun emitTabSelection(tabId: String) {
    val currentState = protocolV2State
    if (currentState == null) {
      onVisibleTabChange?.invoke(tabId)
      return
    }
    if (
      currentState.snapshot.tabs.none {
        it.id == tabId && it.destination == HomeContainerTabDestination.INLINE
      }
    ) {
      return
    }
    val selectedState = currentState.selectingTab(tabId) ?: return
    snapshot = selectedState.snapshot
    protocolV2State = selectedState
    protocolV3State = protocolV3State?.let { state ->
      state.copy(legacyState = selectedState)
    }
    if (protocolV3State != null) {
      val renderedState = renderedProtocolV3State ?: return
      HomeContainerProtocolV3Transaction.selectTabIntent(
        renderedState,
        tabId,
      )?.let(::emitIntent)
      return
    }
    val renderedState = renderedProtocolV2State ?: return
    emitIntent(
      HomeContainerProtocolV2Intent.selectTab(
        owner = renderedState.owner,
        renderedRevision = renderedState.revision,
        tabId = tabId,
      ),
    )
  }

  private fun emitHandoff(tab: HomeContainerTab) {
    val commandId = tab.handoffCommandId ?: return
    if (protocolV3State != null) {
      val state = renderedProtocolV3State ?: return
      HomeContainerProtocolV3Transaction.handoffIntent(
        state,
        tab.id,
        commandId,
      )?.let(::emitIntent)
      return
    }
    if (protocolV2State == null) {
      onAction?.invoke(commandId, tab.id, selectedTabId)
      return
    }
    val state = renderedProtocolV2State ?: return
    emitIntent(
      HomeContainerProtocolV2Intent.handoff(
        owner = state.owner,
        renderedRevision = state.revision,
        tabId = tab.id,
        commandId = commandId,
      ),
    )
  }

  private fun emitIntent(json: String) {
    onIntent?.invoke(json)
  }

  private fun emitNeedSnapshot(result: HomeContainerProtocolV2ApplyOutcome.NeedSnapshot) {
    if (lastNeedSnapshotResultKey == result.coalescingKey) return
    lastNeedSnapshotResultKey = result.coalescingKey
    emitTransportResult(result.toTransportResultJson())
  }

  private fun emitTransportResult(json: String) {
    onTransportResult?.invoke(json)
  }

  private fun reportError(code: String, message: String) {
    post { onRenderError?.invoke(code, message) }
  }

  private inner class HomePagerAdapter : RecyclerView.Adapter<HomePageHolder>() {
    private var value: HomeContainerSnapshot? = null
    private var inlineTabs = emptyList<HomeContainerTab>()
    private val pages = mutableMapOf<String, HomePageView>()
    private var selectedId = ""
    private var refreshEnabled = false

    init {
      setHasStableIds(true)
    }

    fun bind(
      next: HomeContainerSnapshot,
      forceMountedPageRebind: Boolean = false,
    ): Set<String> {
      val isInitial = value == null
      val previousSnapshot = value
      val previousTabs = inlineTabs
      val nextTabs = next.inlineTabs()
      val changedTabIds = homeContainerChangedInlineTabIds(previousSnapshot, next)
      val diff = if (isInitial) {
        null
      } else {
        DiffUtil.calculateDiff(object : DiffUtil.Callback() {
          override fun getOldListSize(): Int = previousTabs.size

          override fun getNewListSize(): Int = nextTabs.size

          override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
            previousTabs[oldItemPosition].id == nextTabs[newItemPosition].id

          override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
            previousTabs[oldItemPosition] == nextTabs[newItemPosition] &&
              previousSnapshot?.theme == next.theme
        })
      }
      value = next
      inlineTabs = nextTabs
      val validIds = nextTabs.mapTo(mutableSetOf()) { it.id }
      pages.keys.retainAll(validIds)
      if (isInitial) {
        if (nextTabs.isNotEmpty()) notifyItemRangeInserted(0, nextTabs.size)
      } else {
        diff?.dispatchUpdatesTo(this)
      }
      if (forceMountedPageRebind) {
        nextTabs.forEach { tab ->
          pages[tab.id]?.let { page -> bindPage(page, tab, next) }
        }
      }
      return changedTabIds
    }

    fun applyPatch(next: HomeContainerSnapshot, patch: HomeContainerPatch) {
      updateSections(next, patch.tabs.mapTo(linkedSetOf()) { it.tabId })
    }

    fun updateSections(
      next: HomeContainerSnapshot,
      tabIds: Set<String>,
    ): Set<String> {
      val nextTabs = next.inlineTabs()
      if (inlineTabs.map { it.id } != nextTabs.map { it.id }) {
        return bind(next)
      }
      value = next
      inlineTabs = nextTabs
      val changedTabIds = tabIds.filterTo(linkedSetOf()) { tabId ->
        nextTabs.any { it.id == tabId }
      }
      changedTabIds.forEach { tabId ->
        val tab = nextTabs.firstOrNull { it.id == tabId } ?: return@forEach
        val page = pages[tabId]
        if (page != null) {
          page.updateSections(tab.sections, next.theme, next.revision)
        } else {
          val position = positionForTab(tabId)
          if (position >= 0) notifyItemChanged(position)
        }
      }
      return changedTabIds
    }

    fun applyTheme(next: HomeContainerSnapshot): Set<String> {
      val nextTabs = next.inlineTabs()
      if (inlineTabs.map { it.id } != nextTabs.map { it.id }) {
        return bind(next)
      }
      value = next
      inlineTabs = nextTabs
      if (nextTabs.isNotEmpty()) notifyItemRangeChanged(0, nextTabs.size)
      return nextTabs.mapTo(linkedSetOf()) { it.id }
    }

    fun advanceSnapshot(next: HomeContainerSnapshot) {
      value = next
      inlineTabs = next.inlineTabs()
    }

    fun setSelectedTab(tabId: String) {
      selectedId = tabId
    }

    fun updateTopSpacerHeight(height: Int, revision: Long) {
      pages.values.forEach { it.updateTopSpacerHeight(height, revision) }
    }

    fun setRefreshEnabled(enabled: Boolean) {
      refreshEnabled = enabled
      pages.values.forEach { it.setRefreshEnabled(enabled) }
    }

    fun pageForTab(tabId: String): HomePageView? = pages[tabId]

    fun requestPageRender(tabId: String) {
      val position = positionForTab(tabId)
      if (position >= 0) notifyItemChanged(position)
    }

    fun positionForTab(tabId: String): Int = inlineTabs.indexOfFirst { it.id == tabId }

    fun tabAt(position: Int): HomeContainerTab? = inlineTabs.getOrNull(position)

    fun pages(): Collection<HomePageView> = pages.values

    override fun getItemId(position: Int): Long =
      inlineTabs.getOrNull(position)?.id?.hashCode()?.toLong() ?: RecyclerView.NO_ID

    override fun getItemCount(): Int = inlineTabs.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HomePageHolder =
      HomePageHolder(
        HomePageView(parent.context).apply {
          layoutParams = RecyclerView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
          )
        },
      )

    override fun onBindViewHolder(holder: HomePageHolder, position: Int) {
      val next = value ?: return
      val tab = inlineTabs[position]
      pages.entries.removeAll { entry ->
        if (entry.value === holder.page && entry.key != tab.id) {
          renderCompletionCoordinator.unregisterPage(
            entry.key,
            holder.page.renderInstanceId,
          )
          true
        } else {
          false
        }
      }
      pages[tab.id] = holder.page
      bindPage(holder.page, tab, next)
    }

    override fun onViewAttachedToWindow(holder: HomePageHolder) {
      super.onViewAttachedToWindow(holder)
      val tabId = holder.page.tabId
      if (tabId.isEmpty()) return
      renderCompletionCoordinator.registerPage(tabId, holder.page.renderInstanceId)
      if (tabId == selectedTabId) {
        value?.revision?.let(holder.page::awaitRenderCommit)
      }
    }

    override fun onViewRecycled(holder: HomePageHolder) {
      val recycledTabId = holder.page.tabId
      pages.entries.removeAll { it.value === holder.page }
      renderCompletionCoordinator.unregisterPage(
        recycledTabId,
        holder.page.renderInstanceId,
      )
      super.onViewRecycled(holder)
      if (recycledTabId == selectedTabId) {
        pager.post {
          protocolV2State?.revision?.let(::awaitSelectedPageRender)
        }
      }
    }

    private fun bindPage(
      page: HomePageView,
      tab: HomeContainerTab,
      next: HomeContainerSnapshot,
    ) {
      page.onSlotLayoutChange = { this@HomeContainerView.onSlotLayoutChange?.invoke() }
      page.onAction = { actionId, itemId, tabId ->
        this@HomeContainerView.emitAction(actionId, itemId, tabId)
      }
      page.onRefresh = { sourcePage, tabId ->
        val requestId = UUID.randomUUID().toString()
        refreshPages[requestId] = sourcePage
        this@HomeContainerView.emitRefresh(tabId, requestId)
      }
      page.onCollapseOffsetChange = { sourcePage, offset ->
        if (sourcePage.tabId == selectedTabId) {
          collapseOffset = offset
          updateSharedChromePosition()
          pages.values.filter { it !== sourcePage }.forEach {
            it.synchronizeCollapseOffset(offset)
          }
        }
      }
      page.onRefreshPullOffsetChange = { sourcePage, offset ->
        if (sourcePage.tabId == selectedTabId) {
          refreshPullOffset = offset
          updateSharedChromePosition()
        }
      }
      page.onListContentCommitted = { sourcePage, revision ->
        renderCompletionCoordinator.markListCommitted(
          sourcePage.tabId,
          sourcePage.renderInstanceId,
          revision,
        )
      }
      page.onRenderPreDraw = { sourcePage, revision ->
        renderCompletionCoordinator.markPreDraw(
          sourcePage.tabId,
          sourcePage.renderInstanceId,
          revision,
        ).forEach(::completeProtocolV2Render)
      }
      renderCompletionCoordinator.registerPage(tab.id, page.renderInstanceId)
      page.bind(tab, next.theme, headerHeight + dp(TAB_HEIGHT_DP), next.revision)
      page.setRefreshEnabled(refreshEnabled)
      page.setMountedSlotKeys(mountedSlotKeys)
    }
  }

  private class HomePageHolder(val page: HomePageView) : RecyclerView.ViewHolder(page)

  private fun updateSharedChromeLayout() {
    (headerView.layoutParams as LayoutParams).apply {
      height = headerHeight
      headerView.layoutParams = this
    }
    (tabsView.layoutParams as LayoutParams).apply {
      height = dp(TAB_HEIGHT_DP)
      topMargin = headerHeight
      tabsView.layoutParams = this
    }
    headerView.requestLayout()
    tabsView.requestLayout()
    pager.requestLayout()
    requestLayout()
    layoutSharedChromeImmediately()
    postOnAnimation {
      // Protocol patches can arrive while the current traversal is laying out
      // the old header. Re-request on the next frame so a banner-driven height
      // change cannot be dropped by that in-flight traversal.
      headerView.requestLayout()
      tabsView.requestLayout()
      pager.requestLayout()
      requestLayout()
      layoutSharedChromeImmediately()
    }
    updateSharedChromePosition()
  }

  private fun layoutSharedChromeImmediately() {
    val contentWidth = width.coerceAtLeast(0)
    if (contentWidth <= 0 || headerHeight <= 0) return
    headerView.measure(
      MeasureSpec.makeMeasureSpec(contentWidth, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(headerHeight, MeasureSpec.EXACTLY),
    )
    headerView.layout(0, 0, contentWidth, headerHeight)
    val tabsHeight = dp(TAB_HEIGHT_DP)
    tabsView.measure(
      MeasureSpec.makeMeasureSpec(contentWidth, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(tabsHeight, MeasureSpec.EXACTLY),
    )
    tabsView.layout(0, headerHeight, contentWidth, headerHeight + tabsHeight)
  }

  private fun updateSharedChromePosition() {
    val boundedOffset = collapseOffset.coerceIn(0, headerHeight)
    headerView.translationY = (-boundedOffset + refreshPullOffset).toFloat()
    tabsView.translationY = (-boundedOffset + refreshPullOffset).toFloat()
    onSlotLayoutChange?.invoke()
  }

  private fun resetViewportForOwnerChange() {
    pendingProgrammaticTabId = null
    collapseOffset = 0
    refreshPullOffset = 0
    val mountedPages = adapter.pages().toList()
    pager.adapter = null
    mountedPages.forEach(HomePageView::recycle)
    adapter = HomePagerAdapter()
    pager.adapter = adapter
    updateSharedChromePosition()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    layoutSharedChromeImmediately()
    onSlotLayoutChange?.invoke()
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  companion object {
    private const val SCHEMA_VERSION = HOME_CONTAINER_BUSINESS_SCHEMA_VERSION
    private const val TAB_HEIGHT_DP = 52
  }
}

private class HomePageView(context: Context) : FrameLayout(context) {
  var onAction: ((String, String, String) -> Unit)? = null
  var onRefresh: ((HomePageView, String) -> Unit)? = null
  var onCollapseOffsetChange: ((HomePageView, Int) -> Unit)? = null
  var onRefreshPullOffsetChange: ((HomePageView, Int) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null
  var onListContentCommitted: ((HomePageView, Long) -> Unit)? = null
  var onRenderPreDraw: ((HomePageView, Long) -> Unit)? = null

  val renderInstanceId: String = UUID.randomUUID().toString()

  var tabId: String = ""
    private set

  private var refreshLayout = SwipeRefreshLayout(context)
  private var recycler = RecyclerView(context)
  private val listAdapter = HomeListAdapter()
  private var topSpacerHeight = 0
  private var suppressCollapseCallback = false
  private var userScrollActive = false
  private var refreshEnabled = true
  private var lastRefreshPullOffset = 0
  private var latestRequestedRenderRevision = -1L
  private var scheduledPreDrawRevision = -1L
  private var preDrawListener: android.view.ViewTreeObserver.OnPreDrawListener? = null

  val collapseOffset: Int
    get() {
      val headerHeight = (topSpacerHeight - dp(TAB_HEIGHT_DP)).coerceAtLeast(0)
      return min(currentScrollOffset(), headerHeight)
    }

  val refreshPullOffset: Int
    get() = recycler.top.coerceAtLeast(0)

  init {
    configureRecycler(recycler)
    configureRefreshLayout(refreshLayout, recycler)
    addView(refreshLayout, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    listAdapter.onAction = { actionId, itemId ->
      onAction?.invoke(actionId, itemId, tabId)
    }
    listAdapter.onListCommitted = { committedRevision, requiresRecyclerRecreation ->
      if (requiresRecyclerRecreation) {
        post {
          recreateRecyclerForReadyContent()
          commitListContent(committedRevision)
        }
      } else {
        commitListContent(committedRevision)
      }
    }
  }

  fun bind(
    tab: HomeContainerTab,
    theme: HomeContainerTheme,
    topSpacerHeight: Int,
    revision: Long,
  ) {
    tabId = tab.id
    latestRequestedRenderRevision = maxOf(latestRequestedRenderRevision, revision)
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    this.topSpacerHeight = topSpacerHeight
    listAdapter.bind(tab.id, tab.sections, theme, topSpacerHeight, revision)
  }

  fun updateSections(
    sections: List<HomeContainerSection>,
    theme: HomeContainerTheme,
    revision: Long,
  ) {
    latestRequestedRenderRevision = maxOf(latestRequestedRenderRevision, revision)
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    listAdapter.updateSections(sections, theme, revision)
    recycler.requestLayout()
    (recycler.layoutManager as? LinearLayoutManager)?.requestLayout()
    recycler.postOnAnimation {
      recycler.requestLayout()
      (recycler.layoutManager as? LinearLayoutManager)?.requestLayout()
    }
  }

  fun updateTopSpacerHeight(height: Int, revision: Long) {
    latestRequestedRenderRevision = maxOf(latestRequestedRenderRevision, revision)
    topSpacerHeight = height
    listAdapter.updateTopSpacerHeight(height, revision)
  }

  fun awaitRenderCommit(revision: Long) {
    latestRequestedRenderRevision = maxOf(latestRequestedRenderRevision, revision)
    if (listAdapter.hasPendingCommit) return
    onListContentCommitted?.invoke(this, latestRequestedRenderRevision)
    scheduleRenderPreDraw(latestRequestedRenderRevision)
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    listAdapter.setMountedSlotKeys(keys)
  }

  fun synchronizeCollapseOffset(offset: Int) {
    val headerHeight = (topSpacerHeight - dp(TAB_HEIGHT_DP)).coerceAtLeast(0)
    val verticalOffset = currentScrollOffset()
    if (verticalOffset > headerHeight) return
    val target = offset.coerceIn(0, headerHeight)
    val delta = target - verticalOffset
    if (abs(delta) <= 1) return
    suppressCollapseCallback = true
    recycler.scrollBy(0, delta)
    suppressCollapseCallback = false
  }

  fun endRefreshing() {
    refreshLayout.isRefreshing = false
  }

  fun setRefreshEnabled(enabled: Boolean) {
    refreshEnabled = enabled
    refreshLayout.isEnabled = enabled
  }

  fun recycle() {
    preDrawListener?.let { listener ->
      if (viewTreeObserver.isAlive) {
        viewTreeObserver.removeOnPreDrawListener(listener)
      }
    }
    preDrawListener = null
    refreshLayout.setOnRefreshListener(null)
    recycler.adapter = null
    onAction = null
    onRefresh = null
    onCollapseOffsetChange = null
    onRefreshPullOffsetChange = null
    onSlotLayoutChange = null
    onListContentCommitted = null
    onRenderPreDraw = null
  }

  fun dispatchExternalTouchEvent(event: MotionEvent, sourceLocation: IntArray): Boolean {
    val targetLocation = IntArray(2)
    refreshLayout.getLocationInWindow(targetLocation)
    event.offsetLocation(
      (sourceLocation[0] - targetLocation[0]).toFloat(),
      (sourceLocation[1] - targetLocation[1]).toFloat(),
    )
    return refreshLayout.dispatchTouchEvent(event)
  }

  fun stateSlotTarget(): View? {
    val position = listAdapter.statePosition()
    if (position == RecyclerView.NO_POSITION) return null
    return recycler.findViewHolderForAdapterPosition(position)?.itemView
  }

  fun contentHeaderSlotTarget(): View? {
    val position = listAdapter.contentHeaderPosition()
    if (position == RecyclerView.NO_POSITION) return null
    return recycler.findViewHolderForAdapterPosition(position)?.itemView
  }

  fun footerSlotTarget(key: String): View? {
    val position = listAdapter.footerSlotPosition(key)
    if (position == RecyclerView.NO_POSITION) return null
    return recycler.findViewHolderForAdapterPosition(position)?.itemView
  }

  private fun currentScrollOffset(): Int {
    val layoutManager = recycler.layoutManager as? LinearLayoutManager ?: return 0
    val firstPosition = layoutManager.findFirstVisibleItemPosition()
    if (firstPosition == RecyclerView.NO_POSITION) return 0
    if (firstPosition > 0) return topSpacerHeight
    val firstView = layoutManager.findViewByPosition(0) ?: return 0
    return (-layoutManager.getDecoratedTop(firstView)).coerceAtLeast(0)
  }

  private fun scheduleRenderPreDraw(revision: Long) {
    scheduledPreDrawRevision = maxOf(scheduledPreDrawRevision, revision)
    if (preDrawListener != null) return
    val listener = object : android.view.ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        val observer = viewTreeObserver
        if (observer.isAlive) observer.removeOnPreDrawListener(this)
        preDrawListener = null
        val renderedRevision = scheduledPreDrawRevision
        scheduledPreDrawRevision = -1L
        onSlotLayoutChange?.invoke()
        onRenderPreDraw?.invoke(this@HomePageView, renderedRevision)
        return true
      }
    }
    preDrawListener = listener
    viewTreeObserver.addOnPreDrawListener(listener)
    invalidate()
  }

  private fun configureRecycler(target: RecyclerView) {
    target.layoutManager = LinearLayoutManager(context)
    target.adapter = listAdapter
    target.itemAnimator = DefaultItemAnimator().apply {
      supportsChangeAnimations = false
      addDuration = 180
      removeDuration = 180
      moveDuration = 180
      changeDuration = 0
    }
    target.overScrollMode = View.OVER_SCROLL_ALWAYS
    target.setPadding(0, 0, 0, dp(112))
    target.clipToPadding = false
    target.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      onSlotLayoutChange?.invoke()
    }
    target.addOnChildAttachStateChangeListener(
      object : RecyclerView.OnChildAttachStateChangeListener {
        override fun onChildViewAttachedToWindow(view: View) {
          target.post { onSlotLayoutChange?.invoke() }
        }

        override fun onChildViewDetachedFromWindow(view: View) {
          target.post { onSlotLayoutChange?.invoke() }
        }
      },
    )
    target.addOnScrollListener(object : RecyclerView.OnScrollListener() {
      override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
        userScrollActive = newState != RecyclerView.SCROLL_STATE_IDLE
      }

      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        if (userScrollActive && !suppressCollapseCallback) {
          onCollapseOffsetChange?.invoke(this@HomePageView, collapseOffset)
        }
      }
    })
  }

  private fun commitListContent(committedRevision: Long) {
    latestRequestedRenderRevision = maxOf(
      latestRequestedRenderRevision,
      committedRevision,
    )
    onListContentCommitted?.invoke(this, latestRequestedRenderRevision)
    scheduleRenderPreDraw(latestRequestedRenderRevision)
    scheduleSlotLayoutAfterListMutation()
  }

  private fun scheduleSlotLayoutAfterListMutation() {
    onSlotLayoutChange?.invoke()
    recycler.postOnAnimation {
      onSlotLayoutChange?.invoke()
      val animator = recycler.itemAnimator
      if (animator == null) {
        recycler.post { onSlotLayoutChange?.invoke() }
      } else {
        animator.isRunning {
          recycler.post { onSlotLayoutChange?.invoke() }
        }
      }
    }
  }

  private fun configureRefreshLayout(
    target: SwipeRefreshLayout,
    targetRecycler: RecyclerView,
  ) {
    target.addView(
      targetRecycler,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    target.isEnabled = refreshEnabled
    target.setOnRefreshListener {
      onRefresh?.invoke(this, tabId)
    }
    target.viewTreeObserver.addOnPreDrawListener {
      val nextOffset = refreshPullOffset
      if (nextOffset != lastRefreshPullOffset) {
        lastRefreshPullOffset = nextOffset
        onRefreshPullOffsetChange?.invoke(this, nextOffset)
        onSlotLayoutChange?.invoke()
      }
      true
    }
  }

  private fun recreateRecyclerForReadyContent() {
    val previousRefreshLayout = refreshLayout
    val previousRecycler = recycler
    previousRefreshLayout.setOnRefreshListener(null)
    previousRecycler.stopScroll()
    previousRecycler.clearOnScrollListeners()
    previousRecycler.adapter = null
    removeView(previousRefreshLayout)

    recycler = RecyclerView(context)
    refreshLayout = SwipeRefreshLayout(context)
    configureRecycler(recycler)
    configureRefreshLayout(refreshLayout, recycler)
    addView(
      refreshLayout,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    recycler.scrollToPosition(0)
    recycler.requestLayout()
    refreshLayout.requestLayout()
    requestLayout()
    if (width > 0 && height > 0) {
      val widthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
      val heightSpec = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      refreshLayout.measure(widthSpec, heightSpec)
      refreshLayout.layout(0, 0, width, height)
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  companion object {
    private const val TAB_HEIGHT_DP = 52
  }
}

private data class HomeListRow(
  val kind: Int,
  val stableId: String,
  val contentKey: String,
  val title: String = "",
  val actionTitle: String = "",
  val actionId: String = "",
  val actionDisabled: Boolean = false,
  val sectionLayout: String = "",
  val item: HomeContainerItem? = null,
  val horizontalItems: List<HomeContainerItem> = emptyList(),
  val slotKey: String = "",
)

internal fun homeContainerItemContentKey(item: HomeContainerItem): String = listOf(
  item.id,
  item.renderer,
  item.title,
  item.subtitle,
  item.subtitleDetail,
  item.subtitleDetailColor,
  item.value,
  item.detail,
  item.imageUrl,
  item.imageUrls.joinToString(","),
  item.secondaryImageUrl,
  item.titleAccessoryImageUrl,
  item.titleAccessoryIcon,
  item.badge,
  item.badges.joinToString(","),
  item.badgeImageUrl,
  item.communityRecognized,
  item.accentColor,
  item.buttonTitle,
  item.leadingIcon,
  item.showChevron,
  item.actionId,
  item.favorite,
  item.favoriteActionId,
  item.favoriteLabel,
  item.displayHeight,
  item.segments.joinToString(",") { segment ->
    listOf(
      segment.id,
      segment.title,
      segment.imageUrl,
      segment.leadingIcon,
      segment.iconOnly,
      segment.selected,
      segment.actionId,
    ).joinToString(":")
  },
).joinToString("|")

internal fun resolveHomeContainerRowHeight(
  baseHeight: Int,
  fontScale: Float,
  measuredContentHeight: Int,
): Int = maxOf(
  (baseHeight * fontScale.coerceAtLeast(1f).coerceAtMost(1.4f)).roundToInt(),
  measuredContentHeight,
)

private class HomeListAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
  var onAction: ((String, String) -> Unit)? = null
  var onListCommitted: ((Long, Boolean) -> Unit)? = null
  private var theme = HomeContainerTheme("#FFFFFF", "#F5F5F5", "#EEEEEE", "#111111", "#777777", "#3574F0", "#1F9D67", "#D64545")
  private var sections: List<HomeContainerSection> = emptyList()
  private var rows: List<HomeListRow> = emptyList()
  private var tabId = ""
  private var topSpacerHeight = 0
  private var mountedSlotKeys = emptySet<String>()
  private var revision = -1L
  private var submissionGeneration = 0L
  private var committedGeneration = 0L

  val hasPendingCommit: Boolean
    get() = submissionGeneration != committedGeneration

  fun bind(
    tabId: String,
    sections: List<HomeContainerSection>,
    theme: HomeContainerTheme,
    topSpacerHeight: Int,
    revision: Long,
  ) {
    val themeChanged = this.theme != theme
    this.tabId = tabId
    this.theme = theme
    this.sections = homeContainerSectionsForRendering(sections)
    this.topSpacerHeight = topSpacerHeight
    this.revision = revision
    submitRows(themeChanged = themeChanged)
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    if (mountedSlotKeys == keys) return
    mountedSlotKeys = keys
    submitRows()
  }

  fun updateTopSpacerHeight(height: Int, revision: Long) {
    if (topSpacerHeight == height) return
    topSpacerHeight = height
    this.revision = revision
    submitRows()
  }

  fun updateSections(
    sections: List<HomeContainerSection>,
    theme: HomeContainerTheme,
    revision: Long,
  ) {
    val themeChanged = this.theme != theme
    this.theme = theme
    this.sections = homeContainerSectionsForRendering(sections)
    this.revision = revision
    submitRows(themeChanged = themeChanged)
  }

  private fun submitRows(themeChanged: Boolean = false) {
    val generation = ++submissionGeneration
    val submittedRevision = revision
    val currentRows = rows
    val currentHasLoadingRows = currentRows.any { it.item?.renderer == "loading" }
    val nextRows = buildRows()
    val transitionsFromLoading =
      currentHasLoadingRows && nextRows.none { it.item?.renderer == "loading" }
    val hydratesDeferredPortfolioSections =
      tabId == "portfolio" &&
        currentRows.none { it.item?.renderer == "marketTabs" } &&
        nextRows.any { it.item?.renderer == "marketTabs" }
    val requiresRecyclerRecreation =
      transitionsFromLoading || hydratesDeferredPortfolioSections

    if (requiresRecyclerRecreation) {
      rows = nextRows
      // Skeleton views continuously invalidate while shimmering. A full,
      // synchronous rebind is required for loading-to-content and for the
      // one-time deferred portfolio-section hydration. Normal user-driven
      // content updates below still use DiffUtil animations.
      notifyDataSetChanged()
    } else {
      val diff = DiffUtil.calculateDiff(RowDiffCallback(currentRows, nextRows))
      rows = nextRows
      diff.dispatchUpdatesTo(this)
    }

    committedGeneration = generation
    if (themeChanged && itemCount > 0 && !requiresRecyclerRecreation) {
      notifyItemRangeChanged(0, itemCount, PAYLOAD_THEME)
    }
    onListCommitted?.invoke(submittedRevision, requiresRecyclerRecreation)
  }

  fun statePosition(): Int {
    val position = rows.indexOfFirst { row ->
      row.item?.renderer == "empty" || row.item?.renderer == "loading"
    }
    return if (position >= 0) position else RecyclerView.NO_POSITION
  }

  fun contentHeaderPosition(): Int {
    val position = rows.indexOfFirst { it.kind == VIEW_CONTENT_HEADER }
    return if (position >= 0) position else RecyclerView.NO_POSITION
  }

  fun footerSlotPosition(key: String): Int {
    val position = rows.indexOfFirst { row ->
      row.kind == VIEW_FOOTER_SLOT && row.slotKey == key
    }
    return if (position >= 0) position else RecyclerView.NO_POSITION
  }

  private fun buildRows(): List<HomeListRow> =
    buildList {
      add(HomeListRow(VIEW_SPACER, "spacer", "spacer:$topSpacerHeight"))
      if (
        mountedSlotKeys.contains("content.header.$tabId") &&
        contentHeaderHeight(tabId) > 0
      ) {
        add(
          HomeListRow(
            VIEW_CONTENT_HEADER,
            "content-header:$tabId",
            "content-header:$tabId",
          ),
        )
      }
      sections.forEach { section ->
        if (section.title.isNotEmpty()) {
          add(
            HomeListRow(
              VIEW_SECTION,
              "section:${section.id}",
              "section:${section.title}:${section.actionTitle}:${section.actionId}:" +
                "${section.actionDisabled}:${section.layout}",
              title = section.title,
              actionTitle = section.actionTitle,
              actionId = section.actionId,
              actionDisabled = section.actionDisabled,
              sectionLayout = section.layout,
            ),
          )
        }
        if (section.layout == "marketRecommendations") {
          var itemIndex = 0
          while (itemIndex < section.items.size) {
            val item = section.items[itemIndex]
            if (item.renderer == "market") {
              val recommendationItems = buildList {
                add(item)
                section.items.getOrNull(itemIndex + 1)
                  ?.takeIf { it.renderer == "market" }
                  ?.let(::add)
              }
              add(
                HomeListRow(
                  VIEW_MARKET_RECOMMENDATIONS,
                  "market-recommendations:${section.id}:$itemIndex",
                  recommendationItems.joinToString("||", transform = ::homeContainerItemContentKey),
                  horizontalItems = recommendationItems,
                ),
              )
              itemIndex += recommendationItems.size
            } else {
              add(itemRow(section.id, item))
              itemIndex += 1
            }
          }
        } else if (section.layout == "grid") {
          section.items.chunked(2).forEachIndexed { rowIndex, items ->
            add(
              HomeListRow(
                VIEW_GRID,
                "grid:${section.id}:$rowIndex",
                items.joinToString("||", transform = ::homeContainerItemContentKey),
                horizontalItems = items,
              ),
            )
          }
        } else if (section.layout == "horizontal") {
          add(
            HomeListRow(
              VIEW_HORIZONTAL,
              "horizontal:${section.id}",
              section.items.joinToString("||", transform = ::homeContainerItemContentKey),
              horizontalItems = section.items,
            ),
          )
        } else {
          section.items.forEach { item -> add(itemRow(section.id, item)) }
        }
      }
      FOOTER_SLOT_IDS.forEach { footerId ->
        val key = "content.footer.$tabId.$footerId"
        if (mountedSlotKeys.contains(key)) {
          add(
            HomeListRow(
              VIEW_FOOTER_SLOT,
              "footer-slot:$key",
              "footer-slot:$key",
              slotKey = key,
            ),
          )
        }
      }
    }

  private fun itemRow(sectionId: String, item: HomeContainerItem): HomeListRow =
    HomeListRow(
      kind = when (item.renderer) {
        "market" -> VIEW_MARKET_ITEM
        "marketTabs" -> VIEW_MARKET_TABS
        else -> VIEW_ITEM
      },
      stableId = "item:$sectionId:${item.id}",
      contentKey = homeContainerItemContentKey(item),
      item = item,
    )

  override fun getItemCount(): Int = rows.size

  override fun getItemViewType(position: Int): Int = rows[position].kind

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder =
    when (viewType) {
      VIEW_SECTION -> SectionHolder(HomeSectionTitleView(parent.context))
      VIEW_ITEM -> ItemHolder(HomeItemView(parent.context))
      VIEW_GRID -> GridHolder(HomeNftGridRowView(parent.context))
      VIEW_HORIZONTAL -> HorizontalHolder(HomeHorizontalView(parent.context))
      VIEW_MARKET_ITEM -> MarketItemHolder(HomeMarketItemView(parent.context))
      VIEW_MARKET_TABS -> MarketTabsHolder(HomeMarketSegmentsView(parent.context))
      VIEW_MARKET_RECOMMENDATIONS ->
        MarketRecommendationsHolder(HomeMarketRecommendationRowView(parent.context))
      else -> SpacerHolder(View(parent.context))
    }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    val row = rows[position]
    when (holder) {
      is SpacerHolder -> {
        val height = when (row.kind) {
          VIEW_CONTENT_HEADER -> holder.itemView.dp(contentHeaderHeight(tabId))
          VIEW_FOOTER_SLOT -> holder.itemView.dp(footerSlotHeight(row.slotKey))
          else -> topSpacerHeight
        }
        holder.itemView.layoutParams = RecyclerView.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          height,
        )
        holder.itemView.setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
      }
      is SectionHolder -> {
        val isHistory = row.stableId.startsWith("section:history:")
        holder.view.bind(row, theme, isHistory) { actionId ->
          onAction?.invoke(actionId, row.stableId.removePrefix("section:"))
        }
      }
      is ItemHolder -> {
        val item = row.item ?: return
        holder.view.bind(item, theme)
        holder.view.setOnClickListener {
          if (item.actionId.isNotEmpty()) onAction?.invoke(item.actionId, item.id)
        }
        val loadMoreActionId = sections.firstOrNull { section ->
          section.actionId.endsWith(".loadMore") && section.items.lastOrNull()?.id == item.id
        }?.actionId
        if (!loadMoreActionId.isNullOrEmpty()) {
          holder.itemView.post {
            if (holder.bindingAdapterPosition != RecyclerView.NO_POSITION) {
              onAction?.invoke(loadMoreActionId, item.id)
            }
          }
        }
      }
      is GridHolder -> {
        holder.view.bind(row.horizontalItems, theme, onAction)
      }
      is HorizontalHolder -> {
        holder.view.bind(row.horizontalItems, theme, onAction)
      }
      is MarketItemHolder -> {
        val item = row.item ?: return
        holder.view.bind(item, theme, onAction)
      }
      is MarketTabsHolder -> {
        val item = row.item ?: return
        holder.view.bind(item.segments, theme, onAction)
      }
      is MarketRecommendationsHolder -> {
        holder.view.bind(row.horizontalItems, theme, onAction)
      }
    }
  }

  override fun onBindViewHolder(
    holder: RecyclerView.ViewHolder,
    position: Int,
    payloads: MutableList<Any>,
  ) {
    onBindViewHolder(holder, position)
  }

  override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
    if (holder is ItemHolder) holder.view.recycle()
    if (holder is GridHolder) holder.view.recycle()
    if (holder is HorizontalHolder) holder.view.recycle()
    if (holder is MarketItemHolder) holder.view.recycle()
    if (holder is MarketTabsHolder) holder.view.recycle()
    if (holder is MarketRecommendationsHolder) holder.view.recycle()
    super.onViewRecycled(holder)
  }

  private fun View.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun contentHeaderHeight(value: String): Int = when (value) {
    "portfolio", "defi" -> 56
    "perps" -> 88
    else -> 0
  }

  private fun footerSlotHeight(key: String): Int = when {
    key.endsWith(".upgrade") -> 152
    key.endsWith(".support") -> 371
    key.endsWith(".historyEnd") -> 136
    else -> 0
  }

  private class SpacerHolder(view: View) : RecyclerView.ViewHolder(view)
  private class SectionHolder(val view: HomeSectionTitleView) : RecyclerView.ViewHolder(view)
  private class ItemHolder(val view: HomeItemView) : RecyclerView.ViewHolder(view)
  private class GridHolder(val view: HomeNftGridRowView) : RecyclerView.ViewHolder(view)
  private class HorizontalHolder(val view: HomeHorizontalView) : RecyclerView.ViewHolder(view)
  private class MarketItemHolder(val view: HomeMarketItemView) : RecyclerView.ViewHolder(view)
  private class MarketTabsHolder(val view: HomeMarketSegmentsView) : RecyclerView.ViewHolder(view)
  private class MarketRecommendationsHolder(
    val view: HomeMarketRecommendationRowView,
  ) : RecyclerView.ViewHolder(view)

  companion object {
    private const val VIEW_SPACER = 0
    private const val VIEW_CONTENT_HEADER = 1
    private const val VIEW_SECTION = 2
    private const val VIEW_ITEM = 3
    private const val VIEW_HORIZONTAL = 4
    private const val VIEW_GRID = 5
    private const val VIEW_FOOTER_SLOT = 6
    private const val VIEW_MARKET_ITEM = 7
    private const val VIEW_MARKET_TABS = 8
    private const val VIEW_MARKET_RECOMMENDATIONS = 9
    private const val PAYLOAD_THEME = "theme"
    private val FOOTER_SLOT_IDS = listOf("upgrade", "support", "historyEnd")
  }

  private class RowDiffCallback(
    private val oldRows: List<HomeListRow>,
    private val newRows: List<HomeListRow>,
  ) : DiffUtil.Callback() {
    override fun getOldListSize(): Int = oldRows.size

    override fun getNewListSize(): Int = newRows.size

    override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
      oldRows[oldItemPosition].stableId == newRows[newItemPosition].stableId

    override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
      oldRows[oldItemPosition].contentKey == newRows[newItemPosition].contentKey
  }
}

private class HomeHeaderView(context: Context) : LinearLayout(context) {
  var onAction: ((String, String) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null
  var preferredHeight: Int = dp(216)
    private set
  private val accountIcon = headerImage(24)
  private val accountButton = text("", 17f, Typeface.BOLD, "#111111")
  private val accountGroup = LinearLayout(context)
  private val copyButton = text("⧉", 20f, Typeface.NORMAL, "#777777")
  private val networkIcon = headerImage(20)
  private val networkIconSecondary = headerImage(20)
  private val networkButton = text("", 15f, Typeface.BOLD, "#111111")
  private val networkGroup = LinearLayout(context)
  private val accountRow = LinearLayout(context)
  private val balanceContainer = FrameLayout(context)
  private val balanceButton = text("", 48f, Typeface.NORMAL, "#111111")
  private var balanceSkeletonView: SkeletonNativeView? = null
  private val balanceActionsContent = LinearLayout(context)
  private val actionsScroll = AxisLockHorizontalScrollView(context)
  private val actionsContent = LinearLayout(context)
  private val bannersScroll = AxisLockHorizontalScrollView(context)
  private val bannersContent = LinearLayout(context)
  private val actionViews = mutableMapOf<String, HomeActionView>()
  private val balanceActionViews = mutableMapOf<String, TextView>()
  private val bannerViews = mutableMapOf<String, HomeBannerView>()
  private var mountedSlotKeys = emptySet<String>()
  private var header: HomeContainerHeader? = null
  private var bannersContentWidth = 0
  private var accountImageRequest: HomeContainerImageLoader.Request? = null
  private var networkImageRequest: HomeContainerImageLoader.Request? = null
  private var networkSecondaryImageRequest: HomeContainerImageLoader.Request? = null
  private var representedAccountImageUrl: String? = null
  private var representedNetworkImageUrl: String? = null
  private var representedNetworkSecondaryImageUrl: String? = null
  private var balanceIsLoading = false
  private var currentTheme: HomeContainerTheme? = null
  init {
    orientation = VERTICAL
    setPadding(dp(16))
    accountButton.maxLines = 1
    networkButton.maxLines = 1
    accountGroup.apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(accountIcon, LinearLayout.LayoutParams(dp(24), dp(24)).apply {
        marginEnd = dp(8)
      })
      addView(accountButton, LinearLayout.LayoutParams(0, dp(32), 1f))
    }
    networkGroup.apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(networkIcon, LinearLayout.LayoutParams(dp(20), dp(20)).apply {
        marginStart = dp(4)
        marginEnd = dp(6)
      })
      addView(networkIconSecondary, LinearLayout.LayoutParams(dp(20), dp(20)).apply {
        marginStart = -dp(12)
        marginEnd = dp(6)
      })
      addView(networkButton, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(32)))
    }
    accountRow.apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(accountGroup, LinearLayout.LayoutParams(0, dp(32), 1f))
      addView(copyButton, LinearLayout.LayoutParams(dp(36), dp(32)))
      addView(networkGroup, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(32)))
    }
    addView(accountRow, row(32))
    balanceContainer.addView(
      balanceButton,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    addView(balanceContainer, row(64))
    balanceActionsContent.orientation = HORIZONTAL
    balanceActionsContent.gravity = Gravity.CENTER_VERTICAL
    addView(balanceActionsContent, row(32))
    actionsContent.orientation = HORIZONTAL
    actionsContent.setPadding(0, 0, dp(10), 0)
    actionsScroll.addView(
      actionsContent,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(72)),
    )
    actionsScroll.setOnScrollChangeListener { _, _, _, _, _ ->
      onSlotLayoutChange?.invoke()
    }
    addView(actionsScroll, row(82))
    bannersContent.orientation = HORIZONTAL
    bannersScroll.addView(
      bannersContent,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(84)),
    )
    addView(bannersScroll, row(94))
    accountGroup.alpha = 0f
    copyButton.alpha = 0f
    networkGroup.alpha = 0f
    balanceButton.alpha = 0f
  }

  fun bind(
    header: HomeContainerHeader,
    theme: HomeContainerTheme,
  ) {
    this.header = header
    currentTheme = theme
    setBackgroundColor(Color.TRANSPARENT)
    val primary = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
    val secondary = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
    accountButton.text = "${header.accountName} ⌄"
    accountButton.setTextColor(primary)
    copyButton.setTextColor(secondary)
    copyButton.visibility = if (header.copyActionId.isEmpty()) GONE else VISIBLE
    val networkTitle = header.networkName.ifEmpty { header.accountSubtitle }
    val isNetworkGroup = header.networkCount > 1 && header.networkImageUrls.isNotEmpty()
    networkButton.text = if (isNetworkGroup) {
      if (header.networkCount > 2) "+${header.networkCount - 2} ⌄" else "⌄"
    } else if (networkTitle.isEmpty()) {
      ""
    } else {
      "$networkTitle ⌄"
    }
    networkButton.setTextColor(primary)
    networkButton.visibility = if (!isNetworkGroup && networkTitle.isEmpty()) GONE else VISIBLE
    networkIcon.visibility = if (isNetworkGroup || networkTitle.isNotEmpty()) VISIBLE else GONE
    networkIconSecondary.visibility =
      if (isNetworkGroup && header.networkImageUrls.size > 1) VISIBLE else GONE
    val balanceText = header.balance + header.balanceSecondary
    balanceIsLoading =
      header.actionLayout == "loading" && balanceText.isEmpty()
    balanceButton.text = SpannableString(balanceText).apply {
      setSpan(
        ForegroundColorSpan(primary),
        0,
        header.balance.length,
        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
      )
      if (header.balanceSecondary.isNotEmpty()) {
        setSpan(
          ForegroundColorSpan(secondary),
          header.balance.length,
          balanceText.length,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
      }
    }
    loadHeaderImage(header.accountImageUrl, accountIcon, isAccount = true)
    loadHeaderImage(header.networkImageUrls.firstOrNull().orEmpty(), networkIcon, isAccount = false)
    loadSecondaryNetworkImage(
      if (isNetworkGroup) header.networkImageUrls.getOrNull(1).orEmpty() else "",
    )
    updateBalanceActions(header.balanceActions, theme)
    updateActions(header.actions, theme)
    updateBanners(header.banners, theme)
    updateNativeOwnershipVisibility()
    actionsScroll.layoutParams = actionsScroll.layoutParams.apply {
      height = dp(header.actionRowHeight.coerceAtLeast(0))
    }
    updateActionRowVisibility(header)
    bannersScroll.visibility = if (header.banners.isEmpty()) GONE else VISIBLE
    preferredHeight = dp(
      (if (header.banners.isEmpty()) 216 else 310) +
        (if (header.balanceActions.isEmpty()) 0 else 38) +
        preferredHeightAdjustment(header),
    )
  }

  private fun preferredHeightAdjustment(header: HomeContainerHeader): Int {
    val actionHeightDelta = (header.actionRowHeight - 62).coerceAtLeast(0)
    if (header.actionLayout != "zeroBalance" && header.actionLayout != "loading") {
      return actionHeightDelta
    }
    return (actionHeightDelta - 14).coerceAtLeast(0)
  }

  fun slotTarget(key: String): View? = when (key) {
    "header.account-row" -> accountRow
    "header.balance" -> balanceButton
    "header.action-row" -> actionsScroll
    else -> null
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    if (mountedSlotKeys == keys) return
    mountedSlotKeys = keys
    updateNativeOwnershipVisibility()
    updateActionRowVisibility()
    requestLayout()
    onSlotLayoutChange?.invoke()
  }

  private fun updateActionRowVisibility(header: HomeContainerHeader? = null) {
    val currentHeader = header ?: this.header ?: return
    val hasMountedSlot = mountedSlotKeys.contains("header.action-row")
    actionsScroll.visibility =
      if (!hasMountedSlot && currentHeader.actions.isEmpty() && currentHeader.actionLayout != "loading") {
        GONE
      } else {
        VISIBLE
      }
  }

  fun horizontalScrollTargetAt(windowX: Float, windowY: Float): View? =
    listOf(bannersScroll).firstOrNull { scrollView ->
      scrollView.visibility == VISIBLE &&
        (scrollView.canScrollHorizontally(-1) || scrollView.canScrollHorizontally(1)) &&
        scrollView.containsWindowPoint(windowX, windowY)
    }

  private fun View.containsWindowPoint(windowX: Float, windowY: Float): Boolean {
    val location = IntArray(2)
    getLocationInWindow(location)
    return windowX >= location[0] && windowX <= location[0] + width &&
      windowY >= location[1] && windowY <= location[1] + height
  }

  private fun updateBalanceActions(
    actions: List<HomeContainerAction>,
    theme: HomeContainerTheme,
  ) {
    if (actions.map { it.id } != balanceActionViews.keys.toList()) {
      balanceActionsContent.removeAllViews()
      balanceActionViews.clear()
      actions.forEach { action ->
        val view = text("", 13f, Typeface.BOLD, theme.secondaryTextColor).apply {
          maxLines = 1
          setPadding(0, 0, dp(12), 0)
          setOnClickListener { onAction?.invoke(action.actionId, action.id) }
        }
        balanceActionViews[action.id] = view
        balanceActionsContent.addView(
          view,
          LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(28)),
        )
      }
    }
    actions.forEach { action ->
      balanceActionViews[action.id]?.apply {
        text = "${action.title} ⓘ"
        setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
        setOnClickListener { onAction?.invoke(action.actionId, action.id) }
      }
    }
    balanceActionsContent.visibility = if (actions.isEmpty()) GONE else VISIBLE
  }

  private fun updateActions(actions: List<HomeContainerAction>, theme: HomeContainerTheme) {
    if (actions.map { it.id } != actionViews.keys.toList()) {
      actionsContent.removeAllViews()
      actionViews.clear()
      actions.forEach { action ->
        val view = HomeActionView(context).apply {
          alpha = 0f
          isClickable = false
        }
        actionViews[action.id] = view
        actionsContent.addView(view, LinearLayout.LayoutParams(dp(82), dp(72)).apply {
          marginEnd = dp(10)
        })
      }
    }
    actions.forEach { actionViews[it.id]?.bind(it, theme) }
    updateNativeOwnershipVisibility()
  }

  private fun updateNativeOwnershipVisibility() {
    val ownsAccountRow = !mountedSlotKeys.contains("header.account-row")
    accountGroup.alpha = if (ownsAccountRow) 1f else 0f
    accountGroup.isClickable = ownsAccountRow
    copyButton.alpha = if (ownsAccountRow) 1f else 0f
    copyButton.isClickable = ownsAccountRow
    networkGroup.alpha = if (ownsAccountRow) 1f else 0f
    networkGroup.isClickable = ownsAccountRow

    val ownsBalance = !mountedSlotKeys.contains("header.balance")
    balanceButton.alpha = if (ownsBalance) 1f else 0f
    balanceButton.isClickable = ownsBalance
    updateBalanceSkeleton(ownsBalance && balanceIsLoading)

    val ownsActionRow = !mountedSlotKeys.contains("header.action-row")
    actionViews.values.forEach { view ->
      view.alpha = if (ownsActionRow) 1f else 0f
      view.isClickable = ownsActionRow
    }
  }

  private fun updateBalanceSkeleton(shouldShow: Boolean) {
    val theme = currentTheme
    if (!shouldShow || theme == null) {
      balanceSkeletonView?.let(balanceContainer::removeView)
      balanceSkeletonView = null
      return
    }
    val skeleton = balanceSkeletonView ?: SkeletonNativeView(context).also {
      it.clipToOutline = true
      it.background = GradientDrawable().apply {
        cornerRadius = dp(8).toFloat()
      }
      balanceContainer.addView(
        it,
        FrameLayout.LayoutParams(dp(209), dp(40), Gravity.START or Gravity.CENTER_VERTICAL),
      )
      balanceSkeletonView = it
    }
    skeleton.applyHomeContainerSkeletonTheme(theme)
  }

  private fun updateBanners(banners: List<HomeContainerBanner>, theme: HomeContainerTheme) {
    if (banners.map { it.id } != bannerViews.keys.toList()) {
      bannersContent.removeAllViews()
      bannerViews.clear()
      banners.forEach { banner ->
        val bannerWidth = if (banner.id == "home-tron-resource") 220 else 280
        val view = HomeBannerView(context).apply {
          this.onAction = { actionId -> this@HomeHeaderView.onAction?.invoke(actionId, banner.id) }
        }
        bannerViews[banner.id] = view
        bannersContent.addView(view, LinearLayout.LayoutParams(dp(bannerWidth), dp(88)).apply {
          marginEnd = dp(10)
        })
      }
    }
    banners.forEach { banner ->
      bannerViews[banner.id]?.bind(banner, theme)
    }
    bannersContentWidth = banners.sumOf {
      dp(if (it.id == "home-tron-resource") 220 else 280) + dp(10)
    }
    bannersContent.layoutParams = bannersContent.layoutParams.apply {
      width = bannersContentWidth
      height = dp(88)
    }
    bannersContent.requestLayout()
    bannersContent.post {
      if (bannersContentWidth <= 0) return@post
      bannersContent.measure(
        MeasureSpec.makeMeasureSpec(bannersContentWidth, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(dp(88), MeasureSpec.EXACTLY),
      )
      bannersContent.layout(0, 0, bannersContentWidth, dp(88))
    }
  }

  private fun loadHeaderImage(value: String, target: ImageView, isAccount: Boolean) {
    val representedValue = if (isAccount) {
      representedAccountImageUrl
    } else {
      representedNetworkImageUrl
    }
    if (representedValue == value) return
    val previousRequest = if (isAccount) accountImageRequest else networkImageRequest
    previousRequest?.cancel()
    target.setImageDrawable(null)
    if (isAccount) {
      representedAccountImageUrl = value
    } else {
      representedNetworkImageUrl = value
    }
    if (value.isEmpty()) return
    val request = HomeContainerImageLoader.load(context, value) { bitmap ->
      val currentValue = if (isAccount) representedAccountImageUrl else representedNetworkImageUrl
      if (currentValue != value) return@load
      target.setImageBitmap(bitmap)
    }
    if (isAccount) {
      accountImageRequest = request
    } else {
      networkImageRequest = request
    }
  }

  private fun loadSecondaryNetworkImage(value: String) {
    if (representedNetworkSecondaryImageUrl == value) return
    representedNetworkSecondaryImageUrl = value
    networkSecondaryImageRequest?.cancel()
    networkSecondaryImageRequest = null
    networkIconSecondary.setImageDrawable(null)
    if (value.isEmpty()) return
    networkSecondaryImageRequest = HomeContainerImageLoader.load(context, value) { bitmap ->
      if (representedNetworkSecondaryImageUrl != value) return@load
      networkIconSecondary.setImageBitmap(bitmap)
    }
  }

  fun recycle() {
    accountImageRequest?.cancel()
    networkImageRequest?.cancel()
    networkSecondaryImageRequest?.cancel()
    accountImageRequest = null
    networkImageRequest = null
    networkSecondaryImageRequest = null
    representedAccountImageUrl = null
    representedNetworkImageUrl = null
    representedNetworkSecondaryImageUrl = null
    accountIcon.setImageDrawable(null)
    networkIcon.setImageDrawable(null)
    networkIconSecondary.setImageDrawable(null)
    bannerViews.values.forEach(HomeBannerView::recycle)
    bannerViews.clear()
    bannersContent.removeAllViews()
    actionViews.clear()
    actionsContent.removeAllViews()
    balanceActionViews.clear()
    balanceActionsContent.removeAllViews()
    onAction = null
    onSlotLayoutChange = null
  }

  private fun headerImage(size: Int): ImageView = ImageView(context).apply {
    scaleType = ImageView.ScaleType.CENTER_CROP
    background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.LTGRAY)
    }
    clipToOutline = true
    minimumWidth = dp(size)
    minimumHeight = dp(size)
  }

  private fun text(value: String, size: Float, style: Int, color: String): TextView =
    TextView(context).apply {
      text = value
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      setTextColor(parseHomeContainerColor(color, Color.BLACK))
      setTypeface(typeface, style)
      maxLines = 2
    }

  private fun row(height: Int): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(height))

  private fun rounded(color: String, radius: Int): GradientDrawable =
    GradientDrawable().apply {
      setColor(parseHomeContainerColor(color, Color.LTGRAY))
      cornerRadius = dp(radius).toFloat()
    }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeBannerView(context: Context) : FrameLayout(context) {
  var onAction: ((String) -> Unit)? = null
  private val image = ImageView(context)
  private val title = TextView(context)
  private val subtitle = TextView(context)
  private val labels = LinearLayout(context)
  private val resourceStack = LinearLayout(context)
  private val dismiss = TextView(context)
  private var banner: HomeContainerBanner? = null
  private var imageRequest: HomeContainerImageLoader.Request? = null
  private var representedImageUrl: String? = null

  init {
    image.scaleType = ImageView.ScaleType.CENTER_CROP
    image.background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.LTGRAY)
    }
    image.clipToOutline = true
    addView(image, LayoutParams(dp(50), dp(50), Gravity.CENTER_VERTICAL).apply {
      marginStart = dp(12)
    })
    labels.apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      title.setTypeface(title.typeface, Typeface.BOLD)
      title.maxLines = 2
      subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
      subtitle.maxLines = 2
      addView(title)
      addView(subtitle)
    }
    addView(labels, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply {
      marginStart = dp(72)
      marginEnd = dp(14)
    })
    resourceStack.orientation = LinearLayout.VERTICAL
    resourceStack.gravity = Gravity.CENTER_VERTICAL
    resourceStack.visibility = GONE
    addView(resourceStack, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply {
      marginStart = dp(16)
      marginEnd = dp(16)
    })
    dismiss.text = "×"
    dismiss.gravity = Gravity.CENTER
    dismiss.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    dismiss.contentDescription = "native-home-banner-dismiss"
    dismiss.setOnClickListener {
      banner?.dismissActionId?.takeIf { it.isNotEmpty() }?.let { onAction?.invoke(it) }
    }
    addView(dismiss, LayoutParams(dp(28), dp(28), Gravity.TOP or Gravity.END))
    setOnClickListener {
      banner?.actionId?.takeIf { it.isNotEmpty() }?.let { onAction?.invoke(it) }
    }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    val dismissHitRect = Rect()
    dismiss.getHitRect(dismissHitRect)
    dismissHitRect.inset(-dp(12), -dp(12))
    touchDelegate = TouchDelegate(dismissHitRect, dismiss)
  }

  fun bind(value: HomeContainerBanner, theme: HomeContainerTheme) {
    banner = value
    val isTronResourceBanner = value.id == "home-tron-resource"
    labels.visibility = if (isTronResourceBanner) GONE else VISIBLE
    resourceStack.visibility = if (isTronResourceBanner) VISIBLE else GONE
    title.text = value.title
    title.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
    subtitle.text = value.subtitle
    subtitle.visibility = if (value.subtitle.isEmpty()) GONE else VISIBLE
    subtitle.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    dismiss.visibility = if (value.dismissActionId.isEmpty()) GONE else VISIBLE
    dismiss.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    background = GradientDrawable().apply {
      setColor(parseHomeContainerColor(theme.cardColor, Color.LTGRAY))
      cornerRadius = dp(16).toFloat()
    }
    (image.layoutParams as LayoutParams).apply {
      width = if (isTronResourceBanner) 0 else dp(50)
      height = if (isTronResourceBanner) 0 else dp(50)
      marginStart = if (isTronResourceBanner) 0 else dp(12)
    }
    (labels.layoutParams as? LayoutParams)?.let { params ->
      params.marginStart = if (isTronResourceBanner) dp(16) else dp(72)
      params.marginEnd = dp(14)
      labels.layoutParams = params
    }
    if (isTronResourceBanner) {
      bindResourceRows(value.resourceRows, theme)
      loadImage("")
    } else {
      resourceStack.removeAllViews()
      loadImage(value.imageUrl)
    }
  }

  private fun bindResourceRows(rows: List<HomeContainerBannerResourceRow>, theme: HomeContainerTheme) {
    resourceStack.removeAllViews()
    val textColor = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
    val secondaryColor = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
    rows.take(2).forEachIndexed { index, row ->
      val line = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
      }
      val ring = HomeResourceRingView(context).apply {
        progress = (row.progress.coerceIn(0.0, 100.0) / 100.0).toFloat()
      }
      line.addView(ring, LinearLayout.LayoutParams(dp(20), dp(20)).apply {
        marginEnd = dp(10)
      })
      val label = TextView(context).apply {
        text = row.label
        setTextColor(textColor)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        setTypeface(typeface, Typeface.BOLD)
        maxLines = 1
      }
      line.addView(label, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
      val value = TextView(context).apply {
        text = row.value
        setTextColor(secondaryColor)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        maxLines = 1
      }
      line.addView(value)
      resourceStack.addView(line, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        if (index > 0) topMargin = dp(12)
      })
    }
  }

  private fun loadImage(value: String) {
    if (representedImageUrl == value) return
    representedImageUrl = value
    imageRequest?.cancel()
    imageRequest = null
    image.setImageDrawable(null)
    image.visibility = GONE
    if (value.isEmpty()) return
    image.visibility = VISIBLE
    imageRequest = HomeContainerImageLoader.load(context, value) { bitmap ->
      if (representedImageUrl != value) return@load
      image.setImageBitmap(bitmap)
      image.visibility = if (bitmap == null) GONE else VISIBLE
    }
  }

  fun recycle() {
    imageRequest?.cancel()
    imageRequest = null
    representedImageUrl = null
    image.setImageDrawable(null)
    banner = null
    onAction = null
    setOnClickListener(null)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeResourceRingView(context: Context) : View(context) {
  var progress: Float = 0f
    set(value) {
      field = value
      invalidate()
    }
  private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f * resources.displayMetrics.density
    color = Color.argb(64, 120, 120, 120)
  }
  private val foregroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f * resources.displayMetrics.density
    strokeCap = Paint.Cap.ROUND
    color = Color.rgb(129, 140, 248)
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val inset = backgroundPaint.strokeWidth / 2
    val rect = RectF(inset, inset, width - inset, height - inset)
    canvas.drawOval(rect, backgroundPaint)
    canvas.drawArc(rect, -90f, 360f * progress, false, foregroundPaint)
  }
}

private class HomeActionView(context: Context) : LinearLayout(context) {
  private val icon = TextView(context)
  private val title = TextView(context)

  init {
    orientation = VERTICAL
    gravity = Gravity.CENTER
    icon.gravity = Gravity.CENTER
    icon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 25f)
    title.gravity = Gravity.CENTER
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    addView(icon, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
    addView(title, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(28)))
  }

  fun bind(action: HomeContainerAction, theme: HomeContainerTheme) {
    val foreground = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
    icon.text = when (action.icon) {
      "send" -> "↑"
      "receive" -> "↓"
      "buy" -> "$"
      "copy" -> "⧉"
      "filter" -> "≡"
      "manage" -> "☷"
      else -> "•••"
    }
    icon.setTextColor(foreground)
    title.text = action.title
    title.setTextColor(foreground)
    background = GradientDrawable().apply {
      setColor(parseHomeContainerColor(theme.cardColor, Color.LTGRAY))
      cornerRadius = dp(16).toFloat()
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeTabsView(context: Context) : FrameLayout(context) {
  var onSelect: ((String) -> Unit)? = null
  var onAction: ((String, String) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null
  private val scroll = AxisLockHorizontalScrollView(context)
  private val content = LinearLayout(context)
  private val toolbar = TextView(context)
  private val buttons = mutableMapOf<String, TextView>()
  private var renderedTabs = emptyList<HomeContainerTab>()
  private var tabsById = emptyMap<String, HomeContainerTab>()
  private var selectedTabId = ""
  private var contentWidth = 0
  private var theme: HomeContainerTheme? = null
  private var mountedSlotKeys = emptySet<String>()

  init {
    content.orientation = LinearLayout.HORIZONTAL
    content.gravity = Gravity.CENTER_VERTICAL
    content.setPadding(dp(16), 0, dp(16), 0)
    scroll.isHorizontalScrollBarEnabled = false
    scroll.setOnScrollChangeListener { _, _, _, _, _ ->
      onSlotLayoutChange?.invoke()
    }
    scroll.addView(
      content,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    addView(scroll, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT).apply {
      marginEnd = dp(52)
    })
    toolbar.text = "≡"
    toolbar.gravity = Gravity.CENTER
    toolbar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
    toolbar.setOnClickListener {
      tabsById[selectedTabId]?.toolbarAction?.let { action ->
        onAction?.invoke(action.actionId, action.id)
      }
    }
    addView(toolbar, LayoutParams(dp(44), LayoutParams.MATCH_PARENT, Gravity.END))
  }

  fun bind(tabs: List<HomeContainerTab>, selectedTabId: String, theme: HomeContainerTheme) {
    val requiresRebuild = homeContainerTabsRequireRebuild(renderedTabs, tabs)
    this.theme = theme
    this.selectedTabId = selectedTabId
    tabsById = tabs.associateBy { it.id }
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    if (requiresRebuild) {
      renderedTabs = tabs.toList()
      content.removeAllViews()
      buttons.clear()
      tabs.forEach { tab ->
        val button = TextView(context).apply {
          text = tab.title
          gravity = Gravity.CENTER
          setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
          setTypeface(typeface, Typeface.BOLD)
          setPadding(0, 0, 0, 0)
          maxLines = 1
          alpha = 1f
          isClickable = true
          contentDescription = "HomeContainer.Tab.${tab.id}"
          setOnClickListener { onSelect?.invoke(tab.id) }
        }
        buttons[tab.id] = button
        content.addView(
          button,
          LinearLayout.LayoutParams(
            LayoutParams.WRAP_CONTENT,
            LayoutParams.MATCH_PARENT,
          ).apply {
            marginEnd = dp(24)
          },
        )
      }
      contentWidth = dp(32) + tabs.sumOf { tab ->
        val button = buttons.getValue(tab.id)
        button.paint.measureText(tab.title).toInt() + dp(24)
      }
      requestLayout()
      content.post {
        val contentHeight = height.takeIf { it > 0 } ?: dp(52)
        content.measure(
          MeasureSpec.makeMeasureSpec(contentWidth, MeasureSpec.EXACTLY),
          MeasureSpec.makeMeasureSpec(contentHeight, MeasureSpec.EXACTLY),
        )
        content.layout(0, 0, contentWidth, contentHeight)
      }
    }
    updateColors()
    updateToolbar()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    if (contentWidth <= 0 || measuredHeight <= 0) return
    content.measure(
      MeasureSpec.makeMeasureSpec(contentWidth, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(measuredHeight, MeasureSpec.EXACTLY),
    )
  }

  fun setSelectedTab(tabId: String) {
    selectedTabId = tabId
    updateColors()
    updateToolbar()
    onSlotLayoutChange?.invoke()
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    if (mountedSlotKeys == keys) return
    mountedSlotKeys = keys
    updateToolbar()
    onSlotLayoutChange?.invoke()
  }

  fun slotTarget(key: String): View? {
    val labelPrefix = "tab.label."
    if (key.startsWith(labelPrefix)) {
      return buttons[key.removePrefix(labelPrefix)]
    }
    val accessoryPrefix = "tab.accessory."
    return if (
      key.startsWith(accessoryPrefix) &&
      key.removePrefix(accessoryPrefix) == selectedTabId &&
      toolbar.visibility == VISIBLE
    ) {
      toolbar
    } else {
      null
    }
  }

  fun horizontalScrollTargetAt(windowX: Float, windowY: Float): View? =
    scroll.takeIf { scrollView ->
      (scrollView.canScrollHorizontally(-1) || scrollView.canScrollHorizontally(1)) &&
        scrollView.containsWindowPoint(windowX, windowY)
    }

  private fun View.containsWindowPoint(windowX: Float, windowY: Float): Boolean {
    val location = IntArray(2)
    getLocationInWindow(location)
    return windowX >= location[0] && windowX <= location[0] + width &&
      windowY >= location[1] && windowY <= location[1] + height
  }

  private fun updateColors() {
    val value = theme ?: return
    buttons.forEach { (tabId, button) ->
      button.setTextColor(
        parseHomeContainerColor(
          if (tabId == selectedTabId) value.primaryTextColor else value.secondaryTextColor,
          Color.BLACK,
        ),
      )
    }
  }

  private fun updateToolbar() {
    val value = theme ?: return
    val accessoryKey = "tab.accessory.$selectedTabId"
    toolbar.visibility = if (
      tabsById[selectedTabId]?.toolbarAction != null || mountedSlotKeys.contains(accessoryKey)
    ) VISIBLE else GONE
    toolbar.setTextColor(parseHomeContainerColor(value.secondaryTextColor, Color.DKGRAY))
    toolbar.alpha = 0f
    toolbar.isClickable = false
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeHorizontalView(context: Context) : AxisLockHorizontalScrollView(context) {
  private val content = LinearLayout(context)
  private var itemIds = emptyList<String>()

  init {
    content.orientation = LinearLayout.HORIZONTAL
    content.setPadding(dp(16), dp(6), dp(16), dp(6))
    addView(
      content,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(132)),
    )
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, dp(132))
  }

  fun bind(
    items: List<HomeContainerItem>,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    val isSupportPromo = items.firstOrNull()?.renderer == "supportPromo"
    val rowHeight = if (isSupportPromo) 163 else 132
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, dp(rowHeight))
    content.layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(rowHeight))
    val nextIds = items.map { it.id }
    if (itemIds != nextIds) {
      itemIds = nextIds
      recycleCards()
      content.removeAllViews()
      items.forEach { item ->
        val card = HomeHorizontalCardView(context)
        content.addView(
          card,
          LinearLayout.LayoutParams(
            if (isSupportPromo) resources.displayMetrics.widthPixels - dp(32) else dp(250),
            dp(if (isSupportPromo) 151 else 120),
          ).apply {
          marginEnd = dp(10)
          },
        )
      }
    }
    items.forEachIndexed { index, item ->
      (content.getChildAt(index) as? HomeHorizontalCardView)?.apply {
        layoutParams = (layoutParams as LinearLayout.LayoutParams).apply {
          width = if (isSupportPromo) {
            resources.displayMetrics.widthPixels - dp(32)
          } else {
            dp(250)
          }
          height = dp(if (isSupportPromo) 151 else 120)
        }
        setOnClickListener {
          item.actionId.takeIf { it.isNotEmpty() }?.let { actionId ->
            onAction?.invoke(actionId, item.id)
          }
        }
        bind(item, theme)
      }
    }
  }

  fun recycle() {
    recycleCards()
    content.removeAllViews()
    itemIds = emptyList()
  }

  private fun recycleCards() {
    repeat(content.childCount) { index ->
      (content.getChildAt(index) as? HomeHorizontalCardView)?.recycle()
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeHorizontalCardView(context: Context) : LinearLayout(context) {
  private val image = ImageView(context)
  private val title = TextView(context)
  private val subtitle = TextView(context)
  private var imageRequest: HomeContainerImageLoader.Request? = null
  private var representedImageUrl: String? = null

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    setPadding(dp(16))
    image.scaleType = ImageView.ScaleType.CENTER_CROP
    image.background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.LTGRAY)
    }
    image.clipToOutline = true
    addView(image, LinearLayout.LayoutParams(dp(40), dp(40)).apply {
      marginEnd = dp(12)
    })
    val labels = LinearLayout(context).apply {
      orientation = VERTICAL
      gravity = Gravity.CENTER_VERTICAL
    }
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
    title.setTypeface(title.typeface, Typeface.BOLD)
    title.maxLines = 2
    subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    subtitle.maxLines = 2
    labels.addView(title)
    labels.addView(subtitle)
    addView(labels, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
  }

  fun bind(item: HomeContainerItem, theme: HomeContainerTheme) {
    alpha = if (item.renderer == "empty" || item.renderer == "loading") 0f else 1f
    val isSupportPromo = item.renderer == "supportPromo"
    title.text = if (
      item.badge.isEmpty() || (item.renderer != "market" && item.renderer != "perps")
    ) item.title else "${item.title}  ${item.badge}"
    title.setTextColor(
      if (isSupportPromo) Color.BLACK
      else parseHomeContainerColor(theme.primaryTextColor, Color.BLACK),
    )
    subtitle.text = item.subtitle.ifEmpty { item.value }
    subtitle.setTextColor(
      if (isSupportPromo) Color.DKGRAY
      else parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY),
    )
    subtitle.visibility = if (subtitle.text.isEmpty()) GONE else VISIBLE
    loadImage(item.imageUrl)
    image.layoutParams = LinearLayout.LayoutParams(
      if (isSupportPromo) dp(96) else dp(40),
      if (isSupportPromo) LayoutParams.MATCH_PARENT else dp(40),
    ).apply {
      marginEnd = dp(12)
    }
    background = GradientDrawable().apply {
      setColor(parseHomeContainerColor(theme.cardColor, Color.LTGRAY))
      cornerRadius = dp(16).toFloat()
    }
  }

  private fun loadImage(value: String) {
    if (representedImageUrl == value) return
    representedImageUrl = value
    imageRequest?.cancel()
    imageRequest = null
    image.setImageDrawable(null)
    image.visibility = GONE
    if (value.isEmpty()) return
    image.visibility = VISIBLE
    imageRequest = HomeContainerImageLoader.load(context, value) { bitmap ->
      if (representedImageUrl != value) return@load
      image.setImageBitmap(bitmap)
      image.visibility = if (bitmap == null) GONE else VISIBLE
    }
  }

  fun recycle() {
    imageRequest?.cancel()
    imageRequest = null
    representedImageUrl = null
    image.setImageDrawable(null)
    image.visibility = GONE
    setOnClickListener(null)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeNftGridRowView(context: Context) : LinearLayout(context) {
  private val cards = listOf(HomeNftCardView(context), HomeNftCardView(context))

  init {
    orientation = HORIZONTAL
    cards.forEach { card ->
      addView(card, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    }
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
  }

  fun bind(
    items: List<HomeContainerItem>,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    cards.forEachIndexed { index, card ->
      val item = items.getOrNull(index)
      if (item == null) {
        card.visibility = INVISIBLE
        card.recycle()
      } else {
        card.visibility = VISIBLE
        card.bind(item, theme)
        card.setOnClickListener {
          item.actionId.takeIf { it.isNotEmpty() }?.let { actionId ->
            onAction?.invoke(actionId, item.id)
          }
        }
      }
    }
  }

  fun recycle() {
    cards.forEach { it.recycle() }
  }
}

private class HomeNftCardView(context: Context) : LinearLayout(context) {
  private val imageContainer = FrameLayout(context)
  private val image = ImageView(context)
  private val amount = TextView(context)
  private val collection = TextView(context)
  private val networkImage = ImageView(context)
  private val title = TextView(context)
  private var imageRequest: HomeContainerImageLoader.Request? = null
  private var networkImageRequest: HomeContainerImageLoader.Request? = null
  private var representedImageUrl: String? = null
  private var representedNetworkImageUrl: String? = null

  init {
    orientation = VERTICAL
    setPadding(dp(10), dp(10), dp(10), dp(10))
    isClickable = true
    isFocusable = true
    image.scaleType = ImageView.ScaleType.CENTER_CROP
    image.background = roundedBackground(Color.LTGRAY, dp(10).toFloat())
    image.clipToOutline = true
    imageContainer.addView(
      image,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    amount.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    amount.setTextColor(Color.WHITE)
    amount.gravity = Gravity.CENTER
    amount.setPadding(dp(6), 0, dp(6), 0)
    amount.background = roundedBackground(Color.argb(190, 0, 0, 0), dp(9).toFloat())
    imageContainer.addView(
      amount,
      FrameLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(18), Gravity.END or Gravity.BOTTOM).apply {
        marginEnd = dp(6)
        bottomMargin = dp(6)
      },
    )
    addView(imageContainer, LayoutParams(LayoutParams.MATCH_PARENT, 0))

    val collectionRow = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(0, dp(8), 0, 0)
    }
    collection.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
    collection.maxLines = 1
    collection.ellipsize = android.text.TextUtils.TruncateAt.END
    collectionRow.addView(collection, LayoutParams(0, dp(22), 1f))
    networkImage.scaleType = ImageView.ScaleType.CENTER_CROP
    networkImage.background = roundedBackground(Color.LTGRAY, dp(8).toFloat())
    networkImage.clipToOutline = true
    collectionRow.addView(networkImage, LayoutParams(dp(16), dp(16)))
    addView(collectionRow, LayoutParams(LayoutParams.MATCH_PARENT, dp(30)))

    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
    title.setTypeface(title.typeface, Typeface.BOLD)
    title.maxLines = 1
    title.ellipsize = android.text.TextUtils.TruncateAt.END
    addView(title, LayoutParams(LayoutParams.MATCH_PARENT, dp(24)))
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = View.MeasureSpec.getSize(widthMeasureSpec)
    val imageSize = (width - paddingLeft - paddingRight).coerceAtLeast(0)
    imageContainer.layoutParams = imageContainer.layoutParams.apply { height = imageSize }
    val desiredHeight = paddingTop + imageSize + dp(30) + dp(24) + paddingBottom
    super.onMeasure(
      widthMeasureSpec,
      View.MeasureSpec.makeMeasureSpec(desiredHeight, View.MeasureSpec.EXACTLY),
    )
  }

  fun bind(item: HomeContainerItem, theme: HomeContainerTheme) {
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    image.background = roundedBackground(
      parseHomeContainerColor(theme.cardColor, Color.LTGRAY),
      dp(10).toFloat(),
    )
    collection.text = item.subtitle.ifEmpty { "-" }
    collection.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    title.text = item.title.ifEmpty { "-" }
    title.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
    amount.text = item.value
    amount.visibility = if (item.value.isEmpty()) GONE else VISIBLE
    contentDescription = "${collection.text}, ${title.text}"
    loadImage(item.imageUrl, isNetwork = false)
    loadImage(item.badgeImageUrl, isNetwork = true)
  }

  fun recycle() {
    imageRequest?.cancel()
    networkImageRequest?.cancel()
    imageRequest = null
    networkImageRequest = null
    representedImageUrl = null
    representedNetworkImageUrl = null
    image.setImageDrawable(null)
    networkImage.setImageDrawable(null)
    networkImage.visibility = GONE
    setOnClickListener(null)
  }

  private fun loadImage(value: String, isNetwork: Boolean) {
    val representedValue = if (isNetwork) representedNetworkImageUrl else representedImageUrl
    if (representedValue == value) return
    if (isNetwork) {
      networkImageRequest?.cancel()
      networkImageRequest = null
      representedNetworkImageUrl = value
      networkImage.setImageDrawable(null)
      networkImage.visibility = if (value.isEmpty()) GONE else VISIBLE
    } else {
      imageRequest?.cancel()
      imageRequest = null
      representedImageUrl = value
      image.setImageDrawable(null)
    }
    if (value.isEmpty()) return
    val request = HomeContainerImageLoader.load(context, value) { bitmap ->
      val currentValue = if (isNetwork) representedNetworkImageUrl else representedImageUrl
      if (currentValue != value) return@load
      if (isNetwork) {
        networkImage.setImageBitmap(bitmap)
        networkImage.visibility = if (bitmap == null) GONE else VISIBLE
      } else {
        image.setImageBitmap(bitmap)
      }
    }
    if (isNetwork) {
      networkImageRequest = request
    } else {
      imageRequest = request
    }
  }

  private fun roundedBackground(color: Int, radius: Float): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private object HomeContainerFonts {
  private val cache = ConcurrentHashMap<String, Typeface>()

  fun regular(context: Context): Typeface = load(context, "Roobert-Regular.ttf", Typeface.NORMAL)

  fun medium(context: Context): Typeface = load(context, "Roobert-Medium.ttf", Typeface.NORMAL)

  fun semibold(context: Context): Typeface = load(context, "Roobert-SemiBold.ttf", Typeface.BOLD)

  private fun load(context: Context, filename: String, fallbackStyle: Int): Typeface =
    cache.getOrPut(filename) {
      runCatching { Typeface.createFromAsset(context.assets, "fonts/$filename") }
        .getOrElse { Typeface.create(Typeface.DEFAULT, fallbackStyle) }
    }
}

private class HomeContainerPathDrawable(
  pathData: List<String>,
  private val color: Int,
  private val viewportSize: Float = 24f,
) : Drawable() {
  private val paths = pathData.mapNotNull(PathParser::createPathFromPathData).onEach {
    it.fillType = Path.FillType.EVEN_ODD
  }
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = this@HomeContainerPathDrawable.color
  }

  override fun draw(canvas: Canvas) {
    if (bounds.isEmpty) return
    val checkpoint = canvas.save()
    canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
    canvas.scale(bounds.width() / viewportSize, bounds.height() / viewportSize)
    paths.forEach { canvas.drawPath(it, paint) }
    canvas.restoreToCount(checkpoint)
  }

  override fun setAlpha(alpha: Int) {
    paint.alpha = alpha
    invalidateSelf()
  }

  override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
    paint.colorFilter = colorFilter
    invalidateSelf()
  }

  @Deprecated("Deprecated in the Android framework")
  override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}

private object HomeContainerMarketArtwork {
  private const val STAR_OUTLINE =
    "m15.455 7.243 7.729 1.123-5.592 5.45 1.32 7.698L12 17.879l-6.911 3.635 1.32-7.698-5.592-5.45 7.728-1.123L12 .24zM9.872 9.071l-4.759.69 3.444 3.358-.814 4.738L12 15.62l.465.245 3.791 1.993-.813-4.739 3.443-3.357-4.758-.69L12 4.758z"
  private const val STAR_SOLID =
    "m15.405 7.313 7.84 1.034-5.735 5.443 1.44 7.774L12 17.793l-6.948 3.771 1.44-7.774L.756 8.347l7.839-1.034L12 .178z"
  private const val CHECK_RADIO =
    "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1.574 11.512L8.5 11.586 7.086 13l3.488 3.488 5.833-7.129-1.548-1.266z"
  private const val RECOGNIZED_THUMB = "M9.483 11.458v3.5h-1v-3.5z"
  private const val RECOGNIZED_SEAL =
    "M10.467 2.698a2.03 2.03 0 0 1 3.065 0l1.358 1.564a.03.03 0 0 0 .028.01l2.046-.325a2.03 2.03 0 0 1 2.347 1.971l.037 2.07q0 .016.014.026l1.776 1.066a2.03 2.03 0 0 1 .532 3.019l-1.304 1.609a.03.03 0 0 0-.005.03l.675 1.956a2.03 2.03 0 0 1-1.533 2.656l-2.033.394a.03.03 0 0 0-.023.019l-.741 1.933a2.03 2.03 0 0 1-2.88 1.05l-1.811-1.006a.03.03 0 0 0-.03 0l-1.811 1.005a2.03 2.03 0 0 1-2.88-1.049l-.742-1.933a.03.03 0 0 0-.023-.019l-2.033-.394a2.03 2.03 0 0 1-1.532-2.656l.675-1.957a.03.03 0 0 0-.005-.029l-1.304-1.61a2.03 2.03 0 0 1 .532-3.018l1.776-1.066a.03.03 0 0 0 .014-.026l.035-2.07a2.03 2.03 0 0 1 2.349-1.97l2.045.324a.03.03 0 0 0 .028-.01zm1.516 3.76a.5.5 0 0 0-.447.276l-1.861 3.724H8.483a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h6.692a2 2 0 0 0 1.981-1.73l.341-2.5a2 2 0 0 0-1.982-2.27h-1.939l.197-1.269a1.5 1.5 0 0 0-1.481-1.731z"
  private const val PLUS_SMALL = "M13 11h5v2h-5v5h-2v-5H6v-2h5V6h2z"
  private const val GAS_SOLID =
    "M15 9h4v7h1V8.414L17.586 6 19 4.586l3 3V18h-5v-7h-2v8h1v2H2v-2h1V3h12zM6 9v2h6V9z"
  private const val CATEGORY_GRID =
    "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"
  private const val CHEVRON_RIGHT_SMALL =
    "M15.414 12 10 17.414 8.586 16l4-4-4-4L10 6.586z"

  fun star(filled: Boolean, color: Int): Drawable = HomeContainerPathDrawable(
    listOf(if (filled) STAR_SOLID else STAR_OUTLINE),
    color,
  )

  fun checkRadio(color: Int): Drawable = HomeContainerPathDrawable(listOf(CHECK_RADIO), color)

  fun cryptoCoin(color: Int): Drawable = HomeContainerCryptoCoinDrawable(color)

  fun recognized(color: Int): Drawable = HomeContainerPathDrawable(
    listOf(RECOGNIZED_THUMB, RECOGNIZED_SEAL),
    color,
  )

  fun plus(color: Int): Drawable = HomeContainerPathDrawable(listOf(PLUS_SMALL), color)

  fun gas(color: Int): Drawable = HomeContainerPathDrawable(listOf(GAS_SOLID), color)

  fun categoryGrid(color: Int): Drawable = HomeContainerPathDrawable(listOf(CATEGORY_GRID), color)

  fun chevronRight(color: Int): Drawable = HomeContainerPathDrawable(
    listOf(CHEVRON_RIGHT_SMALL),
    color,
  ).apply {
    isAutoMirrored = true
  }
}

private class HomeContainerCryptoCoinDrawable(color: Int) : Drawable() {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f
    this.color = color
  }
  private val mark = Path().apply {
    addArc(16.5f, 16.5f, 23.5f, 23.5f, 31f, 298f)
    moveTo(20f, 14f)
    lineTo(20f, 15.6f)
    moveTo(20f, 24.4f)
    lineTo(20f, 26f)
  }

  override fun draw(canvas: Canvas) {
    if (bounds.isEmpty) return
    val checkpoint = canvas.save()
    canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
    canvas.scale(bounds.width() / 40f, bounds.height() / 40f)
    canvas.drawCircle(20f, 20f, 9f, paint)
    canvas.drawPath(mark, paint)
    canvas.restoreToCount(checkpoint)
  }

  override fun setAlpha(alpha: Int) {
    paint.alpha = alpha
    invalidateSelf()
  }

  override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
    paint.colorFilter = colorFilter
    invalidateSelf()
  }

  @Deprecated("Deprecated in the Android framework")
  override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}

private class HomeContainerImageBinding(private val context: Context) {
  private var request: HomeContainerImageLoader.Request? = null
  private var representedSignature: String? = null
  private var generation = 0

  fun bind(
    primary: String,
    fallbacks: List<String> = emptyList(),
    signatureSuffix: String = "",
    onStart: () -> Unit,
    onResult: (android.graphics.Bitmap?) -> Unit,
  ) {
    val candidates = HomeContainerImageLoader.candidates(primary, fallbacks)
    val signature = candidates.joinToString("|") + signatureSuffix
    if (representedSignature == signature) return
    generation += 1
    val activeGeneration = generation
    representedSignature = signature
    request?.cancel()
    request = null
    onStart()

    fun load(index: Int) {
      if (representedSignature != signature || generation != activeGeneration) return
      if (!candidates.indices.contains(index)) {
        onResult(null)
        return
      }
      val nextRequest = HomeContainerImageLoader.load(context, candidates[index]) { bitmap ->
        if (representedSignature != signature || generation != activeGeneration) return@load
        if (bitmap != null) onResult(bitmap) else load(index + 1)
      }
      request = nextRequest
      if (nextRequest == null) load(index + 1)
    }
    load(0)
  }

  fun recycle() {
    generation += 1
    representedSignature = null
    request?.cancel()
    request = null
  }
}

private fun homeContainerRoundedBackground(color: Int, radius: Float): GradientDrawable =
  GradientDrawable().apply {
    setColor(color)
    cornerRadius = radius
  }

private fun homeContainerInteractiveBackground(
  normalColor: Int,
  hoverColor: Int,
  activeColor: Int,
  radius: Float,
): StateListDrawable = StateListDrawable().apply {
  addState(
    intArrayOf(android.R.attr.state_pressed),
    homeContainerRoundedBackground(activeColor, radius),
  )
  addState(
    intArrayOf(android.R.attr.state_hovered),
    homeContainerRoundedBackground(hoverColor, radius),
  )
  addState(intArrayOf(), homeContainerRoundedBackground(normalColor, radius))
}

private fun View.dp(value: Float): Int = (value * resources.displayMetrics.density).roundToInt()

private class HomeMarketItemView(context: Context) : FrameLayout(context) {
  private val highlight = View(context)
  private val favoriteButton = ImageView(context)
  private val iconContainer = FrameLayout(context)
  private val iconImage = ImageView(context)
  private val badgeContainer = FrameLayout(context)
  private val badgeImage = ImageView(context)
  private val title = marketText(16f, HomeContainerFonts.medium(context), Gravity.START)
  private val leverage = marketText(10f, HomeContainerFonts.regular(context), Gravity.CENTER)
  private val titleAccessory = ImageView(context)
  private val recognized = ImageView(context)
  private val inlineBadges = LinearLayout(context)
  private val subtitle = marketText(14f, HomeContainerFonts.regular(context), Gravity.START)
  private val subtitleDetail = marketText(14f, HomeContainerFonts.regular(context), Gravity.START)
  private val value = marketText(16f, HomeContainerFonts.medium(context), Gravity.END)
  private val detail = marketText(14f, HomeContainerFonts.regular(context), Gravity.END)
  private val titleRow = LinearLayout(context)
  private val subtitleRow = LinearLayout(context)
  private val left = LinearLayout(context)
  private val right = LinearLayout(context)
  private val primaryImage = HomeContainerImageBinding(context)
  private val badgeImageBinding = HomeContainerImageBinding(context)
  private val titleAccessoryBinding = HomeContainerImageBinding(context)
  private var representedFavoriteItemId: String? = null
  private var representedFavoriteState: Boolean? = null
  private var showsFavorite = false
  private var measuredTextHeight = 0

  init {
    isClickable = true
    isFocusable = true
    clipChildren = false
    setWillNotDraw(false)

    highlight.isDuplicateParentStateEnabled = true
    addView(highlight)

    favoriteButton.scaleType = ImageView.ScaleType.CENTER
    favoriteButton.setPadding(dp(4), dp(4), dp(4), dp(4))
    favoriteButton.isClickable = true
    favoriteButton.isFocusable = true
    addView(favoriteButton)

    iconContainer.clipChildren = true
    iconContainer.clipToOutline = true
    iconImage.scaleType = ImageView.ScaleType.CENTER_CROP
    iconContainer.addView(iconImage)
    addView(iconContainer)

    badgeContainer.clipChildren = true
    badgeContainer.clipToOutline = true
    badgeImage.scaleType = ImageView.ScaleType.CENTER_CROP
    badgeImage.clipToOutline = true
    badgeContainer.addView(badgeImage)
    addView(badgeContainer)

    title.maxLines = 1
    title.ellipsize = TextUtils.TruncateAt.END
    title.maxWidth = dp(128)
    leverage.maxLines = 1
    leverage.setPadding(dp(6), 0, dp(6), 0)
    titleAccessory.scaleType = ImageView.ScaleType.CENTER_CROP
    titleAccessory.clipToOutline = true
    recognized.scaleType = ImageView.ScaleType.CENTER
    titleRow.orientation = LinearLayout.HORIZONTAL
    titleRow.gravity = Gravity.CENTER_VERTICAL
    titleRow.addView(title, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(24)))
    titleRow.addView(leverage, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(16)).apply {
      marginStart = dp(4)
    })
    titleRow.addView(titleAccessory, LinearLayout.LayoutParams(dp(14), dp(14)).apply {
      marginStart = dp(4)
    })
    titleRow.addView(recognized, LinearLayout.LayoutParams(dp(16), dp(16)).apply {
      marginStart = dp(4)
    })
    inlineBadges.orientation = LinearLayout.HORIZONTAL
    inlineBadges.gravity = Gravity.CENTER_VERTICAL
    titleRow.addView(
      inlineBadges,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        marginStart = dp(4)
      },
    )

    subtitle.maxLines = 1
    subtitle.ellipsize = TextUtils.TruncateAt.END
    subtitle.maxWidth = dp(66)
    subtitleDetail.maxLines = 1
    subtitleDetail.ellipsize = TextUtils.TruncateAt.END
    subtitleRow.orientation = LinearLayout.HORIZONTAL
    subtitleRow.gravity = Gravity.CENTER_VERTICAL
    subtitleRow.addView(subtitle, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(20)))
    subtitleRow.addView(
      subtitleDetail,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(20)).apply { marginStart = dp(6) },
    )

    left.orientation = LinearLayout.VERTICAL
    left.gravity = Gravity.CENTER_VERTICAL
    left.addView(titleRow, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(24)))
    left.addView(subtitleRow, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(20)))
    addView(left)

    value.maxLines = 1
    value.ellipsize = TextUtils.TruncateAt.END
    detail.maxLines = 1
    detail.ellipsize = TextUtils.TruncateAt.END
    right.orientation = LinearLayout.VERTICAL
    right.gravity = Gravity.END or Gravity.CENTER_VERTICAL
    right.addView(value, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(24)))
    right.addView(detail, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(20)))
    addView(right)
  }

  fun bind(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    val backgroundColor = parseHomeContainerColor(theme.backgroundColor, Color.WHITE)
    val primaryColor = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
    val secondaryColor = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
    val subduedColor = parseHomeContainerColor(
      theme.subduedIconColor.ifEmpty { theme.secondaryTextColor },
      secondaryColor,
    )
    setBackgroundColor(backgroundColor)
    highlight.background = homeContainerInteractiveBackground(
      normalColor = Color.TRANSPARENT,
      hoverColor = parseHomeContainerColor(
        theme.hoverColor.ifEmpty { theme.activeColor.ifEmpty { theme.cardColor } },
        Color.TRANSPARENT,
      ),
      activeColor = parseHomeContainerColor(
        theme.activeColor.ifEmpty { theme.hoverColor.ifEmpty { theme.cardColor } },
        Color.LTGRAY,
      ),
      radius = dp(12).toFloat(),
    )

    showsFavorite = item.favoriteActionId.isNotEmpty()
    favoriteButton.visibility = if (showsFavorite) VISIBLE else GONE
    favoriteButton.contentDescription = item.favoriteLabel
    favoriteButton.setOnClickListener {
      if (item.favoriteActionId.isNotEmpty()) {
        onAction?.invoke(item.favoriteActionId, item.id)
      }
    }
    val favoriteColor = if (item.favorite) primaryColor else subduedColor
    val nextStar = HomeContainerMarketArtwork.star(item.favorite, favoriteColor)
    val shouldAnimateFavorite =
      representedFavoriteItemId == item.id &&
        representedFavoriteState != null &&
        representedFavoriteState != item.favorite
    if (shouldAnimateFavorite) {
      val previousState = representedFavoriteState == true
      val previousColor = if (previousState) primaryColor else subduedColor
      favoriteButton.setImageDrawable(
        TransitionDrawable(
          arrayOf(
            HomeContainerMarketArtwork.star(previousState, previousColor),
            nextStar,
          ),
        ).apply {
          isCrossFadeEnabled = true
          startTransition(160)
        },
      )
    } else {
      favoriteButton.setImageDrawable(nextStar)
    }
    representedFavoriteItemId = if (showsFavorite) item.id else null
    representedFavoriteState = if (showsFavorite) item.favorite else null

    val fallbackBackground = cryptoCoinFallbackBackground(backgroundColor)
    iconContainer.background = homeContainerRoundedBackground(fallbackBackground, dp(16).toFloat())
    primaryImage.bind(
      primary = item.imageUrl,
      fallbacks = item.imageUrls,
      signatureSuffix = "|market:$subduedColor:$fallbackBackground",
      onStart = {
        iconImage.scaleType = ImageView.ScaleType.CENTER
        iconImage.setImageDrawable(HomeContainerMarketArtwork.cryptoCoin(subduedColor))
      },
      onResult = { bitmap ->
        if (bitmap != null) {
          iconImage.scaleType = ImageView.ScaleType.CENTER_CROP
          iconImage.setImageBitmap(bitmap)
        } else {
          iconImage.scaleType = ImageView.ScaleType.CENTER
          iconImage.setImageDrawable(HomeContainerMarketArtwork.cryptoCoin(subduedColor))
        }
      },
    )

    badgeContainer.background = homeContainerRoundedBackground(backgroundColor, dp(10).toFloat())
    badgeImageBinding.bind(
      primary = item.badgeImageUrl,
      signatureSuffix = "|market-badge",
      onStart = {
        badgeImage.setImageDrawable(null)
        badgeContainer.visibility = GONE
      },
      onResult = { bitmap ->
        badgeImage.setImageBitmap(bitmap)
        badgeContainer.visibility = if (bitmap == null) GONE else VISIBLE
      },
    )

    if (item.titleAccessoryIcon == "gas") {
      titleAccessoryBinding.recycle()
      titleAccessory.setImageDrawable(HomeContainerMarketArtwork.gas(subduedColor))
      titleAccessory.visibility = VISIBLE
    } else {
      titleAccessoryBinding.bind(
        primary = item.titleAccessoryImageUrl,
        signatureSuffix = "|market-accessory",
        onStart = {
          titleAccessory.setImageDrawable(null)
          titleAccessory.visibility = GONE
        },
        onResult = { bitmap ->
          titleAccessory.setImageBitmap(bitmap)
          titleAccessory.visibility = if (bitmap == null) GONE else VISIBLE
        },
      )
    }

    recognized.setImageDrawable(HomeContainerMarketArtwork.recognized(
      parseHomeContainerColor(theme.positiveColor, Color.rgb(31, 157, 103)),
    ))
    recognized.visibility = if (item.communityRecognized) VISIBLE else GONE
    updateInlineBadges(item.badges, theme)
    title.text = item.title
    title.setTextColor(primaryColor)
    leverage.text = item.badge
    leverage.visibility = if (item.badge.isEmpty()) GONE else VISIBLE
    leverage.setTextColor(parseHomeContainerColor(theme.accentColor, primaryColor))
    leverage.background = homeContainerRoundedBackground(
      parseHomeContainerColor(theme.cardColor, Color.LTGRAY),
      dp(4).toFloat(),
    )
    subtitle.text = item.subtitle
    subtitle.visibility = if (item.subtitle.isEmpty()) GONE else VISIBLE
    subtitle.setTextColor(secondaryColor)
    subtitleDetail.text = item.subtitleDetail
    subtitleDetail.visibility = if (item.subtitleDetail.isEmpty()) GONE else VISIBLE
    subtitleDetail.setTextColor(
      parseHomeContainerColor(item.subtitleDetailColor.ifEmpty { theme.secondaryTextColor }, secondaryColor),
    )
    value.text = item.value
    value.visibility = if (item.value.isEmpty()) GONE else VISIBLE
    value.setTextColor(primaryColor)
    detail.text = item.detail
    detail.visibility = if (item.detail.isEmpty()) GONE else VISIBLE
    detail.setTextColor(
      parseHomeContainerColor(item.accentColor.ifEmpty { theme.secondaryTextColor }, secondaryColor),
    )
    contentDescription = listOf(item.title, item.subtitle, item.subtitleDetail, item.value, item.detail)
      .filter(String::isNotEmpty)
      .joinToString(", ")
    setOnClickListener {
      if (item.actionId.isNotEmpty()) onAction?.invoke(item.actionId, item.id)
    }
    requestLayout()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val titleLineHeight = maxOf(
      dp(24),
      textLineHeight(title),
      textLineHeight(value),
      textLineHeight(leverage) + dp(4),
    )
    val subtitleLineHeight = maxOf(
      dp(20),
      textLineHeight(subtitle),
      textLineHeight(subtitleDetail),
      textLineHeight(detail),
    )
    measuredTextHeight = titleLineHeight + subtitleLineHeight
    updateLineHeight(title, titleLineHeight)
    updateLineHeight(leverage, maxOf(dp(16), textLineHeight(leverage) + dp(4)))
    updateLineHeight(titleRow, titleLineHeight)
    updateLineHeight(subtitle, subtitleLineHeight)
    updateLineHeight(subtitleDetail, subtitleLineHeight)
    updateLineHeight(subtitleRow, subtitleLineHeight)
    updateLineHeight(value, titleLineHeight)
    updateLineHeight(detail, subtitleLineHeight)
    val height = resolveHomeContainerRowHeight(
      dp(56),
      resources.configuration.fontScale,
      measuredTextHeight + dp(12),
    )
    measureExact(highlight, (width - dp(16)).coerceAtLeast(0), height)
    measureExact(favoriteButton, dp(28), dp(28))
    measureExact(iconContainer, dp(32), dp(32))
    measureExact(iconImage, dp(32), dp(32))
    measureExact(badgeContainer, dp(20), dp(20))
    measureExact(badgeImage, dp(16), dp(16))
    val iconStart = if (showsFavorite) 56 else 20
    val textStart = iconStart + 44
    right.measure(
      MeasureSpec.makeMeasureSpec(
        (width - dp(textStart + 8 + 16)).coerceAtLeast(0),
        MeasureSpec.AT_MOST,
      ),
      MeasureSpec.makeMeasureSpec(measuredTextHeight, MeasureSpec.EXACTLY),
    )
    val rightStart = width - dp(16) - right.measuredWidth
    val leftWidth = (rightStart - dp(8) - dp(textStart)).coerceAtLeast(0)
    left.measure(
      MeasureSpec.makeMeasureSpec(leftWidth, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(measuredTextHeight, MeasureSpec.EXACTLY),
    )
    setMeasuredDimension(width, height)
  }

  override fun onLayout(changed: Boolean, leftEdge: Int, top: Int, rightEdge: Int, bottom: Int) {
    val width = rightEdge - leftEdge
    val height = bottom - top
    placeLogical(highlight, 8, 0, width - dp(16), height, width)
    placeLogical(favoriteButton, 20, (height - dp(28)) / 2, dp(28), dp(28), width)
    val iconStart = if (showsFavorite) 56 else 20
    val iconTop = (height - dp(32)) / 2
    placeLogical(iconContainer, iconStart, iconTop, dp(32), dp(32), width)
    iconImage.layout(0, 0, dp(32), dp(32))
    placeLogical(badgeContainer, iconStart + 16, iconTop + 16, dp(20), dp(20), width)
    badgeImage.layout(dp(2), dp(2), dp(18), dp(18))
    val textStart = iconStart + 44
    val rightStart = width - dp(16) - right.measuredWidth
    val leftWidth = (rightStart - dp(8) - dp(textStart)).coerceAtLeast(0)
    placeLogical(
      left,
      textStart,
      (height - measuredTextHeight) / 2,
      leftWidth,
      measuredTextHeight,
      width,
    )
    if (layoutDirection == LAYOUT_DIRECTION_RTL) {
      right.layout(
        dp(16),
        (height - measuredTextHeight) / 2,
        dp(16) + right.measuredWidth,
        (height + measuredTextHeight) / 2,
      )
    } else {
      right.layout(
        rightStart,
        (height - measuredTextHeight) / 2,
        rightStart + right.measuredWidth,
        (height + measuredTextHeight) / 2,
      )
    }
  }

  fun recycle() {
    primaryImage.recycle()
    badgeImageBinding.recycle()
    titleAccessoryBinding.recycle()
    favoriteButton.setOnClickListener(null)
    setOnClickListener(null)
    iconImage.setImageDrawable(null)
    badgeImage.setImageDrawable(null)
    titleAccessory.setImageDrawable(null)
    inlineBadges.removeAllViews()
    representedFavoriteItemId = null
    representedFavoriteState = null
  }

  private fun placeLogical(
    view: View,
    start: Int,
    top: Int,
    width: Int,
    height: Int,
    parentWidth: Int,
  ) {
    val physicalLeft = if (layoutDirection == LAYOUT_DIRECTION_RTL) {
      parentWidth - dp(start) - width
    } else {
      dp(start)
    }
    view.layout(physicalLeft, top, physicalLeft + width, top + height)
  }

  private fun measureExact(view: View, width: Int, height: Int) {
    view.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
  }

  private fun textLineHeight(view: TextView): Int =
    view.paint.fontMetricsInt.let { it.descent - it.ascent }

  private fun updateLineHeight(view: View, height: Int) {
    view.layoutParams = view.layoutParams.apply { this.height = height }
  }

  private fun cryptoCoinFallbackBackground(backgroundColor: Int): Int {
    val luminance = (
      Color.red(backgroundColor) * 0.299f +
        Color.green(backgroundColor) * 0.587f +
        Color.blue(backgroundColor) * 0.114f
      ) / 255f
    return if (luminance < 0.5f) Color.rgb(49, 49, 49) else Color.rgb(224, 224, 224)
  }

  private fun updateInlineBadges(values: List<String>, theme: HomeContainerTheme) {
    inlineBadges.removeAllViews()
    val color = parseHomeContainerColor(theme.positiveColor, Color.rgb(31, 157, 103))
    values.take(2).forEachIndexed { index, value ->
      inlineBadges.addView(
        marketText(12f, HomeContainerFonts.medium(context), Gravity.CENTER).apply {
          text = value
          setTextColor(color)
          setPadding(dp(6), dp(2), dp(6), dp(2))
          background = homeContainerRoundedBackground(
            Color.argb(31, Color.red(color), Color.green(color), Color.blue(color)),
            dp(6).toFloat(),
          )
        },
        LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
          if (index > 0) marginStart = dp(4)
        },
      )
    }
    inlineBadges.visibility = if (values.isEmpty()) GONE else VISIBLE
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
  private fun dp(value: Float): Int = (value * resources.displayMetrics.density).roundToInt()

  private fun marketText(size: Float, typeface: Typeface, gravity: Int): TextView =
    TextView(context).apply {
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      this.typeface = typeface
      includeFontPadding = false
      this.gravity = gravity or Gravity.CENTER_VERTICAL
    }
}

private class HomeMarketRecommendationRowView(context: Context) : FrameLayout(context) {
  private val cards = listOf(
    HomeMarketRecommendationCardView(context),
    HomeMarketRecommendationCardView(context),
  )

  init {
    cards.forEach(::addView)
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
  }

  fun bind(
    items: List<HomeContainerItem>,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    cards.forEachIndexed { index, card ->
      val item = items.getOrNull(index)
      if (item == null) {
        card.visibility = INVISIBLE
        card.recycle()
      } else {
        card.visibility = VISIBLE
        card.bind(item, theme, onAction)
      }
    }
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val cardWidth = ((width - dp(40) - dp(10)) / 2).coerceAtLeast(0)
    val cardHeight = cards.maxOf(HomeMarketRecommendationCardView::preferredHeight)
    val height = resolveHomeContainerRowHeight(
      dp(68),
      resources.configuration.fontScale,
      cardHeight + dp(8),
    )
    cards.forEach { card ->
      card.measure(
        MeasureSpec.makeMeasureSpec(cardWidth, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(cardHeight, MeasureSpec.EXACTLY),
      )
    }
    setMeasuredDimension(width, height)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val width = right - left
    val height = bottom - top
    val cardWidth = ((width - dp(40) - dp(10)) / 2).coerceAtLeast(0)
    val cardHeight = maxOf(dp(60), height - dp(8))
    cards.forEachIndexed { index, card ->
      val logicalStart = dp(20) + index * (cardWidth + dp(10))
      val physicalLeft = if (layoutDirection == LAYOUT_DIRECTION_RTL) {
        width - logicalStart - cardWidth
      } else {
        logicalStart
      }
      card.layout(physicalLeft, 0, physicalLeft + cardWidth, cardHeight)
    }
  }

  fun recycle() {
    cards.forEach(HomeMarketRecommendationCardView::recycle)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
}

private class HomeMarketRecommendationCardView(context: Context) : FrameLayout(context) {
  private val iconContainer = FrameLayout(context)
  private val iconImage = ImageView(context)
  private val badgeContainer = FrameLayout(context)
  private val badgeImage = ImageView(context)
  private val title = text(14f, HomeContainerFonts.medium(context))
  private val leverage = text(10f, HomeContainerFonts.regular(context))
  private val titleAccessory = ImageView(context)
  private val recognized = ImageView(context)
  private val titleRow = LinearLayout(context)
  private val subtitle = text(12f, HomeContainerFonts.regular(context))
  private val check = ImageView(context)
  private val primaryImage = HomeContainerImageBinding(context)
  private val badgeImageBinding = HomeContainerImageBinding(context)
  private val titleAccessoryBinding = HomeContainerImageBinding(context)
  private var measuredTitleHeight = 0
  private var measuredSubtitleHeight = 0

  init {
    isClickable = true
    isFocusable = true
    clipChildren = false
    iconContainer.clipToOutline = true
    iconImage.scaleType = ImageView.ScaleType.CENTER_CROP
    iconContainer.addView(iconImage)
    addView(iconContainer)

    badgeContainer.clipToOutline = true
    badgeImage.scaleType = ImageView.ScaleType.CENTER_CROP
    badgeContainer.addView(badgeImage)
    addView(badgeContainer)

    title.maxLines = 1
    title.ellipsize = TextUtils.TruncateAt.END
    leverage.maxLines = 1
    leverage.setPadding(dp(4), 0, dp(4), 0)
    titleAccessory.scaleType = ImageView.ScaleType.CENTER_CROP
    titleAccessory.clipToOutline = true
    recognized.scaleType = ImageView.ScaleType.CENTER
    titleRow.orientation = LinearLayout.HORIZONTAL
    titleRow.gravity = Gravity.CENTER_VERTICAL
    titleRow.addView(title, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(20)))
    titleRow.addView(leverage, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(16)).apply {
      marginStart = dp(4)
    })
    titleRow.addView(titleAccessory, LinearLayout.LayoutParams(dp(14), dp(14)).apply {
      marginStart = dp(4)
    })
    titleRow.addView(recognized, LinearLayout.LayoutParams(dp(14), dp(14)).apply {
      marginStart = dp(4)
    })
    addView(titleRow)

    subtitle.maxLines = 1
    subtitle.ellipsize = TextUtils.TruncateAt.END
    addView(subtitle)
    check.scaleType = ImageView.ScaleType.CENTER
    addView(check)
  }

  fun bind(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    val backgroundColor = parseHomeContainerColor(theme.backgroundColor, Color.WHITE)
    val cardColor = parseHomeContainerColor(theme.cardColor, Color.LTGRAY)
    val primaryColor = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
    val secondaryColor = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
    val subduedColor = parseHomeContainerColor(
      theme.subduedIconColor.ifEmpty { theme.secondaryTextColor },
      secondaryColor,
    )
    background = homeContainerInteractiveBackground(
      normalColor = cardColor,
      hoverColor = parseHomeContainerColor(theme.hoverColor.ifEmpty { theme.cardColor }, cardColor),
      activeColor = parseHomeContainerColor(
        theme.activeColor.ifEmpty { theme.hoverColor.ifEmpty { theme.cardColor } },
        cardColor,
      ),
      radius = dp(12).toFloat(),
    )
    foreground = GradientDrawable().apply {
      setColor(Color.TRANSPARENT)
      setStroke(
        (resources.displayMetrics.density * 0.5f).roundToInt().coerceAtLeast(1),
        parseHomeContainerColor(theme.dividerColor, Color.GRAY),
      )
      cornerRadius = dp(12).toFloat()
    }
    iconContainer.background = homeContainerRoundedBackground(
      cryptoCoinFallbackBackground(backgroundColor),
      dp(16).toFloat(),
    )
    primaryImage.bind(
      primary = item.imageUrl,
      fallbacks = item.imageUrls,
      signatureSuffix = "|recommendation:$subduedColor:$backgroundColor",
      onStart = {
        iconImage.scaleType = ImageView.ScaleType.CENTER
        iconImage.setImageDrawable(HomeContainerMarketArtwork.cryptoCoin(subduedColor))
      },
      onResult = { bitmap ->
        if (bitmap != null) {
          iconImage.scaleType = ImageView.ScaleType.CENTER_CROP
          iconImage.setImageBitmap(bitmap)
        } else {
          iconImage.scaleType = ImageView.ScaleType.CENTER
          iconImage.setImageDrawable(HomeContainerMarketArtwork.cryptoCoin(subduedColor))
        }
      },
    )
    badgeContainer.background = homeContainerRoundedBackground(backgroundColor, dp(10).toFloat())
    badgeImageBinding.bind(
      primary = item.badgeImageUrl,
      signatureSuffix = "|recommendation-badge",
      onStart = {
        badgeImage.setImageDrawable(null)
        badgeContainer.visibility = GONE
      },
      onResult = { bitmap ->
        badgeImage.setImageBitmap(bitmap)
        badgeContainer.visibility = if (bitmap == null) GONE else VISIBLE
      },
    )
    if (item.titleAccessoryIcon == "gas") {
      titleAccessoryBinding.recycle()
      titleAccessory.setImageDrawable(HomeContainerMarketArtwork.gas(subduedColor))
      titleAccessory.visibility = VISIBLE
    } else {
      titleAccessoryBinding.bind(
        primary = item.titleAccessoryImageUrl,
        signatureSuffix = "|recommendation-accessory",
        onStart = {
          titleAccessory.setImageDrawable(null)
          titleAccessory.visibility = GONE
        },
        onResult = { bitmap ->
          titleAccessory.setImageBitmap(bitmap)
          titleAccessory.visibility = if (bitmap == null) GONE else VISIBLE
        },
      )
    }
    recognized.setImageDrawable(HomeContainerMarketArtwork.recognized(
      parseHomeContainerColor(theme.positiveColor, Color.rgb(31, 157, 103)),
    ))
    recognized.visibility = if (item.communityRecognized) VISIBLE else GONE
    title.text = item.title
    title.setTextColor(primaryColor)
    subtitle.text = item.subtitle
    subtitle.setTextColor(secondaryColor)
    leverage.text = item.badge
    leverage.visibility = if (item.badge.isEmpty()) GONE else VISIBLE
    leverage.setTextColor(parseHomeContainerColor(theme.accentColor, primaryColor))
    leverage.background = homeContainerRoundedBackground(cardColor, dp(3).toFloat())
    check.setImageDrawable(
      if (item.favorite) HomeContainerMarketArtwork.checkRadio(primaryColor) else null,
    )
    contentDescription = listOf(item.title, item.subtitle)
      .filter(String::isNotEmpty)
      .joinToString(", ")
    isSelected = item.favorite
    setOnClickListener {
      if (item.actionId.isNotEmpty()) onAction?.invoke(item.actionId, item.id)
    }
    requestLayout()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = MeasureSpec.getSize(heightMeasureSpec)
    measuredTitleHeight = maxOf(
      dp(20),
      textLineHeight(title),
      textLineHeight(leverage) + dp(4),
    )
    measuredSubtitleHeight = maxOf(dp(18), textLineHeight(subtitle))
    updateLineHeight(title, measuredTitleHeight)
    updateLineHeight(leverage, maxOf(dp(16), textLineHeight(leverage) + dp(4)))
    measureExact(iconContainer, dp(32), dp(32))
    measureExact(iconImage, dp(32), dp(32))
    measureExact(badgeContainer, dp(20), dp(20))
    measureExact(badgeImage, dp(16), dp(16))
    measureExact(check, dp(20), dp(20))
    val textWidth = (width - dp(54) - dp(34)).coerceAtLeast(0)
    titleRow.measure(
      MeasureSpec.makeMeasureSpec(textWidth, MeasureSpec.AT_MOST),
      MeasureSpec.makeMeasureSpec(measuredTitleHeight, MeasureSpec.EXACTLY),
    )
    measureExact(subtitle, textWidth, measuredSubtitleHeight)
    setMeasuredDimension(width, height)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val width = right - left
    val height = bottom - top
    val iconTop = (height - dp(32)) / 2
    placeLogical(iconContainer, 10, iconTop, dp(32), dp(32), width)
    iconImage.layout(0, 0, dp(32), dp(32))
    placeLogical(badgeContainer, 32, iconTop + 16, dp(20), dp(20), width)
    badgeImage.layout(dp(2), dp(2), dp(18), dp(18))
    placeLogical(check, widthInDp(width) - 30, (height - dp(20)) / 2, dp(20), dp(20), width)
    val textWidth = (width - dp(54) - dp(34)).coerceAtLeast(0)
    val textHeight = measuredTitleHeight + measuredSubtitleHeight + dp(1)
    val textTop = (height - textHeight) / 2
    placeLogical(titleRow, 54, textTop, titleRow.measuredWidth, measuredTitleHeight, width)
    placeLogical(
      subtitle,
      54,
      textTop + measuredTitleHeight + dp(1),
      textWidth,
      measuredSubtitleHeight,
      width,
    )
  }

  fun recycle() {
    primaryImage.recycle()
    badgeImageBinding.recycle()
    titleAccessoryBinding.recycle()
    iconImage.setImageDrawable(null)
    badgeImage.setImageDrawable(null)
    titleAccessory.setImageDrawable(null)
    setOnClickListener(null)
  }

  fun preferredHeight(): Int {
    val titleHeight = maxOf(dp(20), textLineHeight(title), textLineHeight(leverage) + dp(4))
    val subtitleHeight = maxOf(dp(18), textLineHeight(subtitle))
    return maxOf(dp(60), titleHeight + subtitleHeight + dp(9))
  }

  private fun placeLogical(
    view: View,
    start: Int,
    top: Int,
    width: Int,
    height: Int,
    parentWidth: Int,
  ) {
    val physicalLeft = if (layoutDirection == LAYOUT_DIRECTION_RTL) {
      parentWidth - dp(start) - width
    } else {
      dp(start)
    }
    view.layout(physicalLeft, top, physicalLeft + width, top + height)
  }

  private fun widthInDp(width: Int): Int = (width / resources.displayMetrics.density).roundToInt()

  private fun measureExact(view: View, width: Int, height: Int) {
    view.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
  }

  private fun textLineHeight(view: TextView): Int =
    view.paint.fontMetricsInt.let { it.descent - it.ascent }

  private fun updateLineHeight(view: View, height: Int) {
    view.layoutParams = view.layoutParams.apply { this.height = height }
  }

  private fun cryptoCoinFallbackBackground(backgroundColor: Int): Int {
    val luminance = (
      Color.red(backgroundColor) * 0.299f +
        Color.green(backgroundColor) * 0.587f +
        Color.blue(backgroundColor) * 0.114f
      ) / 255f
    return if (luminance < 0.5f) Color.rgb(49, 49, 49) else Color.rgb(224, 224, 224)
  }

  private fun text(size: Float, typeface: Typeface): TextView = TextView(context).apply {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    this.typeface = typeface
    includeFontPadding = false
    gravity = Gravity.CENTER_VERTICAL
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
}

private class HomeMarketSegmentsView(context: Context) : AxisLockHorizontalScrollView(context) {
  private val content = LinearLayout(context)
  private val buttons = mutableListOf<HomeMarketSegmentView>()

  init {
    isHorizontalScrollBarEnabled = false
    clipToPadding = false
    content.orientation = LinearLayout.HORIZONTAL
    content.gravity = Gravity.CENTER_VERTICAL
    content.setPadding(dp(20), dp(8), dp(20), dp(8))
    addView(
      content,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
  }

  fun bind(
    segments: List<HomeContainerSegment>,
    theme: HomeContainerTheme,
    onAction: ((String, String) -> Unit)?,
  ) {
    recycle()
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    segments.forEach { segment ->
      val button = HomeMarketSegmentView(context).apply {
        bind(segment, theme) {
          if (segment.actionId.isNotEmpty()) onAction?.invoke(segment.actionId, segment.id)
        }
      }
      buttons.add(button)
      content.addView(
        button,
        LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(32)).apply {
          marginEnd = dp(4)
        },
      )
    }
  }

  fun recycle() {
    buttons.forEach(HomeMarketSegmentView::recycle)
    buttons.clear()
    content.removeAllViews()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val buttonHeight = buttons.maxOfOrNull(HomeMarketSegmentView::preferredHeight) ?: dp(32)
    buttons.forEach { button ->
      button.layoutParams = button.layoutParams.apply { height = buttonHeight }
    }
    val scale = resources.configuration.fontScale.coerceAtLeast(1f).coerceAtMost(1.4f)
    val rowHeight = buttonHeight + dp(16 * scale)
    super.onMeasure(
      widthMeasureSpec,
      MeasureSpec.makeMeasureSpec(rowHeight, MeasureSpec.EXACTLY),
    )
    setMeasuredDimension(measuredWidth, rowHeight)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
}

private class HomeMarketSegmentView(context: Context) : LinearLayout(context) {
  private val icon = ImageView(context)
  private val label = TextView(context)
  private val imageBinding = HomeContainerImageBinding(context)

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER
    isClickable = true
    isFocusable = true
    clipToOutline = true
    icon.scaleType = ImageView.ScaleType.CENTER_CROP
    addView(icon, LayoutParams(dp(18), dp(18)))
    label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    label.typeface = HomeContainerFonts.medium(context)
    label.includeFontPadding = false
    label.maxLines = 1
    label.ellipsize = TextUtils.TruncateAt.END
    addView(label, LayoutParams(LayoutParams.WRAP_CONTENT, dp(20)).apply {
      marginStart = dp(8)
    })
  }

  fun bind(
    segment: HomeContainerSegment,
    theme: HomeContainerTheme,
    onPress: () -> Unit,
  ) {
    val selected = segment.selected
    val foreground = parseHomeContainerColor(
      if (selected) theme.primaryTextColor else theme.secondaryTextColor,
      if (selected) Color.BLACK else Color.DKGRAY,
    )
    val iconColor = parseHomeContainerColor(
      if (selected) theme.primaryTextColor else theme.subduedIconColor.ifEmpty {
        theme.secondaryTextColor
      },
      foreground,
    )
    val normal = if (selected) {
      parseHomeContainerColor(theme.activeColor.ifEmpty { theme.cardColor }, Color.LTGRAY)
    } else {
      Color.TRANSPARENT
    }
    background = homeContainerInteractiveBackground(
      normalColor = normal,
      hoverColor = parseHomeContainerColor(
        theme.hoverColor.ifEmpty { theme.activeColor.ifEmpty { theme.cardColor } },
        Color.LTGRAY,
      ),
      activeColor = parseHomeContainerColor(
        theme.activeColor.ifEmpty { theme.hoverColor.ifEmpty { theme.cardColor } },
        Color.LTGRAY,
      ),
      radius = dp(16).toFloat(),
    )
    label.text = segment.title
    label.setTextColor(foreground)
    label.visibility = if (segment.iconOnly) GONE else VISIBLE
    val hasLeadingImage = segment.leadingIcon.isNotEmpty() || segment.imageUrl.isNotEmpty()
    icon.visibility = if (hasLeadingImage) VISIBLE else GONE
    val fallback = when (segment.leadingIcon) {
      "star" -> HomeContainerMarketArtwork.star(filled = false, color = iconColor)
      else -> HomeContainerMarketArtwork.categoryGrid(iconColor)
    }
    imageBinding.bind(
      primary = segment.imageUrl,
      signatureSuffix = "|segment:$iconColor:${segment.leadingIcon}",
      onStart = { icon.setImageDrawable(fallback) },
      onResult = { bitmap ->
        if (bitmap != null) icon.setImageBitmap(bitmap) else icon.setImageDrawable(fallback)
      },
    )
    val horizontalPadding = if (hasLeadingImage && !segment.iconOnly) 14 else 10
    setPadding(dp(horizontalPadding), 0, dp(horizontalPadding), 0)
    (label.layoutParams as LayoutParams).marginStart = if (hasLeadingImage) dp(8) else 0
    minimumWidth = if (segment.iconOnly) dp(38) else 0
    contentDescription = segment.title
    isSelected = selected
    setOnClickListener { onPress() }
  }

  fun recycle() {
    imageBinding.recycle()
    icon.setImageDrawable(null)
    setOnClickListener(null)
  }

  fun preferredHeight(): Int {
    val scale = resources.configuration.fontScale.coerceAtLeast(1f).coerceAtMost(1.4f)
    return maxOf(dp(32 * scale), textLineHeight(label) + dp(12))
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val labelHeight = maxOf(dp(20), textLineHeight(label))
    label.layoutParams = label.layoutParams.apply { height = labelHeight }
    val height = preferredHeight()
    super.onMeasure(
      widthMeasureSpec,
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    setMeasuredDimension(measuredWidth, height)
  }

  private fun textLineHeight(view: TextView): Int =
    view.paint.fontMetricsInt.let { it.descent - it.ascent }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
  private fun dp(value: Float): Int = (value * resources.displayMetrics.density).roundToInt()
}

private class HomeSectionTitleView(context: Context) : LinearLayout(context) {
  private val title = TextView(context)
  private val action = TextView(context)

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    setPadding(dp(20), 0, dp(20), 0)
    title.typeface = HomeContainerFonts.semibold(context)
    addView(title, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    action.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    action.setTypeface(HomeContainerFonts.regular(context))
    action.gravity = Gravity.CENTER
    action.setPadding(dp(6), dp(4), dp(6), dp(4))
    addView(action, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
  }

  fun bind(
    row: HomeListRow,
    theme: HomeContainerTheme,
    isHistory: Boolean,
    onAction: (String) -> Unit,
  ) {
    title.text = row.title
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (isHistory) 13f else 20f)
    title.setTextColor(
      parseHomeContainerColor(
        if (isHistory) theme.secondaryTextColor else theme.primaryTextColor,
        Color.BLACK,
      ),
    )
    val isMarketRecommendation = row.sectionLayout == "marketRecommendations"
    val chevron = if (layoutDirection == LAYOUT_DIRECTION_RTL) "‹" else "›"
    action.text = when {
      row.actionTitle.isEmpty() -> ""
      isMarketRecommendation -> row.actionTitle
      else -> "${row.actionTitle}  $chevron"
    }
    action.visibility = if (row.actionTitle.isEmpty()) GONE else VISIBLE
    val actionColor = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
    action.setTextColor(actionColor)
    val leadingDrawable = if (isMarketRecommendation) {
      HomeContainerMarketArtwork.plus(actionColor).apply {
        setBounds(0, 0, dp(18), dp(18))
      }
    } else {
      null
    }
    action.setCompoundDrawablesRelative(leadingDrawable, null, null, null)
    action.compoundDrawablePadding = if (leadingDrawable == null) 0 else dp(4)
    action.isEnabled = !row.actionDisabled
    action.alpha = if (row.actionDisabled) 0.45f else 1f
    action.background = homeContainerInteractiveBackground(
      normalColor = Color.TRANSPARENT,
      hoverColor = parseHomeContainerColor(theme.hoverColor, Color.TRANSPARENT),
      activeColor = parseHomeContainerColor(theme.activeColor, Color.TRANSPARENT),
      radius = dp(10).toFloat(),
    )
    action.contentDescription = if (isMarketRecommendation) {
      "native-home-market-add-recommended"
    } else {
      "native-home-section-action-${row.stableId.removePrefix("section:")}"
    }
    action.setOnClickListener {
      if (!row.actionDisabled) row.actionId.takeIf { it.isNotEmpty() }?.let(onAction)
    }
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, dp(if (isHistory) 44 else 56))
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HomeItemView(context: Context) : LinearLayout(context) {
  private val iconContainer = FrameLayout(context)
  private val iconImage = ImageView(context)
  private val secondaryIconImage = ImageView(context)
  private val badgeImage = ImageView(context)
  private val icon = TextView(context)
  private val title = TextView(context)
  private val subtitle = TextView(context)
  private val subtitleDetail = TextView(context)
  private val value = TextView(context)
  private val detail = TextView(context)
  private val chevron = TextView(context)
  private val centerPill = LinearLayout(context)
  private val centerButton = TextView(context)
  private val centerChevron = ImageView(context)
  private val left = LinearLayout(context)
  private val subtitleRow = LinearLayout(context)
  private val right = LinearLayout(context)
  private var iconSkeleton: SkeletonNativeView? = null
  private var titleSkeleton: SkeletonNativeView? = null
  private var subtitleSkeleton: SkeletonNativeView? = null
  private var valueSkeleton: SkeletonNativeView? = null
  private var detailSkeleton: SkeletonNativeView? = null
  private var imageRequest: HomeContainerImageLoader.Request? = null
  private var secondaryImageRequest: HomeContainerImageLoader.Request? = null
  private var badgeImageRequest: HomeContainerImageLoader.Request? = null
  private var representedImageUrl: String? = null
  private var representedSecondaryImageUrl: String? = null
  private var representedBadgeImageUrl: String? = null
  private val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private var drawsDivider = true

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    setPadding(dp(16), 0, dp(16), 0)
    isClickable = true
    isFocusable = true
    setWillNotDraw(false)

    iconImage.scaleType = ImageView.ScaleType.CENTER_CROP
    iconContainer.addView(
      iconImage,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    icon.gravity = Gravity.CENTER
    icon.setTypeface(icon.typeface, Typeface.BOLD)
    iconContainer.addView(
      icon,
      FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    secondaryIconImage.scaleType = ImageView.ScaleType.CENTER_CROP
    iconContainer.addView(
      secondaryIconImage,
      FrameLayout.LayoutParams(dp(26), dp(26), Gravity.END or Gravity.BOTTOM),
    )
    badgeImage.scaleType = ImageView.ScaleType.CENTER_CROP
    addView(iconContainer, LinearLayout.LayoutParams(dp(40), dp(40)))
    iconContainer.addView(
      badgeImage,
      FrameLayout.LayoutParams(dp(16), dp(16), Gravity.END or Gravity.BOTTOM),
    )

    left.apply {
      orientation = VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      title.setTypeface(title.typeface, Typeface.NORMAL)
      subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      addView(title)
      subtitleRow.apply {
        orientation = HORIZONTAL
        addView(subtitle)
        subtitleDetail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        addView(subtitleDetail, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
          marginStart = dp(4)
        })
      }
      addView(subtitleRow, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(3)
      })
    }
    addView(left, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
      marginStart = dp(12)
    })

    right.apply {
      orientation = VERTICAL
      gravity = Gravity.END
      value.gravity = Gravity.END
      detail.gravity = Gravity.END
      value.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      detail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      addView(value, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
      addView(detail, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(3)
      })
    }
    addView(right, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
    chevron.text = "›"
    chevron.gravity = Gravity.CENTER
    chevron.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
    addView(chevron, LinearLayout.LayoutParams(dp(20), LayoutParams.MATCH_PARENT))
    centerPill.orientation = HORIZONTAL
    centerPill.gravity = Gravity.CENTER
    centerPill.isDuplicateParentStateEnabled = true
    centerButton.gravity = Gravity.CENTER
    centerButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
    centerChevron.scaleType = ImageView.ScaleType.CENTER
    centerPill.addView(centerButton, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, dp(24)))
    centerPill.addView(centerChevron, LinearLayout.LayoutParams(dp(20), dp(20)).apply {
      marginStart = dp(8)
    })
    addView(centerPill, LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, dp(68))
  }

  fun bind(item: HomeContainerItem, theme: HomeContainerTheme) {
    val isLoading = item.renderer == "loading"
    alpha = 1f
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    icon.text = if (isLoading) {
      ""
    } else {
      when (item.leadingIcon) {
        "star" -> "★"
        "support" -> "◉"
        "book" -> "▣"
        "download" -> "↓"
        "prime" -> "1"
        else -> item.title.take(1).uppercase()
      }
    }
    icon.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
    iconContainer.background = GradientDrawable().apply {
      setColor(
        if (item.renderer == "upgrade") Color.rgb(224, 255, 217)
        else parseHomeContainerColor(theme.cardColor, Color.LTGRAY),
      )
      if (item.renderer == "upgrade") {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(10).toFloat()
      } else {
        shape = GradientDrawable.OVAL
      }
    }
    if (item.renderer == "upgrade") icon.setTextColor(Color.BLACK)
    val usesPairedHistoryIcons =
      item.renderer == "history" && item.secondaryImageUrl.isNotEmpty()
    iconContainer.clipChildren = !usesPairedHistoryIcons
    iconContainer.clipToOutline = !usesPairedHistoryIcons
    iconImage.layoutParams = FrameLayout.LayoutParams(
      if (usesPairedHistoryIcons) dp(24) else LayoutParams.MATCH_PARENT,
      if (usesPairedHistoryIcons) dp(24) else LayoutParams.MATCH_PARENT,
      Gravity.START or Gravity.TOP,
    )
    secondaryIconImage.layoutParams = FrameLayout.LayoutParams(
      dp(if (usesPairedHistoryIcons) 24 else 26),
      dp(if (usesPairedHistoryIcons) 24 else 26),
      Gravity.END or Gravity.BOTTOM,
    )
    loadImage(item.imageUrl)
    loadAuxiliaryImage(item.secondaryImageUrl, secondaryIconImage, true)
    loadAuxiliaryImage(item.badgeImageUrl, badgeImage, false)
    title.text = if (isLoading) "            " else item.title
    title.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
    subtitle.text = if (isLoading) "        " else item.subtitle
    subtitle.visibility = if (isLoading || item.subtitle.isNotEmpty()) VISIBLE else GONE
    subtitle.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    subtitleDetail.text = item.subtitleDetail
    subtitleDetail.visibility = if (item.subtitleDetail.isEmpty()) GONE else VISIBLE
    subtitleDetail.setTextColor(
      parseHomeContainerColor(item.subtitleDetailColor.ifEmpty { theme.secondaryTextColor }, Color.DKGRAY),
    )
    value.text = if (isLoading) "      " else item.value
    value.visibility = if (isLoading || item.value.isNotEmpty()) VISIBLE else GONE
    value.setTextColor(
      parseHomeContainerColor(
        if (item.renderer == "market") theme.primaryTextColor
        else item.accentColor.ifEmpty { theme.primaryTextColor },
        Color.BLACK,
      ),
    )
    detail.text = if (isLoading) "    " else item.detail
    detail.visibility = if (isLoading || item.detail.isNotEmpty()) VISIBLE else GONE
    detail.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    if (item.renderer == "market") {
      detail.setTextColor(
        parseHomeContainerColor(item.accentColor.ifEmpty { theme.secondaryTextColor }, Color.DKGRAY),
      )
    }
    listOf(title, subtitle, value, detail).forEach { label ->
      label.background = null
    }
    updateSkeletonState(isLoading = isLoading, theme = theme)
    if (item.renderer == "upgrade") {
      value.text = item.buttonTitle
      value.visibility = if (item.buttonTitle.isEmpty()) GONE else VISIBLE
      value.setTextColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
      value.background = GradientDrawable().apply {
        setColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
        cornerRadius = dp(16).toFloat()
      }
      value.setPadding(dp(12), dp(6), dp(12), dp(6))
    } else {
      value.setPadding(0, 0, 0, 0)
      value.background = null
    }
    chevron.text = if (layoutDirection == LAYOUT_DIRECTION_RTL) "‹" else "›"
    chevron.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    chevron.visibility = if (!isLoading && item.showChevron) VISIBLE else GONE
    val isCentered =
      item.renderer == "addToken" ||
        item.renderer == "showMore" ||
        item.renderer == "marketTabs" ||
        item.renderer == "empty"
    iconContainer.visibility = if (isCentered) GONE else VISIBLE
    left.visibility = if (isCentered) GONE else VISIBLE
    right.visibility = if (isCentered) GONE else VISIBLE
    chevron.visibility = if (!isLoading && !isCentered && item.showChevron) VISIBLE else GONE
    centerPill.visibility = if (isCentered) VISIBLE else GONE
    if (item.renderer == "showMore") {
      centerButton.gravity = Gravity.CENTER
      centerButton.text = item.title
      centerButton.typeface = HomeContainerFonts.medium(context)
      val foregroundColor = parseHomeContainerColor(theme.primaryTextColor, Color.BLACK)
      centerButton.setTextColor(foregroundColor)
      centerChevron.setImageDrawable(HomeContainerMarketArtwork.chevronRight(foregroundColor))
      centerChevron.visibility = if (item.showChevron) VISIBLE else GONE
      centerPill.background = homeContainerInteractiveBackground(
        normalColor = parseHomeContainerColor(theme.cardColor, Color.LTGRAY),
        hoverColor = parseHomeContainerColor(
          theme.hoverColor.ifEmpty { theme.cardColor },
          Color.LTGRAY,
        ),
        activeColor = parseHomeContainerColor(
          theme.activeColor.ifEmpty { theme.hoverColor.ifEmpty { theme.cardColor } },
          Color.LTGRAY,
        ),
        radius = dp(18).toFloat(),
      )
      centerPill.layoutParams = (centerPill.layoutParams as LinearLayout.LayoutParams).apply {
        height = dp(36)
        gravity = Gravity.BOTTOM
        marginStart = dp(4)
        marginEnd = dp(4)
      }
    } else if (item.renderer == "empty") {
      centerButton.gravity = Gravity.CENTER
      centerButton.text = item.title
      centerButton.typeface = HomeContainerFonts.regular(context)
      centerButton.setTextColor(
        parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY),
      )
      centerChevron.visibility = GONE
      centerPill.background = null
      centerPill.layoutParams = (centerPill.layoutParams as LinearLayout.LayoutParams).apply {
        height = LayoutParams.MATCH_PARENT
        gravity = Gravity.CENTER
        marginStart = 0
        marginEnd = 0
      }
    } else if (item.renderer == "marketTabs") {
      centerButton.gravity = Gravity.CENTER_VERTICAL or Gravity.START
      centerButton.text = "☆    ${item.title}      ${item.subtitle}"
      centerButton.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
      centerChevron.visibility = GONE
      centerPill.background = null
      centerPill.layoutParams = (centerPill.layoutParams as LinearLayout.LayoutParams).apply {
        height = LayoutParams.MATCH_PARENT
        gravity = Gravity.CENTER_VERTICAL
        marginStart = 0
        marginEnd = 0
      }
    } else if (item.renderer == "addToken") {
      centerButton.gravity = Gravity.CENTER
      centerButton.typeface = HomeContainerFonts.regular(context)
      val instructionColor = parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY)
      val actionColor = parseHomeContainerColor(
        theme.subduedIconColor.ifEmpty { theme.secondaryTextColor },
        Color.DKGRAY,
      )
      val instruction = "${item.title}  "
      val action = "${item.buttonTitle}  →"
      centerButton.text = SpannableString(instruction + action).apply {
        setSpan(
          ForegroundColorSpan(instructionColor),
          0,
          instruction.length,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
        setSpan(
          ForegroundColorSpan(actionColor),
          instruction.length,
          instruction.length + action.length,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
      }
      centerChevron.visibility = GONE
      centerPill.background = null
      centerPill.layoutParams = (centerPill.layoutParams as LinearLayout.LayoutParams).apply {
        height = LayoutParams.MATCH_PARENT
        gravity = Gravity.CENTER
        marginStart = 0
        marginEnd = 0
      }
    }
    val usesCard = item.renderer == "supportAction" || item.renderer == "upgrade"
    drawsDivider = item.showDivider
    dividerPaint.color = parseHomeContainerColor(theme.dividerColor, Color.GRAY)
    dividerPaint.strokeWidth = (resources.displayMetrics.density * 0.5f).coerceAtLeast(1f)
    layoutParams = RecyclerView.LayoutParams(
      LayoutParams.MATCH_PARENT,
      dp(
        when (item.renderer) {
          "nft" -> 92
          "history" -> 60
          "defi", "market" -> 64
          "showMore" -> 48
          "earn", "marketTabs" -> 56
          "supportAction" -> 76
          "upgrade" -> 96
          "empty", "loading" -> item.displayHeight.takeIf { it > 0 } ?: 320
          else -> 68
        },
      ),
    ).apply {
      if (usesCard) setMargins(dp(16), dp(6), dp(16), dp(6))
    }
    background = GradientDrawable().apply {
      setColor(
        parseHomeContainerColor(
          if (usesCard) theme.cardColor else theme.backgroundColor,
          Color.WHITE,
        ),
      )
      if (usesCard) {
        setStroke(dp(1), parseHomeContainerColor(theme.dividerColor, Color.GRAY))
        cornerRadius = dp(12).toFloat()
      }
    }
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (!drawsDivider) return
    val inset = dp(16).toFloat()
    val contentInset = dp(68).toFloat()
    val startX = if (layoutDirection == LAYOUT_DIRECTION_RTL) inset else contentInset
    val endX = if (layoutDirection == LAYOUT_DIRECTION_RTL) width - contentInset else width - inset
    val y = height - dividerPaint.strokeWidth / 2f
    canvas.drawLine(startX, y, endX, y, dividerPaint)
  }

  fun recycle() {
    imageRequest?.cancel()
    secondaryImageRequest?.cancel()
    badgeImageRequest?.cancel()
    imageRequest = null
    secondaryImageRequest = null
    badgeImageRequest = null
    representedImageUrl = null
    representedSecondaryImageUrl = null
    representedBadgeImageUrl = null
    iconImage.setImageDrawable(null)
    iconImage.visibility = GONE
    secondaryIconImage.visibility = GONE
    badgeImage.visibility = GONE
    icon.visibility = VISIBLE
    clearSkeletonViews()
  }

  private fun updateSkeletonState(isLoading: Boolean, theme: HomeContainerTheme) {
    if (!isLoading) {
      clearSkeletonViews()
      return
    }

    icon.visibility = GONE
    iconImage.visibility = GONE
    secondaryIconImage.visibility = GONE
    badgeImage.visibility = GONE
    title.visibility = GONE
    subtitleRow.visibility = GONE
    value.visibility = GONE
    detail.visibility = GONE

    if (iconSkeleton == null) {
      iconSkeleton = createSkeletonView(radius = 20).also {
        iconContainer.addView(
          it,
          FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
      }
      titleSkeleton = createSkeletonView().also {
        left.addView(it, LinearLayout.LayoutParams(dp(128), dp(16)))
      }
      subtitleSkeleton = createSkeletonView().also {
        left.addView(it, LinearLayout.LayoutParams(dp(96), dp(12)).apply {
          topMargin = dp(8)
        })
      }
      valueSkeleton = createSkeletonView().also {
        right.addView(it, LinearLayout.LayoutParams(dp(64), dp(16)).apply {
          gravity = Gravity.END
        })
      }
      detailSkeleton = createSkeletonView().also {
        right.addView(it, LinearLayout.LayoutParams(dp(48), dp(12)).apply {
          gravity = Gravity.END
          topMargin = dp(8)
        })
      }
    }
    listOfNotNull(
      iconSkeleton,
      titleSkeleton,
      subtitleSkeleton,
      valueSkeleton,
      detailSkeleton,
    ).forEach { it.applyHomeContainerSkeletonTheme(theme) }
  }

  private fun createSkeletonView(radius: Int = 8): SkeletonNativeView =
    SkeletonNativeView(context).apply {
      background = GradientDrawable().apply {
        cornerRadius = dp(radius).toFloat()
      }
      clipToOutline = true
    }

  private fun clearSkeletonViews() {
    iconSkeleton?.let(iconContainer::removeView)
    titleSkeleton?.let(left::removeView)
    subtitleSkeleton?.let(left::removeView)
    valueSkeleton?.let(right::removeView)
    detailSkeleton?.let(right::removeView)
    iconSkeleton = null
    titleSkeleton = null
    subtitleSkeleton = null
    valueSkeleton = null
    detailSkeleton = null
    title.visibility = VISIBLE
    subtitleRow.visibility = VISIBLE
  }

  private fun loadImage(value: String) {
    if (representedImageUrl == value) return
    imageRequest?.cancel()
    imageRequest = null
    representedImageUrl = value
    iconImage.setImageDrawable(null)
    iconImage.visibility = INVISIBLE
    icon.visibility = VISIBLE
    if (value.isEmpty()) return
    imageRequest = HomeContainerImageLoader.load(context, value) { bitmap ->
      if (representedImageUrl != value) return@load
      if (bitmap != null) {
        iconImage.setImageBitmap(bitmap)
        iconImage.visibility = VISIBLE
        icon.visibility = GONE
        iconImage.invalidate()
        iconContainer.invalidate()
        invalidate()
      }
    }
  }

  private fun loadAuxiliaryImage(value: String, target: ImageView, secondary: Boolean) {
    val represented = if (secondary) representedSecondaryImageUrl else representedBadgeImageUrl
    if (represented == value) return
    if (secondary) {
      secondaryImageRequest?.cancel()
      secondaryImageRequest = null
      representedSecondaryImageUrl = value
    } else {
      badgeImageRequest?.cancel()
      badgeImageRequest = null
      representedBadgeImageUrl = value
    }
    target.setImageDrawable(null)
    target.visibility = INVISIBLE
    if (value.isEmpty()) return
    val request = HomeContainerImageLoader.load(context, value) { bitmap ->
      val current = if (secondary) representedSecondaryImageUrl else representedBadgeImageUrl
      if (current != value) return@load
      target.setImageBitmap(bitmap)
      target.visibility = if (bitmap == null) GONE else VISIBLE
    }
    if (secondary) secondaryImageRequest = request else badgeImageRequest = request
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private open class AxisLockHorizontalScrollView(context: Context) : HorizontalScrollView(context) {
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var downX = 0f
  private var downY = 0f
  private var horizontalGesture = false

  init {
    isHorizontalScrollBarEnabled = false
    overScrollMode = View.OVER_SCROLL_NEVER
  }

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = event.x
        downY = event.y
        horizontalGesture = false
        parent?.requestDisallowInterceptTouchEvent(true)
        super.onInterceptTouchEvent(event)
        return false
      }
      MotionEvent.ACTION_MOVE -> {
        val dx = abs(event.x - downX)
        val dy = abs(event.y - downY)
        if (dx > touchSlop || dy > touchSlop) {
          horizontalGesture = dx > dy
          parent?.requestDisallowInterceptTouchEvent(horizontalGesture)
          if (!horizontalGesture) return false
        }
      }
      MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_UP -> {
        parent?.requestDisallowInterceptTouchEvent(false)
      }
    }
    return horizontalGesture && super.onInterceptTouchEvent(event)
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_MOVE && !horizontalGesture) {
      val dx = abs(event.x - downX)
      val dy = abs(event.y - downY)
      if (dy > touchSlop && dy > dx) return false
    }
    if (event.actionMasked == MotionEvent.ACTION_CANCEL || event.actionMasked == MotionEvent.ACTION_UP) {
      parent?.requestDisallowInterceptTouchEvent(false)
    }
    return super.onTouchEvent(event)
  }
}
