package com.margelo.nitro.onekeynativecomponents

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.SpannableString
import android.text.Spanned
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
import androidx.core.view.setPadding
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.ViewPager2
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

internal class HomeContainerView(context: Context) : FrameLayout(context) {
  var onAction: ((String, String, String) -> Unit)? = null
  var onRefresh: ((String, String) -> Unit)? = null
  var onVisibleTabChange: ((String) -> Unit)? = null
  var onRenderError: ((String, String) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null

  private val parser = Executors.newSingleThreadExecutor()
  private val disposed = AtomicBoolean(false)
  private val pager = ViewPager2(context)
  private val adapter = HomePagerAdapter()
  private val headerView = HomeHeaderView(context)
  private val tabsView = HomeTabsView(context)
  private val bodySlotTarget = FrameLayout(context)
  private val refreshPages = mutableMapOf<String, HomePageView>()
  private var snapshot: HomeContainerSnapshot? = null
  private var selectedTabId = ""
  private var suppressPageCallback = false
  private var refreshEnabled = false
  private var headerHeight = 0
  private var collapseOffset = 0
  private var refreshPullOffset = 0
  private var mountedSlotKeys = emptySet<String>()
  private val chromeTouchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var chromeGestureCandidate = false
  private var interceptingChromeVertical = false
  private var chromeDownX = 0f
  private var chromeDownY = 0f
  private var chromeDownEvent: MotionEvent? = null
  private var externalHorizontalTarget: View? = null
  private val isBodySlotMounted: Boolean
    get() = mountedSlotKeys.contains("content.body")

  init {
    clipChildren = true
    pager.orientation = ViewPager2.ORIENTATION_HORIZONTAL
    pager.adapter = adapter
    pager.offscreenPageLimit = 5
    addView(pager, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(bodySlotTarget, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(headerView, LayoutParams(LayoutParams.MATCH_PARENT, 0))
    addView(tabsView, LayoutParams(LayoutParams.MATCH_PARENT, dp(TAB_HEIGHT_DP)))
    bodySlotTarget.visibility = GONE
    headerView.onAction = { actionId, itemId ->
      onAction?.invoke(actionId, itemId, selectedTabId)
    }
    tabsView.onAction = { actionId, itemId ->
      onAction?.invoke(actionId, itemId, selectedTabId)
    }
    tabsView.onSelect = { tabId ->
      moveToTab(tabId, true, true)
    }
    headerView.onSlotLayoutChange = { onSlotLayoutChange?.invoke() }
    tabsView.onSlotLayoutChange = { onSlotLayoutChange?.invoke() }
    pager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
      override fun onPageSelected(position: Int) {
        if (suppressPageCallback) return
        val tab = snapshot?.tabs?.getOrNull(position) ?: return
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
          onVisibleTabChange?.invoke(tab.id)
        }
      }
    })
  }

  fun submitSnapshot(json: String) {
    parser.execute {
      if (disposed.get()) return@execute
      try {
        val next = HomeContainerJson.parseSnapshot(json)
        if (next.schemaVersion != SCHEMA_VERSION) {
          reportError(
            "unsupported_schema",
            "HomeContainer schema ${next.schemaVersion} is not supported",
          )
          return@execute
        }
        post { applySnapshot(next) }
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
    post { moveToTab(tabId, animated, true) }
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
    tabsView.setMountedSlotKeys(keys)
    adapter.pages().forEach { it.setMountedSlotKeys(keys) }
    updateSharedChromeLayout()
    requestLayout()
    onSlotLayoutChange?.invoke()
  }

  fun slotFrame(key: String): Rect? {
    val statePrefix = "content.state."
    val contentHeaderPrefix = "content.header."
    val footerPrefix = "content.footer.$selectedTabId."
    val target = when {
      key == "content.body" && isBodySlotMounted -> bodySlotTarget
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
    post {
      val color = parseHomeContainerColor(value, Color.WHITE)
      setBackgroundColor(color)
      bodySlotTarget.setBackgroundColor(color)
    }
  }

  fun setDebugOverlayEnabled(enabled: Boolean) {
    post {
      background = if (enabled) {
        GradientDrawable().apply {
          color = android.content.res.ColorStateList.valueOf(
            snapshot?.theme?.backgroundColor?.let { parseHomeContainerColor(it, Color.WHITE) }
              ?: Color.WHITE,
          )
          setStroke(dp(1), Color.MAGENTA)
        }
      } else {
        null
      }
      if (!enabled) {
        setBackgroundColor(
          snapshot?.theme?.backgroundColor?.let { parseHomeContainerColor(it, Color.WHITE) }
            ?: Color.WHITE,
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
      refreshPages.clear()
    }
  }

  private fun applySnapshot(next: HomeContainerSnapshot) {
    if (disposed.get()) return
    val current = snapshot
    if (current != null && next.revision < current.revision) return
    snapshot = next
    val backgroundColor = parseHomeContainerColor(next.theme.backgroundColor, Color.WHITE)
    setBackgroundColor(backgroundColor)
    bodySlotTarget.setBackgroundColor(backgroundColor)
    headerView.bind(next.header, next.theme)
    headerHeight = headerView.preferredHeight
    tabsView.bind(next.tabs, next.selectedTabId, next.theme)
    updateSharedChromeLayout()
    adapter.bind(next)
    pager.offscreenPageLimit = next.tabs.size.coerceAtLeast(1)
    val requestedTab = next.tabs.firstOrNull { it.id == next.selectedTabId }
      ?: next.tabs.firstOrNull()
    if (requestedTab != null) {
      selectedTabId = requestedTab.id
      adapter.setSelectedTab(requestedTab.id)
      tabsView.setSelectedTab(requestedTab.id)
      val index = next.tabs.indexOfFirst { it.id == requestedTab.id }
      if (index >= 0 && pager.currentItem != index) {
        suppressPageCallback = true
        pager.setCurrentItem(index, false)
        suppressPageCallback = false
      }
    }
  }

  private fun applyPatch(patch: HomeContainerPatch) {
    val current = snapshot ?: return
    if (patch.revision < current.revision) return
    val validTabIds = current.tabs.mapTo(mutableSetOf()) { it.id }
    if (patch.tabs.any { it.tabId !in validTabIds }) return
    val next = current.applying(patch)
    snapshot = next
    patch.header?.let { header ->
      val previousHeaderHeight = headerHeight
      headerView.bind(header, next.theme)
      headerHeight = headerView.preferredHeight
      if (previousHeaderHeight != headerHeight) {
        adapter.updateTopSpacerHeight(headerHeight + dp(TAB_HEIGHT_DP))
      }
      updateSharedChromeLayout()
    }
    adapter.applyPatch(next, patch)
  }

  private fun moveToTab(tabId: String, animated: Boolean, notify: Boolean) {
    val tabs = snapshot?.tabs ?: return
    val index = tabs.indexOfFirst { it.id == tabId }
    if (index < 0) return
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
    pager.setCurrentItem(index, animated)
    if (notify) onVisibleTabChange?.invoke(tabId)
  }

  private fun reportError(code: String, message: String) {
    post { onRenderError?.invoke(code, message) }
  }

  private inner class HomePagerAdapter : RecyclerView.Adapter<HomePageHolder>() {
    private var value: HomeContainerSnapshot? = null
    private val pages = mutableMapOf<String, HomePageView>()
    private var selectedId = ""
    private var refreshEnabled = false

    init {
      setHasStableIds(true)
    }

    fun bind(next: HomeContainerSnapshot) {
      val previous = value
      val previousTabs = previous?.tabs.orEmpty()
      val nextTabs = next.tabs
      val diff = if (previous == null) {
        null
      } else {
        DiffUtil.calculateDiff(object : DiffUtil.Callback() {
          override fun getOldListSize(): Int = previousTabs.size

          override fun getNewListSize(): Int = nextTabs.size

          override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
            previousTabs[oldItemPosition].id == nextTabs[newItemPosition].id

          override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean =
            previousTabs[oldItemPosition].id == nextTabs[newItemPosition].id
        })
      }
      value = next
      val validIds = next.tabs.mapTo(mutableSetOf()) { it.id }
      pages.keys.retainAll(validIds)
      if (previous == null) {
        if (nextTabs.isNotEmpty()) notifyItemRangeInserted(0, nextTabs.size)
      } else {
        diff?.dispatchUpdatesTo(this)
      }
      pages.forEach { (tabId, page) ->
        val tab = next.tabs.firstOrNull { it.id == tabId } ?: return@forEach
        bindPage(page, tab, next)
      }
    }

    fun applyPatch(next: HomeContainerSnapshot, patch: HomeContainerPatch) {
      value = next
      patch.tabs.forEach { tabPatch ->
        pages[tabPatch.tabId]?.updateSections(tabPatch.sections, next.theme)
      }
    }

    fun setSelectedTab(tabId: String) {
      selectedId = tabId
    }

    fun updateTopSpacerHeight(height: Int) {
      pages.values.forEach { it.updateTopSpacerHeight(height) }
    }

    fun setRefreshEnabled(enabled: Boolean) {
      refreshEnabled = enabled
      pages.values.forEach { it.setRefreshEnabled(enabled) }
    }

    fun pageForTab(tabId: String): HomePageView? = pages[tabId]

    fun pages(): Collection<HomePageView> = pages.values

    override fun getItemId(position: Int): Long =
      value?.tabs?.getOrNull(position)?.id?.hashCode()?.toLong() ?: RecyclerView.NO_ID

    override fun getItemCount(): Int = value?.tabs?.size ?: 0

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
      val tab = next.tabs[position]
      pages[tab.id] = holder.page
      bindPage(holder.page, tab, next)
    }

    override fun onViewRecycled(holder: HomePageHolder) {
      pages.entries.removeAll { it.value === holder.page }
      super.onViewRecycled(holder)
    }

    private fun bindPage(
      page: HomePageView,
      tab: HomeContainerTab,
      next: HomeContainerSnapshot,
    ) {
      page.onSlotLayoutChange = { this@HomeContainerView.onSlotLayoutChange?.invoke() }
      page.bind(tab, next.theme, headerHeight + dp(TAB_HEIGHT_DP))
      page.setRefreshEnabled(refreshEnabled)
      page.setMountedSlotKeys(mountedSlotKeys)
      page.onAction = { actionId, itemId, tabId ->
        this@HomeContainerView.onAction?.invoke(actionId, itemId, tabId)
      }
      page.onRefresh = { sourcePage, tabId ->
        val requestId = UUID.randomUUID().toString()
        refreshPages[requestId] = sourcePage
        this@HomeContainerView.onRefresh?.invoke(tabId, requestId)
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
    }
  }

  private class HomePageHolder(val page: HomePageView) : RecyclerView.ViewHolder(page)

  private fun updateSharedChromeLayout() {
    (headerView.layoutParams as LayoutParams).apply {
      height = headerHeight
      headerView.layoutParams = this
    }
    (tabsView.layoutParams as LayoutParams).apply {
      height = if (isBodySlotMounted) 0 else dp(TAB_HEIGHT_DP)
      topMargin = headerHeight
      tabsView.layoutParams = this
    }
    pager.visibility = if (isBodySlotMounted) GONE else VISIBLE
    tabsView.visibility = if (isBodySlotMounted) GONE else VISIBLE
    bodySlotTarget.visibility = if (isBodySlotMounted) VISIBLE else GONE
    if (isBodySlotMounted) {
      collapseOffset = 0
      refreshPullOffset = 0
    }
    updateSharedChromePosition()
  }

  private fun updateSharedChromePosition() {
    if (isBodySlotMounted) {
      headerView.translationY = 0f
      tabsView.translationY = 0f
      onSlotLayoutChange?.invoke()
      return
    }
    val boundedOffset = collapseOffset.coerceIn(0, headerHeight)
    headerView.translationY = (-boundedOffset + refreshPullOffset).toFloat()
    tabsView.translationY = (-boundedOffset + refreshPullOffset).toFloat()
    onSlotLayoutChange?.invoke()
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    if (isBodySlotMounted) {
      bodySlotTarget.layout(0, headerHeight, width, height)
    }
    onSlotLayoutChange?.invoke()
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  companion object {
    private const val SCHEMA_VERSION = 1
    private const val TAB_HEIGHT_DP = 52
  }
}

private class HomePageView(context: Context) : FrameLayout(context) {
  var onAction: ((String, String, String) -> Unit)? = null
  var onRefresh: ((HomePageView, String) -> Unit)? = null
  var onCollapseOffsetChange: ((HomePageView, Int) -> Unit)? = null
  var onRefreshPullOffsetChange: ((HomePageView, Int) -> Unit)? = null
  var onSlotLayoutChange: (() -> Unit)? = null

  var tabId: String = ""
    private set

  private val refreshLayout = SwipeRefreshLayout(context)
  private val recycler = RecyclerView(context)
  private val listAdapter = HomeListAdapter()
  private var topSpacerHeight = 0
  private var suppressCollapseCallback = false
  private var lastRefreshPullOffset = 0

  val collapseOffset: Int
    get() {
      val headerHeight = (topSpacerHeight - dp(TAB_HEIGHT_DP)).coerceAtLeast(0)
      return min(currentScrollOffset(), headerHeight)
    }

  val refreshPullOffset: Int
    get() = recycler.top.coerceAtLeast(0)

  init {
    recycler.layoutManager = LinearLayoutManager(context)
    recycler.adapter = listAdapter
    recycler.itemAnimator = null
    recycler.overScrollMode = View.OVER_SCROLL_ALWAYS
    recycler.setPadding(0, 0, 0, dp(112))
    recycler.clipToPadding = false
    refreshLayout.addView(
      recycler,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    addView(refreshLayout, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

    refreshLayout.setOnRefreshListener {
      onRefresh?.invoke(this, tabId)
    }
    refreshLayout.viewTreeObserver.addOnPreDrawListener {
      val nextOffset = refreshPullOffset
      if (nextOffset != lastRefreshPullOffset) {
        lastRefreshPullOffset = nextOffset
        onRefreshPullOffsetChange?.invoke(this, nextOffset)
        onSlotLayoutChange?.invoke()
      }
      true
    }
    listAdapter.onAction = { actionId, itemId ->
      onAction?.invoke(actionId, itemId, tabId)
    }
    listAdapter.onListCommitted = { onSlotLayoutChange?.invoke() }
    recycler.addOnScrollListener(object : RecyclerView.OnScrollListener() {
      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        if (!suppressCollapseCallback) {
          onCollapseOffsetChange?.invoke(this@HomePageView, collapseOffset)
        }
      }
    })
  }

  fun bind(
    tab: HomeContainerTab,
    theme: HomeContainerTheme,
    topSpacerHeight: Int,
  ) {
    tabId = tab.id
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    this.topSpacerHeight = topSpacerHeight
    listAdapter.bind(tab.id, tab.sections, theme, topSpacerHeight)
  }

  fun updateSections(sections: List<HomeContainerSection>, theme: HomeContainerTheme) {
    listAdapter.updateSections(sections, theme)
  }

  fun updateTopSpacerHeight(height: Int) {
    topSpacerHeight = height
    listAdapter.updateTopSpacerHeight(height)
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
    refreshLayout.isEnabled = enabled
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
  val item: HomeContainerItem? = null,
  val horizontalItems: List<HomeContainerItem> = emptyList(),
  val slotKey: String = "",
)

private class HomeListAdapter : ListAdapter<HomeListRow, RecyclerView.ViewHolder>(RowDiffCallback()) {
  var onAction: ((String, String) -> Unit)? = null
  var onListCommitted: (() -> Unit)? = null
  private var theme = HomeContainerTheme("#FFFFFF", "#F5F5F5", "#EEEEEE", "#111111", "#777777", "#3574F0", "#1F9D67", "#D64545")
  private var sections: List<HomeContainerSection> = emptyList()
  private var tabId = ""
  private var topSpacerHeight = 0
  private var mountedSlotKeys = emptySet<String>()

  init {
    setHasStableIds(true)
  }

  fun bind(
    tabId: String,
    sections: List<HomeContainerSection>,
    theme: HomeContainerTheme,
    topSpacerHeight: Int,
  ) {
    this.tabId = tabId
    this.theme = theme
    this.sections = sections
    this.topSpacerHeight = topSpacerHeight
    submitList(buildRows()) { onListCommitted?.invoke() }
  }

  fun setMountedSlotKeys(keys: Set<String>) {
    if (mountedSlotKeys == keys) return
    mountedSlotKeys = keys
    submitList(buildRows()) { onListCommitted?.invoke() }
  }

  fun updateTopSpacerHeight(height: Int) {
    if (topSpacerHeight == height) return
    topSpacerHeight = height
    submitList(buildRows()) { onListCommitted?.invoke() }
  }

  fun updateSections(sections: List<HomeContainerSection>, theme: HomeContainerTheme) {
    val themeChanged = this.theme != theme
    this.theme = theme
    this.sections = sections
    submitList(buildRows()) {
      if (themeChanged && itemCount > 0) {
        notifyItemRangeChanged(0, itemCount, PAYLOAD_THEME)
      }
      onListCommitted?.invoke()
    }
  }

  fun statePosition(): Int {
    val position = currentList.indexOfFirst { row ->
      row.item?.renderer == "empty" || row.item?.renderer == "loading"
    }
    return if (position >= 0) position else RecyclerView.NO_POSITION
  }

  fun contentHeaderPosition(): Int {
    val position = currentList.indexOfFirst { it.kind == VIEW_CONTENT_HEADER }
    return if (position >= 0) position else RecyclerView.NO_POSITION
  }

  fun footerSlotPosition(key: String): Int {
    val position = currentList.indexOfFirst { row ->
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
              "section:${section.title}:${section.actionTitle}:${section.actionId}",
              title = section.title,
              actionTitle = section.actionTitle,
              actionId = section.actionId,
            ),
          )
        }
        if (section.layout == "grid") {
          section.items.chunked(2).forEachIndexed { rowIndex, items ->
            add(
              HomeListRow(
                VIEW_GRID,
                "grid:${section.id}:$rowIndex",
                items.joinToString("|") { item ->
                  listOf(
                    item.id,
                    item.title,
                    item.subtitle,
                    item.subtitleDetail,
                    item.value,
                    item.imageUrl,
                    item.secondaryImageUrl,
                    item.badgeImageUrl,
                  ).joinToString(":")
                },
                horizontalItems = items,
              ),
            )
          }
        } else if (section.layout == "horizontal") {
          add(
            HomeListRow(
              VIEW_HORIZONTAL,
              "horizontal:${section.id}",
              section.items.joinToString("|") { item ->
                listOf(
                  item.id,
                  item.renderer,
                  item.title,
                  item.subtitle,
                  item.value,
                  item.imageUrl,
                ).joinToString(":")
              },
              horizontalItems = section.items,
            ),
          )
        } else {
          section.items.forEach { item ->
            add(
              HomeListRow(
                VIEW_ITEM,
                "item:${section.id}:${item.id}",
                listOf(
                  item.renderer,
                  item.title,
                  item.subtitle,
                  item.subtitleDetail,
                  item.subtitleDetailColor,
                  item.value,
                  item.detail,
                  item.imageUrl,
                  item.secondaryImageUrl,
                  item.badge,
                  item.badgeImageUrl,
                  item.accentColor,
                  item.buttonTitle,
                  item.leadingIcon,
                  item.showChevron,
                  item.actionId,
                  item.displayHeight,
                ).joinToString("|"),
                item = item,
              ),
            )
          }
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

  override fun getItemId(position: Int): Long = getItem(position).stableId.hashCode().toLong()

  override fun getItemViewType(position: Int): Int = getItem(position).kind

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder =
    when (viewType) {
      VIEW_SECTION -> SectionHolder(HomeSectionTitleView(parent.context))
      VIEW_ITEM -> ItemHolder(HomeItemView(parent.context))
      VIEW_GRID -> GridHolder(HomeNftGridRowView(parent.context))
      VIEW_HORIZONTAL -> HorizontalHolder(HomeHorizontalView(parent.context))
      else -> SpacerHolder(View(parent.context))
    }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    val row = getItem(position)
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
    else -> 0
  }

  private class SpacerHolder(view: View) : RecyclerView.ViewHolder(view)
  private class SectionHolder(val view: HomeSectionTitleView) : RecyclerView.ViewHolder(view)
  private class ItemHolder(val view: HomeItemView) : RecyclerView.ViewHolder(view)
  private class GridHolder(val view: HomeNftGridRowView) : RecyclerView.ViewHolder(view)
  private class HorizontalHolder(val view: HomeHorizontalView) : RecyclerView.ViewHolder(view)

  companion object {
    private const val VIEW_SPACER = 0
    private const val VIEW_CONTENT_HEADER = 1
    private const val VIEW_SECTION = 2
    private const val VIEW_ITEM = 3
    private const val VIEW_HORIZONTAL = 4
    private const val VIEW_GRID = 5
    private const val VIEW_FOOTER_SLOT = 6
    private const val PAYLOAD_THEME = "theme"
    private val FOOTER_SLOT_IDS = listOf("upgrade", "support")
  }

  private class RowDiffCallback : DiffUtil.ItemCallback<HomeListRow>() {
    override fun areItemsTheSame(oldItem: HomeListRow, newItem: HomeListRow): Boolean =
      oldItem.stableId == newItem.stableId

    override fun areContentsTheSame(oldItem: HomeListRow, newItem: HomeListRow): Boolean =
      oldItem.contentKey == newItem.contentKey
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
  private val balanceButton = text("", 48f, Typeface.NORMAL, "#111111")
  private val balanceActionsContent = LinearLayout(context)
  private val actionsScroll = AxisLockHorizontalScrollView(context)
  private val actionsContent = LinearLayout(context)
  private val bannersScroll = AxisLockHorizontalScrollView(context)
  private val bannersContent = LinearLayout(context)
  private val actionViews = mutableMapOf<String, HomeActionView>()
  private val balanceActionViews = mutableMapOf<String, TextView>()
  private val bannerViews = mutableMapOf<String, HomeBannerView>()
  private var bannersContentWidth = 0
  private var accountImageRequest: HomeContainerImageLoader.Request? = null
  private var networkImageRequest: HomeContainerImageLoader.Request? = null
  private var networkSecondaryImageRequest: HomeContainerImageLoader.Request? = null
  private var representedAccountImageUrl: String? = null
  private var representedNetworkImageUrl: String? = null
  private var representedNetworkSecondaryImageUrl: String? = null
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
    addView(balanceButton, row(64))
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
    actionsScroll.visibility = if (header.actions.isEmpty()) GONE else VISIBLE
    bannersScroll.visibility = if (header.banners.isEmpty()) GONE else VISIBLE
    preferredHeight = dp(
      (if (header.banners.isEmpty()) 216 else 310) +
        (if (header.balanceActions.isEmpty()) 0 else 38),
    )
  }

  fun slotTarget(key: String): View? = when (key) {
    "header.account-row" -> accountRow
    "header.balance" -> balanceButton
    "header.action-row" -> actionsScroll
    else -> null
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
  }

  private fun updateBanners(banners: List<HomeContainerBanner>, theme: HomeContainerTheme) {
    if (banners.map { it.id } != bannerViews.keys.toList()) {
      bannersContent.removeAllViews()
      bannerViews.clear()
      banners.forEach { banner ->
        val view = HomeBannerView(context).apply {
          this.onAction = { actionId -> this@HomeHeaderView.onAction?.invoke(actionId, banner.id) }
        }
        bannerViews[banner.id] = view
        bannersContent.addView(view, LinearLayout.LayoutParams(dp(246), dp(84)).apply {
          marginEnd = dp(10)
        })
      }
    }
    banners.forEach { banner ->
      bannerViews[banner.id]?.bind(banner, theme)
    }
    bannersContentWidth = banners.size * (dp(246) + dp(10))
    bannersContent.layoutParams = bannersContent.layoutParams.apply {
      width = bannersContentWidth
      height = dp(84)
    }
    bannersContent.requestLayout()
    bannersContent.post {
      if (bannersContentWidth <= 0) return@post
      bannersContent.measure(
        MeasureSpec.makeMeasureSpec(bannersContentWidth, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(dp(84), MeasureSpec.EXACTLY),
      )
      bannersContent.layout(0, 0, bannersContentWidth, dp(84))
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
    val labels = LinearLayout(context).apply {
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
    loadImage(value.imageUrl)
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

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
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
    this.theme = theme
    this.selectedTabId = selectedTabId
    tabsById = tabs.associateBy { it.id }
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
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

private class HomeSectionTitleView(context: Context) : LinearLayout(context) {
  private val title = TextView(context)
  private val action = TextView(context)

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    setPadding(dp(16), 0, dp(16), 0)
    title.setTypeface(title.typeface, Typeface.BOLD)
    addView(title, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    action.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
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
    val chevron = if (layoutDirection == LAYOUT_DIRECTION_RTL) "‹" else "›"
    action.text = if (row.actionTitle.isEmpty()) "" else "${row.actionTitle}  $chevron"
    action.visibility = if (row.actionTitle.isEmpty()) GONE else VISIBLE
    action.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    action.setOnClickListener {
      row.actionId.takeIf { it.isNotEmpty() }?.let(onAction)
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
  private val centerButton = TextView(context)
  private val left = LinearLayout(context)
  private val right = LinearLayout(context)
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
      addView(LinearLayout(context).apply {
        orientation = HORIZONTAL
        addView(subtitle)
        subtitleDetail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        addView(subtitleDetail, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
          marginStart = dp(4)
        })
      }, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
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
      addView(value)
      addView(detail, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(3)
      })
    }
    addView(right, LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
    chevron.text = "›"
    chevron.gravity = Gravity.CENTER
    chevron.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
    addView(chevron, LinearLayout.LayoutParams(dp(20), LayoutParams.MATCH_PARENT))
    centerButton.gravity = Gravity.CENTER
    centerButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
    addView(centerButton, LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, dp(68))
  }

  fun bind(item: HomeContainerItem, theme: HomeContainerTheme) {
    alpha = if (item.renderer == "empty" || item.renderer == "loading") 0f else 1f
    setBackgroundColor(parseHomeContainerColor(theme.backgroundColor, Color.WHITE))
    icon.text = when (item.leadingIcon) {
      "star" -> "★"
      "support" -> "◉"
      "book" -> "▣"
      "download" -> "↓"
      "prime" -> "1"
      else -> item.title.take(1).uppercase()
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
    iconContainer.clipToOutline = true
    loadImage(item.imageUrl)
    loadAuxiliaryImage(item.secondaryImageUrl, secondaryIconImage, true)
    loadAuxiliaryImage(item.badgeImageUrl, badgeImage, false)
    title.text = item.title
    title.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
    subtitle.text = item.subtitle
    subtitle.visibility = if (item.subtitle.isEmpty()) GONE else VISIBLE
    subtitle.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    subtitleDetail.text = item.subtitleDetail
    subtitleDetail.visibility = if (item.subtitleDetail.isEmpty()) GONE else VISIBLE
    subtitleDetail.setTextColor(
      parseHomeContainerColor(item.subtitleDetailColor.ifEmpty { theme.secondaryTextColor }, Color.DKGRAY),
    )
    value.text = item.value
    value.visibility = if (item.value.isEmpty()) GONE else VISIBLE
    value.setTextColor(
      parseHomeContainerColor(
        if (item.renderer == "market") theme.primaryTextColor
        else item.accentColor.ifEmpty { theme.primaryTextColor },
        Color.BLACK,
      ),
    )
    detail.text = item.detail
    detail.visibility = if (item.detail.isEmpty()) GONE else VISIBLE
    detail.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
    if (item.renderer == "market") {
      detail.setTextColor(
        parseHomeContainerColor(item.accentColor.ifEmpty { theme.secondaryTextColor }, Color.DKGRAY),
      )
    }
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
    chevron.visibility = if (item.showChevron) VISIBLE else GONE
    val isCentered = item.renderer == "showMore" || item.renderer == "marketTabs"
    iconContainer.visibility = if (isCentered) GONE else VISIBLE
    left.visibility = if (isCentered) GONE else VISIBLE
    right.visibility = if (isCentered) GONE else VISIBLE
    chevron.visibility = if (!isCentered && item.showChevron) VISIBLE else GONE
    centerButton.visibility = if (isCentered) VISIBLE else GONE
    if (item.renderer == "showMore") {
      val centerChevron = if (layoutDirection == LAYOUT_DIRECTION_RTL) "‹" else "›"
      centerButton.gravity = Gravity.CENTER
      centerButton.text = if (item.showChevron) "${item.title}  $centerChevron" else item.title
      centerButton.setTextColor(parseHomeContainerColor(theme.primaryTextColor, Color.BLACK))
      centerButton.background = GradientDrawable().apply {
        setColor(parseHomeContainerColor(theme.cardColor, Color.LTGRAY))
        cornerRadius = dp(18).toFloat()
      }
    } else if (item.renderer == "marketTabs") {
      centerButton.gravity = Gravity.CENTER_VERTICAL or Gravity.START
      centerButton.text = "☆    ${item.title}      ${item.subtitle}"
      centerButton.setTextColor(parseHomeContainerColor(theme.secondaryTextColor, Color.DKGRAY))
      centerButton.background = null
    }
    val usesCard = item.renderer == "supportAction" || item.renderer == "upgrade"
    drawsDivider = !isCentered && !usesCard
    dividerPaint.color = parseHomeContainerColor(theme.dividerColor, Color.GRAY)
    dividerPaint.strokeWidth = (resources.displayMetrics.density * 0.5f).coerceAtLeast(1f)
    layoutParams = RecyclerView.LayoutParams(
      LayoutParams.MATCH_PARENT,
      dp(
        when (item.renderer) {
          "nft" -> 92
          "history" -> 60
          "defi", "market" -> 64
          "earn", "marketTabs", "showMore" -> 56
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
  }

  private fun loadImage(value: String) {
    if (representedImageUrl == value) return
    imageRequest?.cancel()
    imageRequest = null
    representedImageUrl = value
    iconImage.setImageDrawable(null)
    iconImage.visibility = GONE
    icon.visibility = VISIBLE
    if (value.isEmpty()) return
    imageRequest = HomeContainerImageLoader.load(context, value) { bitmap ->
      if (representedImageUrl != value) return@load
      if (bitmap != null) {
        iconImage.setImageBitmap(bitmap)
        iconImage.visibility = VISIBLE
        icon.visibility = GONE
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
    target.visibility = GONE
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
