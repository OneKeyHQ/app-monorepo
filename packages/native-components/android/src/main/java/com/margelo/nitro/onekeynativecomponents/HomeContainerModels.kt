package com.margelo.nitro.onekeynativecomponents

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

private const val HOME_CONTAINER_MAXIMUM_SAFE_INTEGER = 9_007_199_254_740_991L

internal data class HomeContainerTheme(
  val backgroundColor: String,
  val cardColor: String,
  val dividerColor: String,
  val primaryTextColor: String,
  val secondaryTextColor: String,
  val accentColor: String,
  val positiveColor: String,
  val negativeColor: String,
  val hoverColor: String = "",
  val activeColor: String = "",
  val subduedIconColor: String = "",
)

internal data class HomeContainerAction(
  val id: String,
  val title: String,
  val subtitle: String,
  val icon: String,
  val iconUrl: String,
  val actionId: String,
)

internal data class HomeContainerBannerResourceRow(
  val label: String,
  val value: String,
  val progress: Double,
)

internal data class HomeContainerBanner(
  val id: String,
  val title: String,
  val subtitle: String,
  val imageUrl: String,
  val actionId: String,
  val dismissActionId: String,
  val resourceRows: List<HomeContainerBannerResourceRow>,
)

internal data class HomeContainerSegment(
  val id: String,
  val title: String,
  val imageUrl: String,
  val leadingIcon: String,
  val iconOnly: Boolean,
  val selected: Boolean,
  val actionId: String,
)

internal data class HomeContainerHeader(
  val accountName: String,
  val accountSubtitle: String,
  val accountImageUrl: String,
  val accountActionId: String,
  val copyActionId: String,
  val networkName: String,
  val networkImageUrls: List<String>,
  val networkCount: Int,
  val networkActionId: String,
  val balance: String,
  val balanceSecondary: String,
  val balanceActionId: String,
  val balanceActions: List<HomeContainerAction>,
  val actionLayout: String,
  val actionRowHeight: Int,
  val actions: List<HomeContainerAction>,
  val banners: List<HomeContainerBanner>,
)

internal data class HomeContainerItem(
  val id: String,
  val renderer: String,
  val title: String,
  val subtitle: String,
  val subtitleDetail: String,
  val subtitleDetailColor: String,
  val value: String,
  val detail: String,
  val imageUrl: String,
  val imageUrls: List<String>,
  val secondaryImageUrl: String,
  val titleAccessoryImageUrl: String,
  val titleAccessoryIcon: String,
  val badge: String,
  val badges: List<String>,
  val badgeImageUrl: String,
  val communityRecognized: Boolean,
  val accentColor: String,
  val buttonTitle: String,
  val leadingIcon: String,
  val showChevron: Boolean,
  val showDivider: Boolean,
  val actionId: String,
  val favorite: Boolean,
  val favoriteActionId: String,
  val favoriteLabel: String,
  val displayHeight: Int,
  val segments: List<HomeContainerSegment>,
)

internal data class HomeContainerSection(
  val id: String,
  val title: String,
  val actionTitle: String,
  val actionId: String,
  val actionDisabled: Boolean,
  val layout: String,
  val items: List<HomeContainerItem>,
)

internal enum class HomeContainerTabDestination(val wireValue: String) {
  INLINE("inline"),
  HANDOFF("handoff");

  companion object {
    fun fromWireValue(value: String): HomeContainerTabDestination =
      entries.firstOrNull { it.wireValue == value }
        ?: throw IllegalArgumentException("Unsupported HomeContainer tab destination: $value")
  }
}

internal data class HomeContainerTab(
  val id: String,
  val title: String,
  val destination: HomeContainerTabDestination,
  val handoffCommandId: String?,
  val toolbarAction: HomeContainerAction?,
  val sections: List<HomeContainerSection>,
)

internal data class HomeContainerSnapshot(
  val schemaVersion: Int,
  val revision: Long,
  val selectedTabId: String,
  val header: HomeContainerHeader,
  val tabs: List<HomeContainerTab>,
  val theme: HomeContainerTheme,
) {
  fun applying(patch: HomeContainerPatch): HomeContainerSnapshot {
    val sectionPatches = patch.tabs.associate { it.tabId to it.sections }
    return copy(
      revision = patch.revision,
      header = patch.header ?: header,
      tabs = tabs.map { tab ->
        sectionPatches[tab.id]?.let { tab.copy(sections = it) } ?: tab
      },
    )
  }
}

internal fun HomeContainerSnapshot.inlineTabs(): List<HomeContainerTab> =
  tabs.filter { it.destination == HomeContainerTabDestination.INLINE }

internal fun HomeContainerSnapshot.hasValidTabInvariants(): Boolean {
  if (
    schemaVersion != HOME_CONTAINER_BUSINESS_SCHEMA_VERSION ||
    revision !in 0..HOME_CONTAINER_MAXIMUM_SAFE_INTEGER
  ) {
    return false
  }
  if (tabs.isEmpty()) return false
  val tabIds = tabs.map { it.id }
  if (tabIds.any(String::isEmpty) || tabIds.toSet().size != tabIds.size) return false
  val selectedTab = tabs.firstOrNull { it.id == selectedTabId }
  if (selectedTab?.destination != HomeContainerTabDestination.INLINE) return false
  return tabs.all { tab ->
    val hasValidDestination = when (tab.destination) {
      HomeContainerTabDestination.INLINE -> tab.handoffCommandId == null
      HomeContainerTabDestination.HANDOFF ->
        !tab.handoffCommandId.isNullOrEmpty() && tab.sections.isEmpty()
    }
    val sectionIds = tab.sections.map { it.id }
    hasValidDestination &&
      sectionIds.none(String::isEmpty) &&
      sectionIds.toSet().size == sectionIds.size
  }
}

internal fun HomeContainerSnapshot.applyingValidatedPatch(
  patch: HomeContainerPatch,
): HomeContainerSnapshot? {
  if (
    patch.schemaVersion != HOME_CONTAINER_BUSINESS_SCHEMA_VERSION ||
    patch.revision !in 0..HOME_CONTAINER_MAXIMUM_SAFE_INTEGER ||
    patch.revision < revision
  ) {
    return null
  }
  val validTabIds = inlineTabs().mapTo(mutableSetOf()) { it.id }
  val patchedTabIds = patch.tabs.map { it.tabId }
  if (patchedTabIds.toSet().size != patchedTabIds.size) return null
  if (patchedTabIds.any { it !in validTabIds }) return null
  return applying(patch).takeIf(HomeContainerSnapshot::hasValidTabInvariants)
}

internal data class HomeContainerTabPatch(
  val tabId: String,
  val sections: List<HomeContainerSection>,
)

internal data class HomeContainerPatch(
  val schemaVersion: Int,
  val revision: Long,
  val header: HomeContainerHeader?,
  val tabs: List<HomeContainerTabPatch>,
)

internal object HomeContainerJson {
  fun parseSnapshot(json: String): HomeContainerSnapshot {
    val root = JSONObject(json)
    return HomeContainerSnapshot(
      schemaVersion = root.getInt("schemaVersion"),
      revision = root.getLong("revision"),
      selectedTabId = root.getString("selectedTabId"),
      header = parseHeader(root.getJSONObject("header")),
      tabs = root.getJSONArray("tabs").mapObjects(::parseTab),
      theme = parseTheme(root.getJSONObject("theme")),
    ).also { snapshot ->
      require(snapshot.hasValidTabInvariants()) {
        "HomeContainer snapshot has invalid tab destination invariants"
      }
    }
  }

  fun parsePatch(json: String): HomeContainerPatch {
    val root = JSONObject(json)
    return HomeContainerPatch(
      schemaVersion = root.getInt("schemaVersion"),
      revision = root.getLong("revision"),
      header = root.optJSONObject("header")?.let(::parseHeader),
      tabs = root.getJSONArray("tabs").mapObjects { tab ->
        HomeContainerTabPatch(
          tabId = tab.getString("tabId"),
          sections = tab.getJSONArray("sections").mapObjects(::parseSection),
        )
      },
    )
  }

  private fun parseTheme(value: JSONObject): HomeContainerTheme = HomeContainerTheme(
    backgroundColor = value.getString("backgroundColor"),
    cardColor = value.getString("cardColor"),
    dividerColor = value.getString("dividerColor"),
    primaryTextColor = value.getString("primaryTextColor"),
    secondaryTextColor = value.getString("secondaryTextColor"),
    accentColor = value.getString("accentColor"),
    positiveColor = value.getString("positiveColor"),
    negativeColor = value.getString("negativeColor"),
    hoverColor = value.optString("hoverColor"),
    activeColor = value.optString("activeColor"),
    subduedIconColor = value.optString("subduedIconColor"),
  )

  private fun parseHeader(value: JSONObject): HomeContainerHeader = HomeContainerHeader(
    accountName = value.getString("accountName"),
    accountSubtitle = value.optString("accountSubtitle"),
    accountImageUrl = value.optString("accountImageUrl"),
    accountActionId = value.optString("accountActionId"),
    copyActionId = value.optString("copyActionId"),
    networkName = value.optString("networkName"),
    networkImageUrls = value.optJSONArray("networkImageUrls")?.mapStrings() ?: emptyList(),
    networkCount = value.optInt("networkCount"),
    networkActionId = value.optString("networkActionId"),
    balance = value.getString("balance"),
    balanceSecondary = value.optString("balanceSecondary"),
    balanceActionId = value.optString("balanceActionId"),
    balanceActions = value.optJSONArray("balanceActions")?.mapObjects(::parseAction) ?: emptyList(),
    actionLayout = value.optString("actionLayout", "standard"),
    actionRowHeight = value.optInt("actionRowHeight", 62),
    actions = value.getJSONArray("actions").mapObjects(::parseAction),
    banners = value.getJSONArray("banners").mapObjects { banner ->
      HomeContainerBanner(
        id = banner.getString("id"),
        title = banner.getString("title"),
        subtitle = banner.optString("subtitle"),
        imageUrl = banner.optString("imageUrl"),
        actionId = banner.optString("actionId"),
        dismissActionId = banner.optString("dismissActionId"),
        resourceRows = banner.optJSONArray("resourceRows")?.mapObjects { row ->
          HomeContainerBannerResourceRow(
            label = row.optString("label"),
            value = row.optString("value"),
            progress = row.optDouble("progress"),
          )
        } ?: emptyList(),
      )
    },
  )

  private fun parseTab(value: JSONObject): HomeContainerTab {
    val destination = HomeContainerTabDestination.fromWireValue(value.getString("destination"))
    val handoffCommandId = when (destination) {
      HomeContainerTabDestination.INLINE -> {
        require(!value.has("handoffCommandId")) {
          "Inline HomeContainer tab must not carry handoffCommandId"
        }
        null
      }
      HomeContainerTabDestination.HANDOFF -> value.getString("handoffCommandId").also {
        require(it.isNotEmpty()) { "Handoff HomeContainer tab requires handoffCommandId" }
      }
    }
    val sections = value.getJSONArray("sections").mapObjects(::parseSection)
    require(destination != HomeContainerTabDestination.HANDOFF || sections.isEmpty()) {
      "Handoff HomeContainer tab must not carry sections"
    }
    return HomeContainerTab(
      id = value.getString("id"),
      title = value.getString("title"),
      destination = destination,
      handoffCommandId = handoffCommandId,
      toolbarAction = value.optJSONObject("toolbarAction")?.let(::parseAction),
      sections = sections,
    )
  }

  private fun parseSection(value: JSONObject): HomeContainerSection = HomeContainerSection(
    id = value.getString("id"),
    title = value.optString("title"),
    actionTitle = value.optString("actionTitle"),
    actionId = value.optString("actionId"),
    actionDisabled = value.optBoolean("actionDisabled"),
    layout = value.optString("layout", "list"),
    items = value.getJSONArray("items").mapObjects { item ->
      HomeContainerItem(
        id = item.getString("id"),
        renderer = item.getString("renderer"),
        title = item.getString("title"),
        subtitle = item.optString("subtitle"),
        subtitleDetail = item.optString("subtitleDetail"),
        subtitleDetailColor = item.optString("subtitleDetailColor"),
        value = item.optString("value"),
        detail = item.optString("detail"),
        imageUrl = item.optString("imageUrl"),
        imageUrls = item.optJSONArray("imageUrls")?.mapStrings() ?: emptyList(),
        secondaryImageUrl = item.optString("secondaryImageUrl"),
        titleAccessoryImageUrl = item.optString("titleAccessoryImageUrl"),
        titleAccessoryIcon = item.optString("titleAccessoryIcon"),
        badge = item.optString("badge"),
        badges = item.optJSONArray("badges")?.mapStrings() ?: emptyList(),
        badgeImageUrl = item.optString("badgeImageUrl"),
        communityRecognized = item.optBoolean("communityRecognized"),
        accentColor = item.optString("accentColor"),
        buttonTitle = item.optString("buttonTitle"),
        leadingIcon = item.optString("leadingIcon"),
        showChevron = item.optBoolean("showChevron"),
        showDivider = item.optBoolean("showDivider"),
        actionId = item.optString("actionId"),
        favorite = item.optBoolean("favorite"),
        favoriteActionId = item.optString("favoriteActionId"),
        favoriteLabel = item.optString("favoriteLabel"),
        displayHeight = item.optInt("displayHeight"),
        segments = item.optJSONArray("segments")?.mapObjects(::parseSegment) ?: emptyList(),
      )
    },
  )

  private fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T): List<T> =
    List(length()) { index -> transform(getJSONObject(index)) }

  private fun JSONArray.mapStrings(): List<String> =
    List(length()) { index -> optString(index) }

  private fun parseAction(action: JSONObject): HomeContainerAction = HomeContainerAction(
    id = action.getString("id"),
    title = action.getString("title"),
    subtitle = action.optString("subtitle"),
    icon = action.optString("icon"),
    iconUrl = action.optString("iconUrl"),
    actionId = action.getString("actionId"),
  )

  private fun parseSegment(segment: JSONObject): HomeContainerSegment = HomeContainerSegment(
    id = segment.getString("id"),
    title = segment.getString("title"),
    imageUrl = segment.optString("imageUrl"),
    leadingIcon = segment.optString("leadingIcon"),
    iconOnly = segment.optBoolean("iconOnly"),
    selected = segment.optBoolean("selected"),
    actionId = segment.getString("actionId"),
  )
}

internal fun parseHomeContainerColor(value: String, fallback: Int): Int =
  try {
    // Theme values come from React Native as CSS colors, where eight-digit hex
    // colors are #RRGGBBAA. Android Color.parseColor expects #AARRGGBB.
    val androidColor = if (value.length == 9 && value.startsWith('#')) {
      "#${value.substring(7, 9)}${value.substring(1, 7)}"
    } else {
      value
    }
    Color.parseColor(androidColor)
  } catch (_: IllegalArgumentException) {
    fallback
  }
