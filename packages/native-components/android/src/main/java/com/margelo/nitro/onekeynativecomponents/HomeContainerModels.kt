package com.margelo.nitro.onekeynativecomponents

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

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
)

internal data class HomeContainerAction(
  val id: String,
  val title: String,
  val subtitle: String,
  val icon: String,
  val iconUrl: String,
  val actionId: String,
)

internal data class HomeContainerBanner(
  val id: String,
  val title: String,
  val subtitle: String,
  val imageUrl: String,
  val actionId: String,
  val dismissActionId: String,
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
  val secondaryImageUrl: String,
  val badge: String,
  val badgeImageUrl: String,
  val accentColor: String,
  val buttonTitle: String,
  val leadingIcon: String,
  val showChevron: Boolean,
  val actionId: String,
  val displayHeight: Int,
)

internal data class HomeContainerSection(
  val id: String,
  val title: String,
  val actionTitle: String,
  val actionId: String,
  val layout: String,
  val items: List<HomeContainerItem>,
)

internal data class HomeContainerTab(
  val id: String,
  val title: String,
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
    )
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
    actions = value.getJSONArray("actions").mapObjects(::parseAction),
    banners = value.getJSONArray("banners").mapObjects { banner ->
      HomeContainerBanner(
        id = banner.getString("id"),
        title = banner.getString("title"),
        subtitle = banner.optString("subtitle"),
        imageUrl = banner.optString("imageUrl"),
        actionId = banner.optString("actionId"),
        dismissActionId = banner.optString("dismissActionId"),
      )
    },
  )

  private fun parseTab(value: JSONObject): HomeContainerTab = HomeContainerTab(
    id = value.getString("id"),
    title = value.getString("title"),
    toolbarAction = value.optJSONObject("toolbarAction")?.let(::parseAction),
    sections = value.getJSONArray("sections").mapObjects(::parseSection),
  )

  private fun parseSection(value: JSONObject): HomeContainerSection = HomeContainerSection(
    id = value.getString("id"),
    title = value.optString("title"),
    actionTitle = value.optString("actionTitle"),
    actionId = value.optString("actionId"),
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
        secondaryImageUrl = item.optString("secondaryImageUrl"),
        badge = item.optString("badge"),
        badgeImageUrl = item.optString("badgeImageUrl"),
        accentColor = item.optString("accentColor"),
        buttonTitle = item.optString("buttonTitle"),
        leadingIcon = item.optString("leadingIcon"),
        showChevron = item.optBoolean("showChevron"),
        actionId = item.optString("actionId"),
        displayHeight = item.optInt("displayHeight"),
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
