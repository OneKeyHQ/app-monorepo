package so.onekey.components.nativehometabs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.LruCache
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.facebook.react.R as ReactR
import com.facebook.react.uimanager.PixelUtil
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max

private const val ROW_TYPE_TEXT = 1
private const val ROW_TYPE_SLOT = 2
private const val ROW_TYPE_TOKEN = 3

private data class OKHomeRow(
  val key: String,
  val type: String,
  val title: String,
  val subtitle: String?,
  val slotId: String?,
  val iconUri: String?,
  val value: String?,
  val status: String?,
  val tokenSymbol: String?,
  val tokenName: String?,
  val tokenBalance: String?,
  val tokenFiatValue: String?,
  val tokenPrice: String?,
  val tokenChange24h: String?,
  val tokenChange24hColor: String?,
  val tokenNetworkName: String?,
  val estimatedHeightPx: Int,
  val raw: String,
)

private data class OKHomeTab(
  val key: String,
  val title: String,
  val enabled: Boolean,
)

class OKNativeHomeTabsView(context: Context) : FrameLayout(context) {
  private val refreshLayout = SwipeRefreshLayout(context)
  private val recyclerView = RecyclerView(context)
  private val headerHolder = FrameLayout(context)
  private val tabBar = LinearLayout(context)
  private val layoutManager = LinearLayoutManager(context)
  private val reactChildren = mutableListOf<View>()
  private val slotViews = mutableMapOf<String, View>()
  private val activeSlotContainers = mutableMapOf<String, FrameLayout>()
  private val rowsAdapter = OKHomeRowsAdapter(
    onPress = { row ->
      onRowPress?.invoke(activeTabKey, row.key, row.type)
    },
    onBindSlot = { slotId, container ->
      activeSlotContainers[slotId] = container
      attachSlotView(slotId, container)
    },
    onRecycleSlot = { container ->
      detachSlotContainer(container)
    },
  )
  private val swipeDetector = GestureDetector(
    context,
    object : GestureDetector.SimpleOnGestureListener() {
      override fun onDown(event: MotionEvent): Boolean = enableHorizontalSwipe

      override fun onFling(
        downEvent: MotionEvent?,
        moveEvent: MotionEvent,
        velocityX: Float,
        velocityY: Float,
      ): Boolean {
        val startEvent = downEvent ?: return false
        if (!enableHorizontalSwipe || abs(velocityX) < abs(velocityY)) {
          return false
        }
        val distanceX = moveEvent.x - startEvent.x
        if (abs(distanceX) < PixelUtil.toPixelFromDIP(56.0)) {
          return false
        }
        val direction = if (distanceX < 0) 1 else -1
        switchToAdjacentTab(direction)
        return true
      }
    },
  )

  private var schema: JSONObject? = null
  private var tabs: List<OKHomeTab> = emptyList()
  private var activeTabKey = "portfolio"
  private var activeRows: List<OKHomeRow> = emptyList()
  private var bottomInsetPx = 0
  private var topInsetPx = 0
  private var initialHeaderHeightPx = PixelUtil.toPixelFromDIP(312.0).toInt()
  private var lastEndReachedItemCount = -1
  private var lastVisibleRowsJson = ""
  private var enableHorizontalSwipe = false

  var onTabChange: ((tabKey: String, source: String) -> Unit)? = null
  var onRefresh: ((tabKey: String) -> Unit)? = null
  var onEndReached: ((tabKey: String, itemCount: Int) -> Unit)? = null
  var onRowPress: ((tabKey: String, rowKey: String, rowType: String) -> Unit)? =
    null
  var onRowAction: ((
    tabKey: String,
    rowKey: String,
    rowType: String,
    action: String,
  ) -> Unit)? = null
  var onVisibleRowsChange: ((tabKey: String, rowKeysJson: String) -> Unit)? =
    null
  var onNativeError: ((code: String, message: String) -> Unit)? = null

  init {
    id = View.generateViewId()
    setBackgroundColor(Color.WHITE)
    clipChildren = false

    recyclerView.layoutManager = layoutManager
    recyclerView.adapter = rowsAdapter
    recyclerView.clipToPadding = false
    recyclerView.itemAnimator = null
    recyclerView.overScrollMode = OVER_SCROLL_IF_CONTENT_SCROLLS
    recyclerView.addOnScrollListener(
      object : RecyclerView.OnScrollListener() {
        override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
          syncOverlayTranslation()
          maybeEmitEndReached()
          maybeEmitVisibleRows()
        }
      },
    )
    recyclerView.setOnTouchListener { _, event ->
      if (enableHorizontalSwipe) {
        swipeDetector.onTouchEvent(event)
      }
      false
    }

    refreshLayout.addView(
      recyclerView,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    refreshLayout.setOnRefreshListener {
      onRefresh?.invoke(activeTabKey)
    }

    headerHolder.setBackgroundColor(Color.WHITE)
    headerHolder.clipChildren = false

    tabBar.orientation = LinearLayout.HORIZONTAL
    tabBar.gravity = Gravity.CENTER_VERTICAL
    tabBar.setBackgroundColor(Color.WHITE)
    tabBar.setPadding(
      PixelUtil.toPixelFromDIP(16.0).toInt(),
      PixelUtil.toPixelFromDIP(8.0).toInt(),
      PixelUtil.toPixelFromDIP(16.0).toInt(),
      PixelUtil.toPixelFromDIP(8.0).toInt(),
    )

    super.addView(
      refreshLayout,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    super.addView(
      headerHolder,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )
    super.addView(
      tabBar,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )
  }

  fun addReactChild(child: View, index: Int) {
    reactChildren.add(index.coerceIn(0, reactChildren.size), child)
    attachReactChild(child)
    requestLayout()
  }

  fun removeReactChild(child: View) {
    reactChildren.remove(child)
    val nativeId = getNativeId(child)
    if (nativeId?.startsWith(SLOT_NATIVE_ID_PREFIX) == true) {
      val slotId = nativeId.removePrefix(SLOT_NATIVE_ID_PREFIX)
      slotViews.remove(slotId)
      activeSlotContainers[slotId]?.removeView(child)
    }
    (child.parent as? ViewGroup)?.removeView(child)
    requestLayout()
  }

  fun getReactChildCount(): Int = reactChildren.size

  fun getReactChildAt(index: Int): View? = reactChildren.getOrNull(index)

  fun removeReactChildAt(index: Int) {
    reactChildren.getOrNull(index)?.let { removeReactChild(it) }
  }

  fun setSchemaJson(schemaJson: String?) {
    if (schemaJson.isNullOrBlank()) {
      return
    }
    try {
      val shouldPreserveActiveTab = schema != null
      schema = JSONObject(schemaJson)
      tabs = parseTabs(schema?.optJSONArray("tabs") ?: JSONArray())
      activeTabKey = resolveSchemaActiveTabKey(
        schema?.optString("activeTabKey", activeTabKey),
        shouldPreserveActiveTab,
      )
      rebuildTabs()
      submitActiveRows()
      syncRefreshingState()
    } catch (error: Exception) {
      onNativeError?.invoke(
        "schema_parse_error",
        error.message ?: "Invalid NativeHomeTabs schema",
      )
    }
  }

  fun setTopInset(value: Double) {
    topInsetPx = PixelUtil.toPixelFromDIP(value).toInt()
    requestLayout()
  }

  fun setBottomInset(value: Double) {
    bottomInsetPx = PixelUtil.toPixelFromDIP(value).toInt()
    requestLayout()
  }

  fun setInitialHeaderHeight(value: Double) {
    initialHeaderHeightPx = PixelUtil.toPixelFromDIP(value).toInt()
    requestLayout()
  }

  fun setEnableHorizontalSwipe(value: Boolean) {
    enableHorizontalSwipe = value
  }

  fun scrollToTop(
    @Suppress("UNUSED_PARAMETER") tabKey: String,
    animated: Boolean,
  ) {
    if (animated) {
      recyclerView.smoothScrollToPosition(0)
    } else {
      recyclerView.scrollToPosition(0)
    }
  }

  fun switchTab(tabKey: String, @Suppress("UNUSED_PARAMETER") animated: Boolean) {
    setActiveTab(tabKey, "programmatic")
  }

  fun applyPatch(patchJson: String?) {
    if (patchJson.isNullOrBlank()) {
      return
    }
    try {
      val currentSchema = schema ?: JSONObject()
      schema = mergeJson(currentSchema, JSONObject(patchJson))
      tabs = parseTabs(schema?.optJSONArray("tabs") ?: JSONArray())
      activeTabKey = resolveSchemaActiveTabKey(
        schema?.optString("activeTabKey", activeTabKey),
        preserveCurrent = true,
      )
      rebuildTabs()
      submitActiveRows()
      syncRefreshingState()
    } catch (error: Exception) {
      onNativeError?.invoke(
        "patch_parse_error",
        error.message ?: "Invalid NativeHomeTabs patch",
      )
    }
  }

  fun endRefreshing(@Suppress("UNUSED_PARAMETER") tabKey: String) {
    refreshLayout.isRefreshing = false
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = MeasureSpec.getSize(heightMeasureSpec)
    val childWidthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
    val wrapHeightSpec = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)

    refreshLayout.measure(widthMeasureSpec, heightMeasureSpec)
    headerHolder.measure(childWidthSpec, wrapHeightSpec)
    tabBar.measure(childWidthSpec, wrapHeightSpec)

    setMeasuredDimension(width, height)
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    val width = right - left
    val height = bottom - top
    val headerHeight = currentHeaderHeight()
    val tabHeight = tabBar.measuredHeight

    refreshLayout.layout(0, 0, width, height)
    headerHolder.layout(0, topInsetPx, width, topInsetPx + headerHeight)
    tabBar.layout(
      0,
      topInsetPx + headerHeight,
      width,
      topInsetPx + headerHeight + tabHeight,
    )

    syncRecyclerPadding()
    syncOverlayTranslation()
  }

  private fun attachReactChild(child: View) {
    val nativeId = getNativeId(child)
    when {
      nativeId == HEADER_NATIVE_ID || nativeId.isNullOrBlank() -> {
        attachToParent(child, headerHolder)
      }
      nativeId.startsWith(SLOT_NATIVE_ID_PREFIX) -> {
        val slotId = nativeId.removePrefix(SLOT_NATIVE_ID_PREFIX)
        slotViews[slotId] = child
        activeSlotContainers[slotId]?.let { attachSlotView(slotId, it) }
      }
      else -> {
        attachToParent(child, headerHolder)
      }
    }
  }

  private fun attachToParent(child: View, parent: ViewGroup) {
    (child.parent as? ViewGroup)?.removeView(child)
    parent.addView(
      child,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )
  }

  private fun attachSlotView(slotId: String, container: FrameLayout) {
    val slotView = slotViews[slotId] ?: return
    (slotView.parent as? ViewGroup)?.removeView(slotView)
    container.removeAllViews()
    container.addView(
      slotView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      ),
    )
  }

  private fun detachSlotContainer(container: FrameLayout) {
    val slotId = activeSlotContainers.entries
      .firstOrNull { it.value == container }
      ?.key
    if (slotId != null) {
      activeSlotContainers.remove(slotId)
    }
    container.removeAllViews()
  }

  private fun getNativeId(child: View): String? =
    child.getTag(ReactR.id.view_tag_native_id) as? String

  private fun parseTabs(array: JSONArray): List<OKHomeTab> {
    val result = mutableListOf<OKHomeTab>()
    for (index in 0 until array.length()) {
      val item = array.optJSONObject(index) ?: continue
      result.add(
        OKHomeTab(
          key = item.optString("key"),
          title = item.optString("title", item.optString("key")),
          enabled = item.optBoolean("enabled", true),
        ),
      )
    }
    return result
  }

  private fun rebuildTabs() {
    tabBar.removeAllViews()
    tabs.filter { it.enabled }.forEach { tab ->
      val button = TextView(context)
      val selected = tab.key == activeTabKey
      button.text = tab.title
      button.textSize = 16f
      button.typeface = Typeface.DEFAULT_BOLD.takeIf { selected } ?: Typeface.DEFAULT
      button.gravity = Gravity.CENTER
      button.setTextColor(if (selected) Color.WHITE else Color.rgb(32, 32, 32))
      button.setBackgroundColor(if (selected) Color.rgb(32, 32, 32) else Color.TRANSPARENT)
      button.setPadding(
        PixelUtil.toPixelFromDIP(14.0).toInt(),
        PixelUtil.toPixelFromDIP(8.0).toInt(),
        PixelUtil.toPixelFromDIP(14.0).toInt(),
        PixelUtil.toPixelFromDIP(8.0).toInt(),
      )
      button.setOnClickListener {
        setActiveTab(tab.key, "tap")
      }
      tabBar.addView(
        button,
        LinearLayout.LayoutParams(
          0,
          LinearLayout.LayoutParams.WRAP_CONTENT,
          1f,
        ),
      )
    }
    if (shouldShowSettingsButton()) {
      val settingsButton = OKHomeSettingsButton(context)
      settingsButton.setOnClickListener {
        onRowAction?.invoke(
          activeTabKey,
          "tabBar:settings",
          "tabBar",
          "settings",
        )
      }
      tabBar.addView(
        settingsButton,
        LinearLayout.LayoutParams(
          PixelUtil.toPixelFromDIP(44.0).toInt(),
          PixelUtil.toPixelFromDIP(44.0).toInt(),
        ),
      )
    }
    requestLayout()
  }

  private fun shouldShowSettingsButton(): Boolean =
    schema?.optJSONObject("tabBar")?.optBoolean("showSettingsButton", false)
      ?: false

  private fun resolveSchemaActiveTabKey(
    requestedTabKey: String?,
    preserveCurrent: Boolean,
  ): String {
    val enabledTabs = tabs.filter { it.enabled }
    if (preserveCurrent && enabledTabs.any { it.key == activeTabKey }) {
      return activeTabKey
    }
    requestedTabKey
      ?.takeIf { requested -> enabledTabs.any { it.key == requested } }
      ?.let { return it }
    return enabledTabs.firstOrNull()?.key ?: activeTabKey
  }

  private fun setActiveTab(tabKey: String, source: String) {
    if (
      tabKey.isBlank() ||
      tabKey == activeTabKey ||
      tabs.none { it.key == tabKey && it.enabled }
    ) {
      return
    }
    activeTabKey = tabKey
    lastEndReachedItemCount = -1
    lastVisibleRowsJson = ""
    rebuildTabs()
    submitActiveRows()
    recyclerView.scrollToPosition(0)
    syncRefreshingState()
    onTabChange?.invoke(tabKey, source)
  }

  private fun switchToAdjacentTab(direction: Int) {
    val enabledTabs = tabs.filter { it.enabled }
    val currentIndex = enabledTabs.indexOfFirst { it.key == activeTabKey }
    val nextIndex = currentIndex + direction
    enabledTabs.getOrNull(nextIndex)?.let {
      setActiveTab(it.key, "swipe")
    }
  }

  private fun submitActiveRows() {
    val rowsByTab = schema?.optJSONObject("rowsByTab")
    val rowsJson = rowsByTab?.optJSONArray(activeTabKey) ?: JSONArray()
    val rows = mutableListOf<OKHomeRow>()
    for (index in 0 until rowsJson.length()) {
      val row = rowsJson.optJSONObject(index) ?: continue
      rows.add(parseRow(row))
    }
    activeRows = rows
    activeSlotContainers.clear()
    rowsAdapter.submitList(rows)
  }

  private fun parseRow(row: JSONObject): OKHomeRow {
    val type = row.optString("type", "text")
    val title = when (type) {
      "token" -> row.optString("symbol", "Token")
      "defi" -> row.optString("title", "DeFi")
      "nft" -> row.optString("title", "NFT")
      "history" -> row.optString("title", "History")
      "loading" -> "Loading"
      "rnSlot" -> ""
      else -> row.optString("title", type)
    }
    val subtitle = when (type) {
      "token" -> listOf(
        row.optString("balance"),
        row.optString("fiatValue"),
        row.optString("change24h"),
      ).filter { it.isNotBlank() }.joinToString("  ")
      "history" -> listOf(row.optString("subtitle"), row.optString("value"))
        .filter { it.isNotBlank() }
        .joinToString("  ")
      "defi" -> listOf(row.optString("subtitle"), row.optString("networkName"))
        .filter { it.isNotBlank() }
        .joinToString("  ")
      "nft" -> listOf(row.optString("subtitle"), row.optString("networkName"))
        .filter { it.isNotBlank() }
        .joinToString("  ")
      "rnSlot" -> null
      else -> row.optString("subtitle").takeIf { it.isNotBlank() }
    }
    val estimatedHeight = row.optDouble(
      "estimatedHeight",
      if (type == "rnSlot") 96.0 else 64.0,
    )
    return OKHomeRow(
      key = row.optString("key", "${type}:${title}"),
      type = type,
      title = title,
      subtitle = subtitle,
      slotId = row.optString("slotId").takeIf { type == "rnSlot" && it.isNotBlank() },
      iconUri = when (type) {
        "token" -> row.optString("iconUri")
        "defi" -> row.optString("iconUri")
        "nft" -> row.optString("imageUri")
        "history" -> row.optString("iconUri")
        else -> ""
      }.takeIf { it.isNotBlank() },
      value = row.optString("value").takeIf { it.isNotBlank() },
      status = row.optString("status").takeIf { it.isNotBlank() },
      tokenSymbol = row.optString("symbol").takeIf { type == "token" && it.isNotBlank() },
      tokenName = row.optString("name").takeIf { type == "token" && it.isNotBlank() },
      tokenBalance = row.optString("balance").takeIf { type == "token" && it.isNotBlank() },
      tokenFiatValue = row.optString("fiatValue").takeIf { type == "token" && it.isNotBlank() },
      tokenPrice = row.optString("price").takeIf { type == "token" && it.isNotBlank() },
      tokenChange24h = row.optString("change24h").takeIf { type == "token" && it.isNotBlank() },
      tokenChange24hColor = row.optString("change24hColor")
        .takeIf { type == "token" && it.isNotBlank() },
      tokenNetworkName = row.optString("networkName").takeIf { type == "token" && it.isNotBlank() },
      estimatedHeightPx = PixelUtil.toPixelFromDIP(estimatedHeight).toInt(),
      raw = row.toString(),
    )
  }

  private fun currentHeaderHeight(): Int =
    max(headerHolder.measuredHeight, initialHeaderHeightPx)

  private fun syncRecyclerPadding() {
    val topPadding = topInsetPx + currentHeaderHeight() + tabBar.measuredHeight
    if (
      recyclerView.paddingTop != topPadding ||
      recyclerView.paddingBottom != bottomInsetPx
    ) {
      recyclerView.setPadding(0, topPadding, 0, bottomInsetPx)
      refreshLayout.setProgressViewOffset(false, topInsetPx, topPadding)
    }
  }

  private fun syncOverlayTranslation() {
    val headerHeight = currentHeaderHeight()
    val collapseY = recyclerView.computeVerticalScrollOffset()
      .coerceIn(0, headerHeight)
    headerHolder.translationY = -collapseY.toFloat()
    tabBar.translationY = -collapseY.toFloat()
  }

  private fun syncRefreshingState() {
    val refreshingByTab = schema?.optJSONObject("refreshingByTab")
    val refreshing = refreshingByTab?.optBoolean(activeTabKey, false) ?: false
    if (!refreshing && refreshLayout.isRefreshing) {
      refreshLayout.isRefreshing = false
    } else if (refreshing && !refreshLayout.isRefreshing) {
      refreshLayout.isRefreshing = true
    }
  }

  private fun maybeEmitEndReached() {
    val itemCount = rowsAdapter.itemCount
    if (itemCount == 0 || itemCount == lastEndReachedItemCount) {
      return
    }
    if (!recyclerView.canScrollVertically(1)) {
      lastEndReachedItemCount = itemCount
      onEndReached?.invoke(activeTabKey, itemCount)
    }
  }

  private fun maybeEmitVisibleRows() {
    val first = layoutManager.findFirstVisibleItemPosition()
    val last = layoutManager.findLastVisibleItemPosition()
    if (first == RecyclerView.NO_POSITION || last == RecyclerView.NO_POSITION) {
      return
    }
    val keys = JSONArray()
    for (index in first..last) {
      activeRows.getOrNull(index)?.let { keys.put(it.key) }
    }
    val nextJson = keys.toString()
    if (nextJson != lastVisibleRowsJson) {
      lastVisibleRowsJson = nextJson
      onVisibleRowsChange?.invoke(activeTabKey, nextJson)
    }
  }

  private fun mergeJson(target: JSONObject, patch: JSONObject): JSONObject {
    val result = JSONObject(target.toString())
    val keys = patch.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      val patchValue = patch.opt(key)
      val targetValue = result.opt(key)
      if (patchValue is JSONObject && targetValue is JSONObject) {
        result.put(key, mergeJson(targetValue, patchValue))
      } else {
        result.put(key, patchValue)
      }
    }
    return result
  }

  companion object {
    private const val HEADER_NATIVE_ID = "ok-home-header"
    private const val SLOT_NATIVE_ID_PREFIX = "ok-home-slot:"
  }
}

private class OKHomeSettingsButton(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.rgb(144, 144, 144)
    strokeWidth = PixelUtil.toPixelFromDIP(2.4).toFloat()
    strokeCap = Paint.Cap.ROUND
    style = Paint.Style.STROKE
  }
  private val knobPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.rgb(144, 144, 144)
    style = Paint.Style.FILL
  }

  init {
    isClickable = true
    isFocusable = true
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val width = width.toFloat()
    val centerX = width / 2f
    val startX = centerX - PixelUtil.toPixelFromDIP(13.0).toFloat()
    val endX = centerX + PixelUtil.toPixelFromDIP(13.0).toFloat()
    val rowGap = PixelUtil.toPixelFromDIP(8.0).toFloat()
    val firstY = height / 2f - rowGap
    val knobRadius = PixelUtil.toPixelFromDIP(3.6).toFloat()
    drawSlider(canvas, startX, endX, firstY, startX + PixelUtil.toPixelFromDIP(8.0).toFloat(), knobRadius)
    drawSlider(canvas, startX, endX, firstY + rowGap, endX - PixelUtil.toPixelFromDIP(8.0).toFloat(), knobRadius)
    drawSlider(canvas, startX, endX, firstY + rowGap * 2f, centerX, knobRadius)
  }

  private fun drawSlider(
    canvas: Canvas,
    startX: Float,
    endX: Float,
    y: Float,
    knobX: Float,
    knobRadius: Float,
  ) {
    canvas.drawLine(startX, y, endX, y, paint)
    canvas.drawCircle(knobX, y, knobRadius, knobPaint)
  }
}

private class OKHomeRowsAdapter(
  private val onPress: (OKHomeRow) -> Unit,
  private val onBindSlot: (slotId: String, container: FrameLayout) -> Unit,
  private val onRecycleSlot: (container: FrameLayout) -> Unit,
) : ListAdapter<OKHomeRow, RecyclerView.ViewHolder>(DIFF) {
  override fun getItemViewType(position: Int): Int =
    when (getItem(position).type) {
      "rnSlot" -> ROW_TYPE_SLOT
      "token", "defi", "nft", "history" -> ROW_TYPE_TOKEN
      else -> ROW_TYPE_TEXT
    }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
    if (viewType == ROW_TYPE_SLOT) {
      val container = FrameLayout(parent.context)
      container.layoutParams = RecyclerView.LayoutParams(
        RecyclerView.LayoutParams.MATCH_PARENT,
        RecyclerView.LayoutParams.WRAP_CONTENT,
      )
      return SlotViewHolder(container)
    }

    if (viewType == ROW_TYPE_TOKEN) {
      return createTokenViewHolder(parent)
    }

    val container = LinearLayout(parent.context)
    container.orientation = LinearLayout.VERTICAL
    container.setPadding(
      PixelUtil.toPixelFromDIP(20.0).toInt(),
      PixelUtil.toPixelFromDIP(12.0).toInt(),
      PixelUtil.toPixelFromDIP(20.0).toInt(),
      PixelUtil.toPixelFromDIP(12.0).toInt(),
    )
    val title = TextView(parent.context)
    title.textSize = 16f
    title.setTextColor(Color.rgb(32, 32, 32))
    val subtitle = TextView(parent.context)
    subtitle.textSize = 14f
    subtitle.setTextColor(Color.rgb(112, 112, 112))
    container.addView(title)
    container.addView(subtitle)
    return RowViewHolder(container, title, subtitle)
  }

  private fun createTokenViewHolder(parent: ViewGroup): TokenRowViewHolder {
    val context = parent.context
    val row = LinearLayout(context)
    row.orientation = LinearLayout.HORIZONTAL
    row.gravity = Gravity.CENTER_VERTICAL
    row.setPadding(
      PixelUtil.toPixelFromDIP(20.0).toInt(),
      PixelUtil.toPixelFromDIP(10.0).toInt(),
      PixelUtil.toPixelFromDIP(20.0).toInt(),
      PixelUtil.toPixelFromDIP(10.0).toInt(),
    )

    val avatarFrame = FrameLayout(context)
    val avatarImage = ImageView(context)
    avatarImage.scaleType = ImageView.ScaleType.CENTER_CROP
    avatarImage.visibility = View.GONE
    val avatar = TextView(context)
    avatar.gravity = Gravity.CENTER
    avatar.textSize = 18f
    avatar.typeface = Typeface.DEFAULT_BOLD
    avatar.setTextColor(Color.WHITE)
    avatarFrame.addView(
      avatarImage,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    avatarFrame.addView(
      avatar,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    row.addView(
      avatarFrame,
      LinearLayout.LayoutParams(
        PixelUtil.toPixelFromDIP(44.0).toInt(),
        PixelUtil.toPixelFromDIP(44.0).toInt(),
      ),
    )

    val middle = LinearLayout(context)
    middle.orientation = LinearLayout.VERTICAL
    middle.setPadding(PixelUtil.toPixelFromDIP(12.0).toInt(), 0, 0, 0)
    val symbol = TextView(context)
    symbol.textSize = 17f
    symbol.typeface = Typeface.DEFAULT_BOLD
    symbol.setTextColor(Color.rgb(32, 32, 32))
    symbol.maxLines = 1
    val detail = TextView(context)
    detail.textSize = 14f
    detail.setTextColor(Color.rgb(112, 112, 112))
    detail.maxLines = 1
    middle.addView(symbol)
    middle.addView(detail)
    row.addView(
      middle,
      LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        1f,
      ),
    )

    val right = LinearLayout(context)
    right.orientation = LinearLayout.VERTICAL
    right.gravity = Gravity.END
    val balance = TextView(context)
    balance.gravity = Gravity.END
    balance.textSize = 17f
    balance.setTextColor(Color.rgb(32, 32, 32))
    balance.maxLines = 1
    val fiat = TextView(context)
    fiat.gravity = Gravity.END
    fiat.textSize = 14f
    fiat.setTextColor(Color.rgb(112, 112, 112))
    fiat.maxLines = 1
    right.addView(balance)
    right.addView(fiat)
    row.addView(
      right,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ),
    )
    return TokenRowViewHolder(row, avatar, avatarImage, symbol, detail, balance, fiat)
  }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    val row = getItem(position)
    if (holder is SlotViewHolder) {
      holder.container.minimumHeight = row.estimatedHeightPx
      row.slotId?.let { onBindSlot(it, holder.container) }
      return
    }

    if (holder is TokenRowViewHolder) {
      val symbol = row.tokenSymbol ?: row.title
      bindAvatar(holder, row.iconUri, symbol)
      holder.symbol.text = symbol
      holder.detail.text = when (row.type) {
        "token" -> listOfNotNull(
          row.tokenName,
          row.tokenPrice,
          row.tokenChange24h,
          row.tokenNetworkName,
        ).filter { it.isNotBlank() }.joinToString("  ")
        else -> row.subtitle.orEmpty()
      }
      holder.detail.setTextColor(changeColor(row.tokenChange24hColor))
      holder.balance.text = row.tokenBalance ?: row.value.orEmpty()
      holder.fiat.text = row.tokenFiatValue ?: row.status.orEmpty()
      holder.itemView.minimumHeight = row.estimatedHeightPx
      holder.itemView.setOnClickListener {
        onPress(row)
      }
      return
    }

    holder as RowViewHolder
    holder.title.text = row.title
    holder.title.typeface = Typeface.DEFAULT_BOLD.takeIf {
      row.type == "sectionHeader"
    } ?: Typeface.DEFAULT
    holder.title.textSize = if (row.type == "sectionHeader") 20f else 16f
    holder.subtitle.text = row.subtitle ?: ""
    holder.subtitle.visibility = if (row.subtitle.isNullOrBlank()) {
      View.GONE
    } else {
      View.VISIBLE
    }
    holder.itemView.minimumHeight = row.estimatedHeightPx
    holder.itemView.setOnClickListener {
      onPress(row)
    }
  }

  override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
    if (holder is SlotViewHolder) {
      onRecycleSlot(holder.container)
    }
    super.onViewRecycled(holder)
  }

  private fun bindAvatar(
    holder: TokenRowViewHolder,
    iconUri: String?,
    fallback: String,
  ) {
    holder.avatar.text = fallback.take(1).uppercase()
    holder.avatar.background = createAvatarBackground(fallback)
    holder.avatar.visibility = View.VISIBLE
    holder.avatarImage.visibility = View.GONE
    holder.avatarImage.setImageDrawable(null)
    holder.avatarImage.tag = iconUri
    if (iconUri.isNullOrBlank() || !iconUri.startsWith("http")) {
      return
    }
    val cached = IMAGE_CACHE.get(iconUri)
    if (cached != null) {
      holder.avatarImage.setImageBitmap(cached)
      holder.avatarImage.visibility = View.VISIBLE
      holder.avatar.visibility = View.GONE
      return
    }
    IMAGE_EXECUTOR.execute {
      try {
        val bitmap = URL(iconUri).openStream().use { BitmapFactory.decodeStream(it) }
        if (bitmap != null) {
          IMAGE_CACHE.put(iconUri, bitmap)
          holder.avatarImage.post {
            if (holder.avatarImage.tag == iconUri) {
              holder.avatarImage.setImageBitmap(bitmap)
              holder.avatarImage.visibility = View.VISIBLE
              holder.avatar.visibility = View.GONE
            }
          }
        }
      } catch (_: Exception) {
        // Ignore image failures and keep the deterministic native placeholder.
      }
    }
  }

  private fun createAvatarBackground(symbol: String): GradientDrawable {
    val hueSeed = symbol.fold(0) { acc, char -> acc + char.code }
    val colors = intArrayOf(
      Color.rgb(66, 133, 244),
      Color.rgb(251, 188, 5),
      Color.rgb(52, 168, 83),
      Color.rgb(234, 67, 53),
      Color.rgb(103, 58, 183),
    )
    return GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(colors[hueSeed.mod(colors.size)])
    }
  }

  private fun changeColor(color: String?): Int =
    when (color) {
      "positive" -> Color.rgb(0, 128, 96)
      "negative" -> Color.rgb(229, 0, 36)
      else -> Color.rgb(112, 112, 112)
    }

  class RowViewHolder(
    view: View,
    val title: TextView,
    val subtitle: TextView,
  ) : RecyclerView.ViewHolder(view)

  class TokenRowViewHolder(
    view: View,
    val avatar: TextView,
    val avatarImage: ImageView,
    val symbol: TextView,
    val detail: TextView,
    val balance: TextView,
    val fiat: TextView,
  ) : RecyclerView.ViewHolder(view)

  class SlotViewHolder(
    val container: FrameLayout,
  ) : RecyclerView.ViewHolder(container)

  companion object {
    private val IMAGE_CACHE = object : LruCache<String, Bitmap>(64) {}
    private val IMAGE_EXECUTOR = Executors.newFixedThreadPool(2)

    private val DIFF = object : DiffUtil.ItemCallback<OKHomeRow>() {
      override fun areItemsTheSame(oldItem: OKHomeRow, newItem: OKHomeRow) =
        oldItem.key == newItem.key && oldItem.type == newItem.type

      override fun areContentsTheSame(oldItem: OKHomeRow, newItem: OKHomeRow) =
        oldItem.raw == newItem.raw
    }
  }
}
