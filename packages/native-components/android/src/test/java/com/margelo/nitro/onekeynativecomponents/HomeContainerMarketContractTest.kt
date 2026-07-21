package com.margelo.nitro.onekeynativecomponents

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerMarketContractTest {
  @Test
  fun `market DTO keeps dynamic categories recommendations and image candidates`() {
    val snapshot = HomeContainerJson.parseSnapshot(marketSnapshotJson())
    val section = snapshot.tabs.first().sections.single()
    val tabs = section.items.first()
    val token = section.items[1]

    assertEquals("marketRecommendations", section.layout)
    assertTrue(section.actionDisabled)
    assertEquals(listOf("favorites", "trending", "stocks"), tabs.segments.map { it.id })
    assertEquals("star", tabs.segments.first().leadingIcon)
    assertTrue(tabs.segments.first().iconOnly)
    assertEquals(listOf("https://invalid/logo", "https://cdn/logo.png"), token.imageUrls)
    assertEquals("https://cdn/source.png", token.titleAccessoryImageUrl)
    assertEquals("gas", token.titleAccessoryIcon)
    assertEquals(listOf("New", "Verified"), token.badges)
    assertTrue(token.communityRecognized)
    assertTrue(token.favorite)
    assertEquals("home.widget.market.favorite", token.favoriteActionId)
    assertEquals("Remove from favorites", token.favoriteLabel)
  }

  @Test
  fun `optional market DTO fields keep safe empty defaults`() {
    val snapshot = HomeContainerJson.parseSnapshot(marketSnapshotJson(includeOptionalFields = false))
    val section = snapshot.tabs.first().sections.single()
    val token = section.items[1]

    assertFalse(section.actionDisabled)
    assertTrue(token.imageUrls.isEmpty())
    assertTrue(token.titleAccessoryImageUrl.isEmpty())
    assertTrue(token.titleAccessoryIcon.isEmpty())
    assertTrue(token.badges.isEmpty())
    assertFalse(token.communityRecognized)
    assertFalse(token.favorite)
    assertTrue(token.favoriteActionId.isEmpty())
    assertTrue(token.favoriteLabel.isEmpty())
    assertTrue(token.segments.isEmpty())
  }

  @Test
  fun `candidate chain is ordered deduplicated and represented by fallback signature`() {
    assertEquals(
      listOf("https://primary", "https://fallback"),
      HomeContainerImageLoader.candidates(
        "https://primary",
        listOf("", "https://primary", "https://fallback"),
      ),
    )
    assertEquals(
      "https://primary|https://fallback|fallback:cryptoCoin:-1",
      HomeContainerImageLoader.representedSignature(
        "https://primary",
        listOf("https://fallback"),
        "cryptoCoin",
        -1,
      ),
    )
  }

  @Test
  fun `diff key changes for identity favorite categories and image candidates`() {
    val snapshot = HomeContainerJson.parseSnapshot(marketSnapshotJson())
    val token = snapshot.tabs.first().sections.single().items[1]
    val tabs = snapshot.tabs.first().sections.single().items.first()

    assertNotEquals(homeContainerItemContentKey(token), homeContainerItemContentKey(token.copy(id = "other")))
    assertNotEquals(
      homeContainerItemContentKey(token),
      homeContainerItemContentKey(token.copy(favorite = false)),
    )
    assertNotEquals(
      homeContainerItemContentKey(token),
      homeContainerItemContentKey(token.copy(imageUrls = listOf("https://other"))),
    )
    assertNotEquals(
      homeContainerItemContentKey(tabs),
      homeContainerItemContentKey(
        tabs.copy(segments = tabs.segments.map { it.copy(selected = it.id == "stocks") }),
      ),
    )
  }

  @Test
  fun `dynamic row height follows scale and measured content without clipping`() {
    assertEquals(56, resolveHomeContainerRowHeight(56, 1f, 48))
    assertEquals(78, resolveHomeContainerRowHeight(56, 1.4f, 70))
    assertEquals(96, resolveHomeContainerRowHeight(56, 2f, 96))
  }

  private fun marketSnapshotJson(includeOptionalFields: Boolean = true): String {
    val payload = JSONObject(fixture("home-container-v2.snapshot.json").getJSONObject("payload").toString())
      .put("schemaVersion", HOME_CONTAINER_BUSINESS_SCHEMA_VERSION)
      .put("revision", 10)
    val portfolio = payload.getJSONArray("tabs").getJSONObject(0)
    val marketTabs = JSONObject()
      .put("id", "market-tabs")
      .put("renderer", "marketTabs")
      .put("title", "Market")
      .put(
        "segments",
        JSONArray()
          .put(segment("favorites", "", "star", iconOnly = true, selected = true))
          .put(segment("trending", "Trending", "", iconOnly = false, selected = false))
          .put(segment("stocks", "Stocks", "", iconOnly = false, selected = false)),
      )
    val token = JSONObject()
      .put("id", "market:link")
      .put("renderer", "market")
      .put("title", "LINK")
      .put("subtitle", "ChainLink Token")
      .put("imageUrl", "https://primary/logo.png")
      .put("actionId", "home.widget.market.token")
    if (includeOptionalFields) {
      token
        .put("imageUrls", JSONArray().put("https://invalid/logo").put("https://cdn/logo.png"))
        .put("titleAccessoryImageUrl", "https://cdn/source.png")
        .put("titleAccessoryIcon", "gas")
        .put("badges", JSONArray().put("New").put("Verified"))
        .put("communityRecognized", true)
        .put("favorite", true)
        .put("favoriteActionId", "home.widget.market.favorite")
        .put("favoriteLabel", "Remove from favorites")
    }
    portfolio.put(
      "sections",
      JSONArray().put(
        JSONObject()
          .put("id", "portfolio-market")
          .put("title", "Market")
          .put("actionTitle", "Add 4 tokens")
          .put("actionId", "home.widget.market.addRecommended")
          .put("actionDisabled", includeOptionalFields)
          .put("layout", "marketRecommendations")
          .put("items", JSONArray().put(marketTabs).put(token)),
      ),
    )
    return payload.toString()
  }

  private fun segment(
    id: String,
    title: String,
    leadingIcon: String,
    iconOnly: Boolean,
    selected: Boolean,
  ): JSONObject = JSONObject()
    .put("id", id)
    .put("title", title)
    .put("leadingIcon", leadingIcon)
    .put("iconOnly", iconOnly)
    .put("selected", selected)
    .put("actionId", "home.widget.market.category:$id")

  private fun fixture(name: String): JSONObject {
    val resource = javaClass.classLoader?.getResource(name)
      ?: error("Missing canonical fixture: $name")
    return JSONObject(resource.readText())
  }
}
