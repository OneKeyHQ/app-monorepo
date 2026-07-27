package com.margelo.nitro.onekeynativecomponents

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val HOME_CONTAINER_PROTOCOL_V3_VERSION = 3L
private const val HOME_CONTAINER_PROTOCOL_MAX_SAFE_INTEGER = 9_007_199_254_740_991L
private val HOME_CONTAINER_PROTOCOL_V3_TAB_IDS = listOf(
  "portfolio",
  "perps",
  "defi",
  "nft",
  "history",
)
private val HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS = listOf(
  "portfolio",
  "perps",
  "defi",
  "nft",
  "history",
  "market",
)

internal data class HomeContainerOwner(
  val scopeKey: String,
  val sessionId: String,
) {
  val isValid: Boolean
    get() = scopeKey.isNotEmpty() && sessionId.isNotEmpty()

  fun toJson(): JSONObject = JSONObject()
    .put("scopeKey", scopeKey)
    .put("sessionId", sessionId)
}

internal data class HomeContainerProtocolV3Identity(
  val owner: HomeContainerOwner,
  val storeCommitId: Long,
)

internal data class HomeContainerProtocolV3State(
  val identity: HomeContainerProtocolV3Identity,
  val presentationRevisions: JSONObject,
  val authorityRevisions: JSONObject,
  val snapshot: HomeContainerSnapshot,
)

internal data class HomeContainerRenderPlan(
  val isFullSnapshot: Boolean,
  val shouldBindHeader: Boolean,
  val shouldReconcileNavigation: Boolean,
  val sectionTabIds: Set<String>,
  val shouldApplySurface: Boolean,
) {
  companion object {
    val FULL_SNAPSHOT = HomeContainerRenderPlan(
      isFullSnapshot = true,
      shouldBindHeader = true,
      shouldReconcileNavigation = true,
      sectionTabIds = emptySet(),
      shouldApplySurface = true,
    )

    fun domains(domains: List<String>) = HomeContainerRenderPlan(
      isFullSnapshot = false,
      shouldBindHeader = "shell" in domains,
      shouldReconcileNavigation = "navigation" in domains,
      sectionTabIds = domains
        .filter { it.startsWith("section:") }
        .mapTo(mutableSetOf()) { it.removePrefix("section:") },
      shouldApplySurface = "surface" in domains,
    )
  }
}

internal sealed class HomeContainerProtocolV3ApplyOutcome {
  data class Applied(
    val state: HomeContainerProtocolV3State,
    val renderPlan: HomeContainerRenderPlan,
  ) : HomeContainerProtocolV3ApplyOutcome()

  data object Ignored : HomeContainerProtocolV3ApplyOutcome()

  data class Invalid(val code: String) : HomeContainerProtocolV3ApplyOutcome()
}

internal object HomeContainerProtocolV3Transaction {
  fun applySnapshot(
    json: String,
    current: HomeContainerProtocolV3State? = null,
  ): HomeContainerProtocolV3ApplyOutcome {
    val root = runCatching { JSONObject(json) }.getOrElse {
      return invalid("snapshot_decode_failed")
    }
    if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      return invalid("unsupported_protocol")
    }
    val identity = root.optJSONObject("identity")?.protocolIdentity()
      ?: return invalid("invalid_snapshot")
    val presentation = root.optJSONObject("presentationRevisions")
      ?.takeIf(JSONObject::validPresentationRevisions)
      ?: return invalid("invalid_snapshot")
    val authority = root.optJSONObject("authorityRevisions")
      ?.takeIf(JSONObject::validAuthorityRevisions)
      ?: return invalid("invalid_snapshot")
    if (root.optString("kind") != "snapshot") {
      return invalid("invalid_snapshot")
    }
    val snapshot = runCatching {
      HomeContainerJson.parseSnapshotPayload(
        root.getJSONObject("payload"),
        identity.storeCommitId,
      )
    }.getOrElse {
      return invalid("invalid_snapshot")
    }
    if (current?.identity?.owner == identity.owner) {
      return applyDomains(
        snapshotAsDomains(root, identity, presentation, authority, snapshot),
        current,
      )
    }
    return HomeContainerProtocolV3ApplyOutcome.Applied(
      state = HomeContainerProtocolV3State(
        identity = identity,
        presentationRevisions = JSONObject(presentation.toString()),
        authorityRevisions = JSONObject(authority.toString()),
        snapshot = snapshot,
      ),
      renderPlan = HomeContainerRenderPlan.FULL_SNAPSHOT,
    )
  }

  fun applyDomains(
    json: String,
    current: HomeContainerProtocolV3State?,
  ): HomeContainerProtocolV3ApplyOutcome =
    runCatching { JSONObject(json) }
      .fold(
        onSuccess = { applyDomains(it, current) },
        onFailure = { invalid("domains_decode_failed") },
      )

  fun validateIntent(json: String, current: HomeContainerProtocolV3State): Boolean =
    runCatching {
      val root = JSONObject(json)
      if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
        return@runCatching false
      }
      val owner = root.optJSONObject("owner")?.owner() ?: return@runCatching false
      val authority = root.getJSONObject("authority")
      val intent = root.getJSONObject("intent")
      val revision = authority.safeRevision("revision") ?: return@runCatching false
      if (owner != current.identity.owner || root.optString("intentId").isEmpty()) {
        return@runCatching false
      }
      when (intent.optString("kind")) {
        "selectTab", "handoff" ->
          authority.optString("kind") == "tabApplicability" &&
            revision == current.authorityRevisions.safeRevision("tabApplicability")
        "refresh" -> {
          val sectionId = authority.optString("sectionId")
          authority.optString("kind") == "sectionCommands" &&
            intent.optString("tabId") == sectionId &&
            revision == current.authorityRevisions
              .getJSONObject("sectionCommands")
              .safeRevision(sectionId)
        }
        "action" -> when (authority.optString("kind")) {
          "shellCommands" ->
            revision == current.authorityRevisions.safeRevision("shellCommands")
          "sectionCommands" -> {
            val sectionId = authority.optString("sectionId")
            revision == current.authorityRevisions
              .getJSONObject("sectionCommands")
              .safeRevision(sectionId)
          }
          else -> false
        }
        else -> false
      }
    }.getOrDefault(false)

  fun actionIntent(
    state: HomeContainerProtocolV3State,
    commandId: String,
    itemId: String,
    sectionId: String,
  ): String? {
    val authority = if (state.snapshot.header.containsCommand(commandId)) {
      JSONObject()
        .put("kind", "shellCommands")
        .put(
          "revision",
          state.authorityRevisions.safeRevision("shellCommands") ?: return null,
        )
    } else {
      JSONObject()
        .put("kind", "sectionCommands")
        .put("sectionId", sectionId)
        .put(
          "revision",
          state.authorityRevisions
            .getJSONObject("sectionCommands")
            .safeRevision(sectionId) ?: return null,
        )
    }
    return buildIntent(
      state,
      authority,
      JSONObject()
        .put("kind", "action")
        .put("commandId", commandId)
        .put("itemId", itemId),
    )
  }

  fun refreshIntent(
    state: HomeContainerProtocolV3State,
    tabId: String,
    requestId: String,
  ): String? {
    val revision = state.authorityRevisions
      .getJSONObject("sectionCommands")
      .safeRevision(tabId) ?: return null
    return buildIntent(
      state,
      JSONObject()
        .put("kind", "sectionCommands")
        .put("sectionId", tabId)
        .put("revision", revision),
      JSONObject()
        .put("kind", "refresh")
        .put("tabId", tabId)
        .put("requestId", requestId),
    )
  }

  fun selectTabIntent(state: HomeContainerProtocolV3State, tabId: String): String? =
    buildTabIntent(state, JSONObject().put("kind", "selectTab").put("tabId", tabId))

  fun handoffIntent(
    state: HomeContainerProtocolV3State,
    tabId: String,
    commandId: String,
  ): String? = buildTabIntent(
    state,
    JSONObject()
      .put("kind", "handoff")
      .put("tabId", tabId)
      .put("commandId", commandId),
  )

  private fun applyDomains(
    root: JSONObject,
    current: HomeContainerProtocolV3State?,
  ): HomeContainerProtocolV3ApplyOutcome {
    if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      return invalid("unsupported_protocol")
    }
    val identity = root.optJSONObject("identity")?.protocolIdentity()
      ?: return invalid("invalid_domains")
    if (root.optString("kind") != "domains" || current == null) {
      return invalid("invalid_domains")
    }
    if (identity.owner != current.identity.owner) {
      return HomeContainerProtocolV3ApplyOutcome.Ignored
    }
    val updates = root.optJSONArray("updates") ?: return invalid("invalid_domains")
    val domainKeys = mutableSetOf<String>()
    var snapshot = current.snapshot
    val presentation = JSONObject(current.presentationRevisions.toString())
    val authority = JSONObject(current.authorityRevisions.toString())
    val appliedDomains = mutableListOf<String>()

    repeat(updates.length()) { index ->
      val update = updates.optJSONObject(index) ?: return invalid("invalid_domain")
      val kind = update.optString("kind")
      val domainKey = if (kind == "section") {
        "section:${update.optString("tabId")}"
      } else {
        kind
      }
      if (!domainKeys.add(domainKey)) {
        return invalid("duplicate_domain")
      }
      val revision = update.safeRevision("presentationRevision")
        ?: return invalid("invalid_domain_revision")
      when (kind) {
        "shell" -> {
          if (revision <= (presentation.safeRevision("shell") ?: 0)) return@repeat
          val commandRevision = update.safeRevision("commandRevision")
            ?: return invalid("invalid_shell_revision")
          if (commandRevision < (authority.safeRevision("shellCommands") ?: 0)) {
            return invalid("regressed_shell_authority")
          }
          snapshot = snapshot.copy(
            header = HomeContainerJson.parseHeader(update.getJSONObject("value")),
          )
          presentation.put("shell", revision)
          authority.put("shellCommands", commandRevision)
        }
        "navigation" -> {
          if (revision <= (presentation.safeRevision("navigation") ?: 0)) return@repeat
          val applicabilityRevision = update.safeRevision("applicabilityRevision")
            ?: return invalid("invalid_navigation_revision")
          if (applicabilityRevision < (authority.safeRevision("tabApplicability") ?: 0)) {
            return invalid("regressed_navigation_authority")
          }
          val value = update.getJSONObject("value")
          val sectionsByTab = snapshot.tabs.associate { it.id to it.sections }
          val tabs = HomeContainerJson.parseNavigationTabs(value.getJSONArray("tabs"))
            .map { tab ->
              if (tab.destination == HomeContainerTabDestination.INLINE) {
                tab.copy(sections = sectionsByTab[tab.id].orEmpty())
              } else {
                tab
              }
            }
          val next = snapshot.copy(
            selectedTabId = value.getString("selectedTabId"),
            tabs = tabs,
          )
          if (!next.hasValidTabInvariants()) return invalid("invalid_navigation")
          snapshot = next
          presentation.put("navigation", revision)
          authority.put("tabApplicability", applicabilityRevision)
        }
        "section" -> {
          val tabId = update.optString("tabId")
          if (tabId !in HOME_CONTAINER_PROTOCOL_V3_TAB_IDS) {
            return invalid("invalid_section")
          }
          val sectionRevisions = presentation.getJSONObject("sections")
          val currentRevision = sectionRevisions.safeRevision(tabId) ?: 0
          if (revision <= currentRevision) return@repeat
          val commandRevisions = update.optJSONObject("commandRevisions")
            ?.takeIf(JSONObject::hasAllSectionRevisions)
            ?: return invalid("invalid_section_revision")
          val currentCommands = authority.getJSONObject("sectionCommands")
          var replaced = false
          val sections = HomeContainerJson.parseSections(update.getJSONArray("value"))
          val tabs = snapshot.tabs.map { tab ->
            if (tab.id == tabId && tab.destination == HomeContainerTabDestination.INLINE) {
              replaced = true
              tab.copy(sections = sections)
            } else {
              tab
            }
          }
          if (!replaced) return invalid("invalid_section")
          snapshot = snapshot.copy(tabs = tabs)
          sectionRevisions.put(tabId, revision)
          authority.put(
            "sectionCommands",
            JSONObject().also { merged ->
              HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.forEach { sectionId ->
                merged.put(
                  sectionId,
                  maxOf(
                    currentCommands.safeRevision(sectionId) ?: 0,
                    commandRevisions.safeRevision(sectionId) ?: 0,
                  ),
                )
              }
            },
          )
        }
        "surface" -> {
          if (revision <= (presentation.safeRevision("surface") ?: 0)) return@repeat
          snapshot = snapshot.copy(
            theme = HomeContainerJson.parseTheme(update.getJSONObject("value")),
          )
          presentation.put("surface", revision)
        }
        else -> return invalid("invalid_domain")
      }
      appliedDomains += domainKey
    }
    if (appliedDomains.isEmpty()) {
      return HomeContainerProtocolV3ApplyOutcome.Ignored
    }
    if (!snapshot.hasValidTabInvariants()) {
      return invalid("invalid_result")
    }
    snapshot = snapshot.copy(
      revision = maxOf(snapshot.revision, identity.storeCommitId),
    )
    return HomeContainerProtocolV3ApplyOutcome.Applied(
      state = HomeContainerProtocolV3State(
        identity = HomeContainerProtocolV3Identity(
          owner = current.identity.owner,
          storeCommitId = maxOf(
            current.identity.storeCommitId,
            identity.storeCommitId,
          ),
        ),
        presentationRevisions = presentation,
        authorityRevisions = authority,
        snapshot = snapshot,
      ),
      renderPlan = HomeContainerRenderPlan.domains(appliedDomains),
    )
  }

  private fun snapshotAsDomains(
    root: JSONObject,
    identity: HomeContainerProtocolV3Identity,
    presentation: JSONObject,
    authority: JSONObject,
    snapshot: HomeContainerSnapshot,
  ): JSONObject {
    val updates = JSONArray()
      .put(
        JSONObject()
          .put("kind", "shell")
          .put("presentationRevision", presentation.getLong("shell"))
          .put("commandRevision", authority.getLong("shellCommands"))
          .put("value", root.getJSONObject("payload").getJSONObject("header")),
      )
      .put(
        JSONObject()
          .put("kind", "navigation")
          .put("presentationRevision", presentation.getLong("navigation"))
          .put("applicabilityRevision", authority.getLong("tabApplicability"))
          .put(
            "value",
            JSONObject()
              .put("selectedTabId", snapshot.selectedTabId)
              .put(
                "tabs",
                JSONArray(root.getJSONObject("payload").getJSONArray("tabs").toString())
                  .also { tabs ->
                    repeat(tabs.length()) { index ->
                      tabs.getJSONObject(index).remove("sections")
                    }
                  },
              ),
          ),
      )
      .put(
        JSONObject()
          .put("kind", "surface")
          .put("presentationRevision", presentation.getLong("surface"))
          .put("value", root.getJSONObject("payload").getJSONObject("theme")),
      )
    snapshot.inlineTabs().forEach { tab ->
      val tabJson = root.getJSONObject("payload").getJSONArray("tabs")
        .objects()
        .first { it.getString("id") == tab.id }
      updates.put(
        JSONObject()
          .put("kind", "section")
          .put("tabId", tab.id)
          .put(
            "presentationRevision",
            presentation.getJSONObject("sections").getLong(tab.id),
          )
          .put("commandRevisions", authority.getJSONObject("sectionCommands"))
          .put("value", tabJson.getJSONArray("sections")),
      )
    }
    return JSONObject()
      .put("kind", "domains")
      .put("protocolVersion", HOME_CONTAINER_PROTOCOL_V3_VERSION)
      .put(
        "identity",
        identity.owner.toJson().put("storeCommitId", identity.storeCommitId),
      )
      .put("updates", updates)
  }

  private fun buildTabIntent(
    state: HomeContainerProtocolV3State,
    intent: JSONObject,
  ): String? {
    val revision = state.authorityRevisions.safeRevision("tabApplicability")
      ?: return null
    return buildIntent(
      state,
      JSONObject()
        .put("kind", "tabApplicability")
        .put("revision", revision),
      intent,
    )
  }

  private fun buildIntent(
    state: HomeContainerProtocolV3State,
    authority: JSONObject,
    intent: JSONObject,
  ): String? {
    val value = JSONObject()
      .put("protocolVersion", HOME_CONTAINER_PROTOCOL_V3_VERSION)
      .put("intentId", UUID.randomUUID().toString())
      .put("owner", state.identity.owner.toJson())
      .put("authority", authority)
      .put("intent", intent)
      .toString()
    return value.takeIf { validateIntent(it, state) }
  }

  private fun invalid(code: String) =
    HomeContainerProtocolV3ApplyOutcome.Invalid(code)
}

private fun HomeContainerHeader.containsCommand(commandId: String): Boolean =
  accountActionId == commandId ||
    copyActionId == commandId ||
    networkActionId == commandId ||
    balanceActionId == commandId ||
    actions.any { it.actionId == commandId } ||
    balanceActions.any { it.actionId == commandId } ||
    banners.any { it.actionId == commandId || it.dismissActionId == commandId }

private fun JSONObject.protocolIdentity(): HomeContainerProtocolV3Identity? {
  val owner = owner() ?: return null
  val storeCommitId = safeRevision("storeCommitId") ?: return null
  return HomeContainerProtocolV3Identity(owner, storeCommitId)
}

private fun JSONObject.owner(): HomeContainerOwner? {
  val scopeKey = optString("scopeKey")
  val sessionId = optString("sessionId")
  return if (scopeKey.isNotEmpty() && sessionId.isNotEmpty()) {
    HomeContainerOwner(scopeKey, sessionId)
  } else {
    null
  }
}

private fun JSONObject.safeRevision(key: String): Long? {
  if (!has(key) || isNull(key)) return null
  val number = when (val value = get(key)) {
    is Int -> value.toLong()
    is Long -> value
    else -> return null
  }
  return number.takeIf { it in 0..HOME_CONTAINER_PROTOCOL_MAX_SAFE_INTEGER }
}

private fun JSONObject.validPresentationRevisions(): Boolean =
  safeRevision("shell") != null &&
    safeRevision("navigation") != null &&
    safeRevision("surface") != null &&
    optJSONObject("sections")?.hasAllTabRevisions() == true

private fun JSONObject.validAuthorityRevisions(): Boolean =
  safeRevision("shellCommands") != null &&
    safeRevision("tabApplicability") != null &&
    optJSONObject("sectionCommands")?.hasAllSectionRevisions() == true

private fun JSONObject.hasAllSectionRevisions(): Boolean =
  keys().asSequence().toSet() == HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.toSet() &&
    HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.all { safeRevision(it) != null }

private fun JSONObject.hasAllTabRevisions(): Boolean =
  keys().asSequence().toSet() == HOME_CONTAINER_PROTOCOL_V3_TAB_IDS.toSet() &&
    HOME_CONTAINER_PROTOCOL_V3_TAB_IDS.all { safeRevision(it) != null }

private fun JSONArray.objects(): Sequence<JSONObject> =
  (0 until length()).asSequence().map(::getJSONObject)
