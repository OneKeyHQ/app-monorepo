package com.margelo.nitro.onekeynativecomponents

import java.math.BigDecimal
import org.json.JSONArray
import org.json.JSONObject

internal const val HOME_CONTAINER_PROTOCOL_VERSION = 2
internal const val HOME_CONTAINER_BUSINESS_SCHEMA_VERSION = 2
private const val MAXIMUM_SAFE_JSON_INTEGER = 9_007_199_254_740_991L
private val MAXIMUM_SAFE_JSON_INTEGER_DECIMAL = BigDecimal.valueOf(MAXIMUM_SAFE_JSON_INTEGER)

internal data class HomeContainerProtocolV2Owner(
  val scopeKey: String,
  val sessionId: String,
) {
  val isValid: Boolean
    get() = scopeKey.isNotEmpty() && sessionId.isNotEmpty()

  fun toJson(): JSONObject = JSONObject()
    .put("scopeKey", scopeKey)
    .put("sessionId", sessionId)
}

internal data class HomeContainerProtocolV2State(
  val owner: HomeContainerProtocolV2Owner,
  val revision: Long,
  val snapshot: HomeContainerSnapshot,
  private val document: JSONObject,
) {
  fun selectingTab(tabId: String): HomeContainerProtocolV2State? {
    if (
      snapshot.tabs.none {
        it.id == tabId && it.destination == HomeContainerTabDestination.INLINE
      }
    ) {
      return null
    }
    val selectedDocument = document.deepCopy().put("selectedTabId", tabId)
    return copy(
      snapshot = snapshot.copy(selectedTabId = tabId),
      document = selectedDocument,
    )
  }

  fun documentCopy(): JSONObject = document.deepCopy()
}

internal enum class HomeContainerProtocolV2NeedSnapshotReason(val wireValue: String) {
  OWNER_MISMATCH("ownerMismatch"),
  REVISION_GAP("revisionGap"),
  INVALID_INVARIANT("invalidInvariant"),
  UNSUPPORTED_SCHEMA("unsupportedSchema"),
  UNSUPPORTED_PROTOCOL("unsupportedProtocol"),
}

internal sealed class HomeContainerProtocolV2ApplyOutcome {
  abstract fun toTransportResultJson(): String

  data class Applied(val state: HomeContainerProtocolV2State) :
    HomeContainerProtocolV2ApplyOutcome() {
    override fun toTransportResultJson(): String = JSONObject()
      .put("kind", "applied")
      .put("owner", state.owner.toJson())
      .put("revision", state.revision)
      .toString()
  }

  data class Duplicate(
    val owner: HomeContainerProtocolV2Owner,
    val revision: Long,
  ) : HomeContainerProtocolV2ApplyOutcome() {
    override fun toTransportResultJson(): String = JSONObject()
      .put("kind", "duplicate")
      .put("owner", owner.toJson())
      .put("revision", revision)
      .toString()
  }

  data class NeedSnapshot(
    val owner: HomeContainerProtocolV2Owner?,
    val currentRevision: Long?,
    val reason: HomeContainerProtocolV2NeedSnapshotReason,
  ) : HomeContainerProtocolV2ApplyOutcome() {
    val coalescingKey: String
      get() = listOf(
        owner?.scopeKey.orEmpty(),
        owner?.sessionId.orEmpty(),
        currentRevision?.toString().orEmpty(),
        reason.wireValue,
      ).joinToString("|")

    override fun toTransportResultJson(): String = JSONObject()
      .put("kind", "needSnapshot")
      .apply {
        owner?.let { put("owner", it.toJson()) }
        currentRevision?.let { put("currentRevision", it) }
      }
      .put("reason", reason.wireValue)
      .toString()
  }
}

internal object HomeContainerProtocolV2Transaction {
  fun isProtocolPayload(json: String, expectedKind: String): Boolean =
    runCatching {
      val root = JSONObject(json)
      root.has("protocolVersion") || root.optString("kind") == expectedKind
    }.getOrDefault(false)

  fun applySnapshot(
    json: String,
    current: HomeContainerProtocolV2State?,
  ): HomeContainerProtocolV2ApplyOutcome {
    val root = runCatching { JSONObject(json) }.getOrElse {
      return needSnapshot(current = current)
    }
    val owner = root.protocolOwner()
    if (root.strictSafeInteger("protocolVersion") != HOME_CONTAINER_PROTOCOL_VERSION.toLong()) {
      return needSnapshot(
        owner = owner,
        current = current,
        reason = HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_PROTOCOL,
      )
    }
    if (root.strictSafeInteger("schemaVersion") != HOME_CONTAINER_BUSINESS_SCHEMA_VERSION.toLong()) {
      return needSnapshot(
        owner = owner,
        current = current,
        reason = HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_SCHEMA,
      )
    }
    val revision = root.strictSafeInteger("revision")
    if (root.optString("kind") != "snapshot" || owner?.isValid != true || revision == null) {
      return needSnapshot(owner = owner, current = current)
    }
    val document = runCatching {
      val payload = root.getJSONObject("payload")
      JSONObject()
        .put("schemaVersion", HOME_CONTAINER_BUSINESS_SCHEMA_VERSION)
        .put("revision", revision)
        .put(
          "selectedTabId",
          payload.strictNonEmptyString("selectedTabId") ?: error("Invalid selected tab"),
        )
        .put("header", payload.getJSONObject("header").deepCopy())
        .put("tabs", payload.getJSONArray("tabs").deepCopy())
        .put("theme", payload.getJSONObject("theme").deepCopy())
    }.getOrElse {
      return needSnapshot(owner = owner, current = current)
    }
    val candidate = document.validatedSnapshot() ?: return needSnapshot(owner = owner, current = current)
    if (current != null && current.owner == owner && revision <= current.revision) {
      return HomeContainerProtocolV2ApplyOutcome.Duplicate(owner, revision)
    }
    return HomeContainerProtocolV2ApplyOutcome.Applied(
      HomeContainerProtocolV2State(owner, revision, candidate, document),
    )
  }

  fun applyPatch(
    json: String,
    current: HomeContainerProtocolV2State?,
  ): HomeContainerProtocolV2ApplyOutcome {
    val root = runCatching { JSONObject(json) }.getOrElse {
      return needSnapshot(current = current)
    }
    val owner = root.protocolOwner()
    if (root.strictSafeInteger("protocolVersion") != HOME_CONTAINER_PROTOCOL_VERSION.toLong()) {
      return needSnapshot(
        owner = owner,
        current = current,
        reason = HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_PROTOCOL,
      )
    }
    if (root.strictSafeInteger("schemaVersion") != HOME_CONTAINER_BUSINESS_SCHEMA_VERSION.toLong()) {
      return needSnapshot(
        owner = owner,
        current = current,
        reason = HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_SCHEMA,
      )
    }
    val baseRevision = root.strictSafeInteger("baseRevision")
    val revision = root.strictSafeInteger("revision")
    if (
      root.optString("kind") != "patch" ||
      owner?.isValid != true ||
      baseRevision == null ||
      revision == null ||
      revision <= baseRevision
    ) {
      return needSnapshot(owner = owner, current = current)
    }
    if (current == null) {
      return HomeContainerProtocolV2ApplyOutcome.NeedSnapshot(
        owner = owner,
        currentRevision = null,
        reason = HomeContainerProtocolV2NeedSnapshotReason.REVISION_GAP,
      )
    }
    if (current.owner != owner) {
      return HomeContainerProtocolV2ApplyOutcome.NeedSnapshot(
        owner = owner,
        currentRevision = current.revision,
        reason = HomeContainerProtocolV2NeedSnapshotReason.OWNER_MISMATCH,
      )
    }
    val candidateDocument = current.documentCopy()
    val changesApplied = runCatching {
      applyChanges(candidateDocument, root.getJSONArray("changes"))
    }.getOrDefault(false)
    if (!changesApplied) {
      return needSnapshot(owner = owner, current = current)
    }
    candidateDocument
      .put("schemaVersion", HOME_CONTAINER_BUSINESS_SCHEMA_VERSION)
      .put("revision", revision)
    val candidate = candidateDocument.validatedSnapshot()
      ?: return needSnapshot(owner = owner, current = current)
    if (revision <= current.revision) {
      return HomeContainerProtocolV2ApplyOutcome.Duplicate(owner, revision)
    }
    if (baseRevision != current.revision || revision != current.revision + 1) {
      return HomeContainerProtocolV2ApplyOutcome.NeedSnapshot(
        owner = owner,
        currentRevision = current.revision,
        reason = HomeContainerProtocolV2NeedSnapshotReason.REVISION_GAP,
      )
    }
    return HomeContainerProtocolV2ApplyOutcome.Applied(
      HomeContainerProtocolV2State(owner, revision, candidate, candidateDocument),
    )
  }

  private fun applyChanges(document: JSONObject, changes: JSONArray): Boolean {
    repeat(changes.length()) { index ->
      val change = changes.getJSONObject(index)
      val applied = when (change.getString("kind")) {
        "replaceShell" -> replaceShell(document, change)
        "replaceNavigation" -> replaceNavigation(document, change)
        "replaceSection" -> replaceSection(document, change)
        "removeSection" -> removeSection(document, change)
        "replaceSurface" -> replaceSurface(document, change)
        else -> false
      }
      if (!applied) return false
    }
    return true
  }

  private fun replaceShell(document: JSONObject, change: JSONObject): Boolean {
    document.put("header", change.getJSONObject("value").deepCopy())
    return true
  }

  private fun replaceNavigation(document: JSONObject, change: JSONObject): Boolean {
    val navigation = change.getJSONObject("value")
    val selectedTabId = navigation.strictNonEmptyString("selectedTabId") ?: return false
    val previousTabs = document.getJSONArray("tabs")
    val sectionsByTabId = mutableMapOf<String, JSONArray>()
    repeat(previousTabs.length()) { index ->
      val tab = previousTabs.getJSONObject(index)
      val tabId = tab.strictNonEmptyString("id") ?: return false
      if (sectionsByTabId.put(tabId, tab.getJSONArray("sections").deepCopy()) != null) {
        return false
      }
    }

    val navigationTabs = navigation.getJSONArray("tabs")
    val nextTabs = JSONArray()
    repeat(navigationTabs.length()) { index ->
      val navigationTab = navigationTabs.getJSONObject(index).deepCopy()
      val tabId = navigationTab.strictNonEmptyString("id") ?: return false
      if (navigationTab.has("sections")) return false
      when (navigationTab.strictTabDestination() ?: return false) {
        HomeContainerTabDestination.INLINE -> {
          if (navigationTab.has("handoffCommandId")) return false
          navigationTab.put("sections", sectionsByTabId[tabId] ?: JSONArray())
        }
        HomeContainerTabDestination.HANDOFF -> {
          navigationTab.strictNonEmptyString("handoffCommandId") ?: return false
          navigationTab.put("sections", JSONArray())
        }
      }
      nextTabs.put(navigationTab)
    }
    document
      .put("selectedTabId", selectedTabId)
      .put("tabs", nextTabs)
    return true
  }

  private fun replaceSection(document: JSONObject, change: JSONObject): Boolean {
    val tabId = change.strictNonEmptyString("tabId") ?: return false
    val sectionId = change.strictNonEmptyString("sectionId") ?: return false
    val insertionIndexValue = change.strictSafeInteger("index") ?: return false
    if (insertionIndexValue > Int.MAX_VALUE) return false
    val insertionIndex = insertionIndexValue.toInt()
    val replacement = change.getJSONObject("value")
    if (replacement.strictNonEmptyString("id") != sectionId) return false
    val tab = document.findTab(tabId) ?: return false
    if (tab.strictTabDestination() != HomeContainerTabDestination.INLINE) return false
    val previousSections = tab.getJSONArray("sections")
    val retainedSections = mutableListOf<JSONObject>()
    repeat(previousSections.length()) { index ->
      val section = previousSections.getJSONObject(index)
      if (section.getString("id") != sectionId) {
        retainedSections += section.deepCopy()
      }
    }
    if (insertionIndex < 0 || insertionIndex > retainedSections.size) return false
    retainedSections.add(insertionIndex, replacement.deepCopy())
    tab.put("sections", retainedSections.toJsonArray())
    return true
  }

  private fun removeSection(document: JSONObject, change: JSONObject): Boolean {
    val tabId = change.strictNonEmptyString("tabId") ?: return false
    val sectionId = change.strictNonEmptyString("sectionId") ?: return false
    val tab = document.findTab(tabId) ?: return false
    if (tab.strictTabDestination() != HomeContainerTabDestination.INLINE) return false
    val previousSections = tab.getJSONArray("sections")
    val retainedSections = mutableListOf<JSONObject>()
    repeat(previousSections.length()) { index ->
      val section = previousSections.getJSONObject(index)
      if (section.getString("id") != sectionId) {
        retainedSections += section.deepCopy()
      }
    }
    tab.put("sections", retainedSections.toJsonArray())
    return true
  }

  private fun replaceSurface(document: JSONObject, change: JSONObject): Boolean {
    document.put("theme", change.getJSONObject("value").deepCopy())
    return true
  }

  private fun needSnapshot(
    owner: HomeContainerProtocolV2Owner? = null,
    current: HomeContainerProtocolV2State?,
    reason: HomeContainerProtocolV2NeedSnapshotReason =
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
  ): HomeContainerProtocolV2ApplyOutcome.NeedSnapshot =
    HomeContainerProtocolV2ApplyOutcome.NeedSnapshot(owner, current?.revision, reason)
}

internal object HomeContainerProtocolV2Intent {
  fun action(
    owner: HomeContainerProtocolV2Owner,
    renderedRevision: Long,
    commandId: String,
    itemId: String,
  ): String = encode(
    owner = owner,
    renderedRevision = renderedRevision,
    payload = JSONObject()
      .put("kind", "action")
      .put("commandId", commandId)
      .put("itemId", itemId),
  )

  fun refresh(
    owner: HomeContainerProtocolV2Owner,
    renderedRevision: Long,
    tabId: String,
    requestId: String,
  ): String = encode(
    owner = owner,
    renderedRevision = renderedRevision,
    payload = JSONObject()
      .put("kind", "refresh")
      .put("tabId", tabId)
      .put("requestId", requestId),
  )

  fun selectTab(
    owner: HomeContainerProtocolV2Owner,
    renderedRevision: Long,
    tabId: String,
  ): String = encode(
    owner = owner,
    renderedRevision = renderedRevision,
    payload = JSONObject()
      .put("kind", "selectTab")
      .put("tabId", tabId),
  )

  fun handoff(
    owner: HomeContainerProtocolV2Owner,
    renderedRevision: Long,
    tabId: String,
    commandId: String,
  ): String = encode(
    owner = owner,
    renderedRevision = renderedRevision,
    payload = JSONObject()
      .put("kind", "handoff")
      .put("tabId", tabId)
      .put("commandId", commandId),
  )

  private fun encode(
    owner: HomeContainerProtocolV2Owner,
    renderedRevision: Long,
    payload: JSONObject,
  ): String = JSONObject()
    .put("intentId", java.util.UUID.randomUUID().toString())
    .put("owner", owner.toJson())
    .put("renderedRevision", renderedRevision)
    .put("intent", payload)
    .toString()
}

private fun JSONObject.protocolOwner(): HomeContainerProtocolV2Owner? =
  runCatching {
    val value = getJSONObject("owner")
    HomeContainerProtocolV2Owner(
      scopeKey = value.strictNonEmptyString("scopeKey") ?: error("Invalid scope key"),
      sessionId = value.strictNonEmptyString("sessionId") ?: error("Invalid session id"),
    )
  }.getOrNull()

private fun JSONObject.strictNonEmptyString(key: String): String? =
  opt(key).let { value ->
    if (value is String && value.isNotEmpty()) value else null
  }

private fun JSONObject.strictTabDestination(): HomeContainerTabDestination? =
  strictNonEmptyString("destination")?.let { value ->
    runCatching { HomeContainerTabDestination.fromWireValue(value) }.getOrNull()
  }

private fun JSONObject.strictSafeInteger(key: String): Long? {
  val value = opt(key)
  if (value !is Number) return null
  val decimal = runCatching { BigDecimal(value.toString()) }.getOrNull() ?: return null
  if (decimal < BigDecimal.ZERO || decimal > MAXIMUM_SAFE_JSON_INTEGER_DECIMAL) {
    return null
  }
  return runCatching { decimal.longValueExact() }.getOrNull()
}

private fun JSONObject.validatedSnapshot(): HomeContainerSnapshot? {
  if (strictSafeInteger("schemaVersion") != HOME_CONTAINER_BUSINESS_SCHEMA_VERSION.toLong()) return null
  strictSafeInteger("revision") ?: return null
  val tabs = runCatching { getJSONArray("tabs") }.getOrNull() ?: return null
  if (tabs.length() == 0) return null
  val selectedTabId = strictNonEmptyString("selectedTabId") ?: return null
  val tabIds = mutableSetOf<String>()
  var selectedInlineTabExists = false
  repeat(tabs.length()) { tabIndex ->
    val tab = runCatching { tabs.getJSONObject(tabIndex) }.getOrNull() ?: return null
    val tabId = tab.strictNonEmptyString("id") ?: return null
    if (!tabIds.add(tabId)) return null
    val destination = tab.strictTabDestination() ?: return null
    val sections = runCatching { tab.getJSONArray("sections") }.getOrNull() ?: return null
    when (destination) {
      HomeContainerTabDestination.INLINE -> {
        if (tab.has("handoffCommandId")) return null
        if (tabId == selectedTabId) selectedInlineTabExists = true
      }
      HomeContainerTabDestination.HANDOFF -> {
        tab.strictNonEmptyString("handoffCommandId") ?: return null
        if (sections.length() != 0) return null
      }
    }
    val sectionIds = mutableSetOf<String>()
    repeat(sections.length()) { sectionIndex ->
      val section = runCatching { sections.getJSONObject(sectionIndex) }.getOrNull() ?: return null
      val sectionId = section.strictNonEmptyString("id") ?: return null
      if (!sectionIds.add(sectionId)) return null
    }
  }
  if (!selectedInlineTabExists) return null
  return runCatching { HomeContainerJson.parseSnapshot(toString()) }
    .getOrNull()
    ?.takeIf(HomeContainerSnapshot::hasValidTabInvariants)
}

private fun JSONObject.findTab(tabId: String): JSONObject? {
  val tabs = getJSONArray("tabs")
  repeat(tabs.length()) { index ->
    val tab = tabs.getJSONObject(index)
    if (tab.getString("id") == tabId) return tab
  }
  return null
}

private fun JSONObject.deepCopy(): JSONObject = JSONObject(toString())

private fun JSONArray.deepCopy(): JSONArray = JSONArray(toString())

private fun List<JSONObject>.toJsonArray(): JSONArray = JSONArray().also { result ->
  forEach(result::put)
}
