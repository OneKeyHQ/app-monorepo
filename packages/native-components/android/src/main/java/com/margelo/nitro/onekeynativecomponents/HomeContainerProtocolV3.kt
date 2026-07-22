package com.margelo.nitro.onekeynativecomponents

import org.json.JSONObject
import java.util.UUID

private const val HOME_CONTAINER_PROTOCOL_V3_VERSION = 3L
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
private val HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS = listOf(
  "portfolio",
  "perps",
  "defi",
  "nft",
  "history",
  "market",
)

internal data class HomeContainerProtocolV3Identity(
  val owner: HomeContainerProtocolV2Owner,
  val storeCommitId: Long,
)

internal data class HomeContainerProtocolV3State(
  val identity: HomeContainerProtocolV3Identity,
  val transportRevision: Long,
  val presentationRevisions: JSONObject,
  val authorityRevisions: JSONObject,
  val slotRevisions: Map<String, Long>,
  val legacyState: HomeContainerProtocolV2State,
)

internal data class HomeContainerProtocolV3MountedSlotMetadata(
  val slotId: String,
  val owner: HomeContainerProtocolV2Owner,
  val slotRevision: Long,
  val producedByStoreCommitId: Long,
) {
  val isValid: Boolean
    get() = slotId.isNotEmpty() &&
      owner.isValid &&
      slotRevision in 0..MAX_SAFE_INTEGER &&
      producedByStoreCommitId in 0..MAX_SAFE_INTEGER
}

internal fun homeContainerProtocolV3AvailableSlotRevisions(
  owner: HomeContainerProtocolV2Owner,
  mountedSlots: List<HomeContainerProtocolV3MountedSlotMetadata>,
): Map<String, Long> = mountedSlots
  .filter { it.isValid && it.owner == owner }
  .groupBy(HomeContainerProtocolV3MountedSlotMetadata::slotId)
  .mapNotNull { (slotId, slots) ->
    slots.singleOrNull()?.let { slotId to it.slotRevision }
  }
  .toMap()

internal enum class HomeContainerProtocolV3NeedSnapshotReason {
  INVALID_INVARIANT,
  OWNER_MISMATCH,
  REVISION_GAP,
  SLOT_REVISION_GAP,
  UNSUPPORTED_PROTOCOL,
}

internal sealed class HomeContainerProtocolV3ApplyOutcome {
  data class Applied(
    val state: HomeContainerProtocolV3State,
    val renderPlan: HomeContainerProtocolV2RenderPlan,
  ) : HomeContainerProtocolV3ApplyOutcome()

  data class Duplicate(val state: HomeContainerProtocolV3State) :
    HomeContainerProtocolV3ApplyOutcome()

  data class NeedSnapshot(val reason: HomeContainerProtocolV3NeedSnapshotReason) :
    HomeContainerProtocolV3ApplyOutcome()
}

internal object HomeContainerProtocolV3Transaction {
  fun isProtocolPayload(json: String, expectedKind: String): Boolean =
    runCatching {
      val root = JSONObject(json)
      root.safeRevision("protocolVersion") == HOME_CONTAINER_PROTOCOL_V3_VERSION &&
        root.optString("kind") == expectedKind
    }.getOrDefault(false)

  fun applySnapshot(json: String): HomeContainerProtocolV3ApplyOutcome {
    val root = runCatching { JSONObject(json) }.getOrElse {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.UNSUPPORTED_PROTOCOL)
    }
    val identity = root.optJSONObject("identity")?.protocolV3Identity()
    val transportRevision = root.safeRevision("transportRevision")
    val presentation = root.optJSONObject("presentationRevisions")
    val authority = root.optJSONObject("authorityRevisions")
    val slots = root.optJSONObject("slotRevisions")?.revisionMap()
    if (
      root.optString("kind") != "snapshot" ||
      identity == null ||
      transportRevision == null ||
      presentation?.validPresentationRevisions() != true ||
      authority?.validAuthorityRevisions() != true ||
      slots == null
    ) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    val legacyJson = runCatching {
      JSONObject()
        .put("kind", "snapshot")
        .put("protocolVersion", 2)
        .put("schemaVersion", 2)
        .put("owner", identity.owner.toJson())
        .put("revision", transportRevision)
        .put("payload", JSONObject(root.getJSONObject("payload").toString()))
        .toString()
    }.getOrElse {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    return when (
      val outcome = HomeContainerProtocolV2Transaction.applySnapshot(
        legacyJson,
        current = null,
      )
    ) {
      is HomeContainerProtocolV2ApplyOutcome.Applied ->
        HomeContainerProtocolV3ApplyOutcome.Applied(
          state = HomeContainerProtocolV3State(
            identity = identity,
            transportRevision = transportRevision,
            presentationRevisions = JSONObject(presentation.toString()),
            authorityRevisions = JSONObject(authority.toString()),
            slotRevisions = slots,
            legacyState = outcome.state,
          ),
          renderPlan = outcome.renderPlan,
        )
      else -> needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
  }

  fun applyPatch(
    json: String,
    current: HomeContainerProtocolV3State?,
    availableSlotRevisions: Map<String, Long>,
  ): HomeContainerProtocolV3ApplyOutcome {
    val root = runCatching { JSONObject(json) }.getOrElse {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.UNSUPPORTED_PROTOCOL)
    }
    if (current == null) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.REVISION_GAP)
    }
    val identity = root.optJSONObject("identity")?.protocolV3Identity()
    if (identity?.owner != current.identity.owner) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.OWNER_MISMATCH)
    }
    val baseRevision = root.safeRevision("baseTransportRevision")
    val transportRevision = root.safeRevision("transportRevision")
    val presentation = root.optJSONObject("presentationRevisions")
    val authority = root.optJSONObject("authorityRevisions")
    val requiredSlots = root.optJSONObject("requiredSlotRevisions")?.revisionMap()
    if (
      root.optString("kind") != "patch" ||
      identity.storeCommitId < current.identity.storeCommitId ||
      baseRevision == null ||
      transportRevision == null ||
      presentation?.validPresentationRevisions() != true ||
      authority?.validAuthorityRevisions() != true ||
      requiredSlots == null ||
      !presentation.revisionsDoNotRegress(
        current.presentationRevisions,
        shellKey = "shell",
        navigationKey = "navigation",
        sectionKey = "sections",
      ) ||
      !authority.revisionsDoNotRegress(
        current.authorityRevisions,
        shellKey = "shellCommands",
        navigationKey = "tabApplicability",
        sectionKey = "sectionCommands",
      )
    ) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    if (
      transportRevision == current.transportRevision &&
      baseRevision < transportRevision
    ) {
      return HomeContainerProtocolV3ApplyOutcome.Duplicate(current)
    }
    if (
      baseRevision != current.transportRevision ||
      transportRevision != current.transportRevision + 1
    ) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.REVISION_GAP)
    }
    if (requiredSlots.any { (slotId, revision) ->
        availableSlotRevisions[slotId] != revision
      }
    ) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.SLOT_REVISION_GAP)
    }
    if (availableSlotRevisions.any { (slotId, revision) ->
        current.slotRevisions[slotId]?.let { revision < it } == true
      }
    ) {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    val legacyJson = runCatching {
      JSONObject()
        .put("kind", "patch")
        .put("protocolVersion", 2)
        .put("schemaVersion", 2)
        .put("owner", identity.owner.toJson())
        .put("baseRevision", baseRevision)
        .put("revision", transportRevision)
        .put("changes", root.getJSONArray("changes"))
        .toString()
    }.getOrElse {
      return needSnapshot(HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT)
    }
    return when (
      val outcome = HomeContainerProtocolV2Transaction.applyPatch(
        legacyJson,
        current.legacyState,
      )
    ) {
      is HomeContainerProtocolV2ApplyOutcome.Applied ->
        HomeContainerProtocolV3ApplyOutcome.Applied(
          state = HomeContainerProtocolV3State(
            identity = identity,
            transportRevision = transportRevision,
            presentationRevisions = JSONObject(presentation.toString()),
            authorityRevisions = JSONObject(authority.toString()),
            slotRevisions = current.slotRevisions + requiredSlots,
            legacyState = outcome.state,
          ),
          renderPlan = outcome.renderPlan,
        )
      is HomeContainerProtocolV2ApplyOutcome.Duplicate ->
        HomeContainerProtocolV3ApplyOutcome.Duplicate(current)
      is HomeContainerProtocolV2ApplyOutcome.NeedSnapshot -> needSnapshot(
        when (outcome.reason) {
          HomeContainerProtocolV2NeedSnapshotReason.OWNER_MISMATCH ->
            HomeContainerProtocolV3NeedSnapshotReason.OWNER_MISMATCH
          HomeContainerProtocolV2NeedSnapshotReason.REVISION_GAP ->
            HomeContainerProtocolV3NeedSnapshotReason.REVISION_GAP
          else -> HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT
        },
      )
    }
  }

  fun validateIntent(json: String, current: HomeContainerProtocolV3State): Boolean =
    runCatching {
      val root = JSONObject(json)
      if (root.safeRevision("protocolVersion") != HOME_CONTAINER_PROTOCOL_V3_VERSION) {
        return@runCatching false
      }
      val owner = root.optJSONObject("owner")?.protocolV2Owner() ?: return@runCatching false
      val intentId = root.optString("intentId")
      val authority = root.getJSONObject("authority")
      val intent = root.getJSONObject("intent")
      val authorityKind = authority.optString("kind")
      val revision = authority.safeRevision("revision") ?: return@runCatching false
      if (owner != current.identity.owner || intentId.isEmpty()) {
        return@runCatching false
      }
      when (intent.optString("kind")) {
        "selectTab", "handoff" ->
          authorityKind == "tabApplicability" &&
            intent.optString("tabId").isNotEmpty() &&
            revision == current.authorityRevisions.safeRevision("tabApplicability")
        "refresh" -> {
          val sectionId = authority.optString("sectionId")
          authorityKind == "sectionCommands" &&
            HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.contains(sectionId) &&
            intent.optString("tabId") == sectionId &&
            intent.optString("requestId").isNotEmpty() &&
            revision == current.authorityRevisions
              .getJSONObject("sectionCommands")
              .safeRevision(sectionId)
        }
        "action" -> when (authorityKind) {
          "shellCommands" ->
            intent.optString("commandId").isNotEmpty() &&
              revision == current.authorityRevisions.safeRevision("shellCommands")
          "sectionCommands" -> {
            val sectionId = authority.optString("sectionId")
            HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.contains(sectionId) &&
              intent.optString("commandId").isNotEmpty() &&
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
    val isShellCommand = state.legacyState.snapshot.header.containsCommand(commandId)
    val authority = if (isShellCommand) {
      JSONObject()
        .put("kind", "shellCommands")
        .put(
          "revision",
          state.authorityRevisions.safeRevision("shellCommands") ?: return null,
        )
    } else {
      val revision = state.authorityRevisions
        .getJSONObject("sectionCommands")
        .safeRevision(sectionId) ?: return null
      JSONObject()
        .put("kind", "sectionCommands")
        .put("sectionId", sectionId)
        .put("revision", revision)
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

  fun appliedResult(state: HomeContainerProtocolV3State): String =
    transportResult("applied", state)

  fun duplicateResult(state: HomeContainerProtocolV3State): String =
    transportResult("duplicate", state)

  fun needSnapshotResult(
    state: HomeContainerProtocolV3State?,
    reason: HomeContainerProtocolV3NeedSnapshotReason,
  ): String = JSONObject()
    .put("kind", "needSnapshot")
    .apply {
      state?.let {
        put("owner", it.identity.owner.toJson())
        put("currentRevision", it.transportRevision)
      }
    }
    .put("reason", reason.wireValue)
    .toString()

  private fun buildTabIntent(
    state: HomeContainerProtocolV3State,
    intent: JSONObject,
  ): String? {
    val revision = state.authorityRevisions.safeRevision("tabApplicability")
      ?: return null
    return buildIntent(
      state,
      JSONObject().put("kind", "tabApplicability").put("revision", revision),
      intent,
    )
  }

  private fun buildIntent(
    state: HomeContainerProtocolV3State,
    authority: JSONObject,
    intent: JSONObject,
  ): String? {
    val value = JSONObject()
      .put("protocolVersion", 3)
      .put("intentId", UUID.randomUUID().toString())
      .put("owner", state.identity.owner.toJson())
      .put("authority", authority)
      .put("intent", intent)
      .toString()
    return value.takeIf { validateIntent(it, state) }
  }

  private fun transportResult(
    kind: String,
    state: HomeContainerProtocolV3State,
  ): String = JSONObject()
    .put("kind", kind)
    .put("owner", state.identity.owner.toJson())
    .put("revision", state.transportRevision)
    .toString()

  private fun needSnapshot(reason: HomeContainerProtocolV3NeedSnapshotReason) =
    HomeContainerProtocolV3ApplyOutcome.NeedSnapshot(reason)
}

private val HomeContainerProtocolV3NeedSnapshotReason.wireValue: String
  get() = when (this) {
    HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT -> "invalidInvariant"
    HomeContainerProtocolV3NeedSnapshotReason.OWNER_MISMATCH -> "ownerMismatch"
    HomeContainerProtocolV3NeedSnapshotReason.REVISION_GAP -> "revisionGap"
    HomeContainerProtocolV3NeedSnapshotReason.SLOT_REVISION_GAP -> "slotRevisionGap"
    HomeContainerProtocolV3NeedSnapshotReason.UNSUPPORTED_PROTOCOL -> "unsupportedProtocol"
  }

private fun HomeContainerHeader.containsCommand(commandId: String): Boolean =
  accountActionId == commandId ||
    copyActionId == commandId ||
    networkActionId == commandId ||
    balanceActionId == commandId ||
    actions.any { it.actionId == commandId } ||
    balanceActions.orEmpty().any { it.actionId == commandId } ||
    banners.any { it.actionId == commandId || it.dismissActionId == commandId }

private fun JSONObject.protocolV3Identity(): HomeContainerProtocolV3Identity? {
  val owner = protocolV2Owner() ?: return null
  val storeCommitId = safeRevision("storeCommitId") ?: return null
  return HomeContainerProtocolV3Identity(owner, storeCommitId)
}

private fun JSONObject.protocolV2Owner(): HomeContainerProtocolV2Owner? {
  val scopeKey = optString("scopeKey")
  val sessionId = optString("sessionId")
  return if (scopeKey.isNotEmpty() && sessionId.isNotEmpty()) {
    HomeContainerProtocolV2Owner(scopeKey, sessionId)
  } else {
    null
  }
}

private fun JSONObject.safeRevision(key: String): Long? {
  if (!has(key) || isNull(key)) return null
  val value = get(key)
  val number = when (value) {
    is Int -> value.toLong()
    is Long -> value
    else -> return null
  }
  return number.takeIf { it in 0..MAX_SAFE_INTEGER }
}

private fun JSONObject.revisionMap(): Map<String, Long>? = runCatching {
  keys().asSequence().associateWith { key ->
    safeRevision(key) ?: error("Invalid revision")
  }
}.getOrNull()

private fun JSONObject.validPresentationRevisions(): Boolean =
  safeRevision("shell") != null &&
    safeRevision("navigation") != null &&
    optJSONObject("sections")?.hasAllSectionRevisions() == true

private fun JSONObject.validAuthorityRevisions(): Boolean =
  safeRevision("shellCommands") != null &&
    safeRevision("tabApplicability") != null &&
    optJSONObject("sectionCommands")?.hasAllSectionRevisions() == true

private fun JSONObject.hasAllSectionRevisions(): Boolean =
  HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.all { safeRevision(it) != null }

private fun JSONObject.revisionsDoNotRegress(
  current: JSONObject,
  shellKey: String,
  navigationKey: String,
  sectionKey: String,
): Boolean {
  val nextShell = safeRevision(shellKey) ?: return false
  val currentShell = current.safeRevision(shellKey) ?: return false
  val nextNavigation = safeRevision(navigationKey) ?: return false
  val currentNavigation = current.safeRevision(navigationKey) ?: return false
  val nextSections = optJSONObject(sectionKey) ?: return false
  val currentSections = current.optJSONObject(sectionKey) ?: return false
  return nextShell >= currentShell &&
    nextNavigation >= currentNavigation &&
    HOME_CONTAINER_PROTOCOL_V3_SECTION_IDS.all { sectionId ->
      val next = nextSections.safeRevision(sectionId) ?: return@all false
      val previous = currentSections.safeRevision(sectionId) ?: return@all false
      next >= previous
    }
}
