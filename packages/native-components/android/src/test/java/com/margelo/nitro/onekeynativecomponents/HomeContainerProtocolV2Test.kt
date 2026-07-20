package com.margelo.nitro.onekeynativecomponents

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerProtocolV2Test {
  @Test
  fun `canonical snapshot and patch apply atomically`() {
    val snapshotOutcome = HomeContainerProtocolV2Transaction.applySnapshot(
      fixture("home-container-v2.snapshot.json"),
      current = null,
    )
    val snapshotState = snapshotOutcome.appliedState()
    assertEquals("wallet-1:account-1:all", snapshotState.owner.scopeKey)
    assertEquals("session-1", snapshotState.owner.sessionId)
    assertEquals(7, snapshotState.revision)
    assertEquals("portfolio", snapshotState.snapshot.selectedTabId)
    assertEquals(listOf("portfolio", "perps", "history"), snapshotState.snapshot.tabs.map { it.id })
    assertEquals(listOf("portfolio", "history"), snapshotState.snapshot.inlineTabs().map { it.id })
    assertEquals(listOf("tokens"), snapshotState.snapshot.tabs[0].sections.map { it.id })
    val handoffTab = snapshotState.snapshot.tabs.single { it.id == "perps" }
    assertEquals(HomeContainerTabDestination.HANDOFF, handoffTab.destination)
    assertEquals("home.perps.openWeb", handoffTab.handoffCommandId)
    assertTrue(handoffTab.sections.isEmpty())

    val patchOutcome = HomeContainerProtocolV2Transaction.applyPatch(
      fixture("home-container-v2.patch.json"),
      current = snapshotState,
    )
    val patchState = patchOutcome.appliedState()
    assertEquals(8, patchState.revision)
    assertEquals("$101.00", patchState.snapshot.header.balance)
    assertEquals("history", patchState.snapshot.selectedTabId)
    assertEquals(listOf("portfolio", "perps", "history"), patchState.snapshot.tabs.map { it.id })
    assertEquals(listOf("tokens"), patchState.snapshot.tabs[0].sections.map { it.id })
    assertEquals(
      "Receive",
      patchState.snapshot.tabs.single { it.id == "history" }.sections.single().items.single().title,
    )

    val result = JSONObject(patchOutcome.toTransportResultJson())
    assertEquals("applied", result.getString("kind"))
    assertEquals(8, result.getLong("revision"))
    assertEquals("session-1", result.getJSONObject("owner").getString("sessionId"))
  }

  @Test
  fun `snapshot rejects missing selected tab without first-tab fallback`() {
    val root = JSONObject(fixture("home-container-v2.snapshot.json"))
    root.getJSONObject("payload").put("selectedTabId", "missing")

    val outcome = HomeContainerProtocolV2Transaction.applySnapshot(root.toString(), current = null)

    assertNeedSnapshot(
      outcome,
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      currentRevision = null,
    )
  }

  @Test
  fun `snapshot requires non-empty owner tab and section identifiers`() {
    val invalidSnapshots = listOf<(JSONObject) -> Unit>(
      { root -> root.getJSONObject("owner").put("scopeKey", "") },
      { root -> root.getJSONObject("owner").put("sessionId", "") },
      { root -> root.getJSONObject("payload").put("selectedTabId", "") },
      { root ->
        root.getJSONObject("payload").getJSONArray("tabs").getJSONObject(0)
          .put("id", "")
      },
      { root ->
        root.getJSONObject("payload").getJSONArray("tabs").getJSONObject(0)
          .getJSONArray("sections").getJSONObject(0).put("id", "")
      },
    )

    invalidSnapshots.forEach { mutate ->
      val root = JSONObject(fixture("home-container-v2.snapshot.json"))
      mutate(root)

      assertNeedSnapshot(
        HomeContainerProtocolV2Transaction.applySnapshot(root.toString(), current = null),
        HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
        currentRevision = null,
      )
    }
  }

  @Test
  fun `snapshot rejects coerced fractional and unsafe numeric fields`() {
    val invalidFields = listOf(
      Triple(
        "protocolVersion",
        "2",
        HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_PROTOCOL,
      ),
      Triple(
        "protocolVersion",
        2.5,
        HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_PROTOCOL,
      ),
      Triple(
        "schemaVersion",
        "2",
        HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_SCHEMA,
      ),
      Triple(
        "schemaVersion",
        1.5,
        HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_SCHEMA,
      ),
      Triple(
        "revision",
        "7",
        HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      ),
      Triple(
        "revision",
        7.5,
        HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      ),
      Triple(
        "revision",
        9_007_199_254_740_992L,
        HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      ),
    )

    invalidFields.forEach { (key, value, reason) ->
      val root = JSONObject(fixture("home-container-v2.snapshot.json")).put(key, value)
      assertNeedSnapshot(
        HomeContainerProtocolV2Transaction.applySnapshot(root.toString(), current = null),
        reason,
        currentRevision = null,
      )
    }
  }

  @Test
  fun `legacy v1 snapshot and patch reject invalid revisions without state pollution`() {
    val current = canonicalState().snapshot
    val before = current.copy()
    val invalidRevisions = listOf(-1L, 9_007_199_254_740_992L)

    invalidRevisions.forEach { revision ->
      val snapshotResult = runCatching {
        HomeContainerJson.parseSnapshot(v1SnapshotJson(revision))
      }
      assertTrue(snapshotResult.isFailure)
      assertEquals(before, current)

      val patch = HomeContainerJson.parsePatch(v1PatchJson(revision))
      assertEquals(null, current.applyingValidatedPatch(patch))
      assertEquals(before, current)
    }
  }

  @Test
  fun `replace navigation preserves sections and validates unique tabs`() {
    val current = canonicalState()
    val validPatch = JSONObject(fixture("home-container-v2.patch.json"))
    val validState = HomeContainerProtocolV2Transaction.applyPatch(
      validPatch.toString(),
      current,
    ).appliedState()
    assertEquals(listOf("tokens"), validState.snapshot.tabs[0].sections.map { it.id })

    val invalidPatch = JSONObject(fixture("home-container-v2.patch.json"))
    val navigation = invalidPatch.getJSONArray("changes").getJSONObject(1).getJSONObject("value")
    navigation.put(
      "tabs",
      JSONArray()
        .put(
          JSONObject()
            .put("id", "portfolio")
            .put("title", "Spot")
            .put("destination", "inline"),
        )
        .put(
          JSONObject()
            .put("id", "portfolio")
            .put("title", "Duplicate")
            .put("destination", "inline"),
        ),
    )
    navigation.put("selectedTabId", "portfolio")

    val outcome = HomeContainerProtocolV2Transaction.applyPatch(invalidPatch.toString(), current)
    assertNeedSnapshot(
      outcome,
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      current.revision,
    )
  }

  @Test
  fun `handoff destination invariants reject snapshots and patches atomically`() {
    val current = canonicalState()
    val before = current.documentCopy().toString()
    val invalidSnapshots = listOf<(JSONObject) -> Unit>(
      { root -> root.getJSONObject("payload").put("selectedTabId", "perps") },
      { root -> snapshotTab(root, "perps").remove("handoffCommandId") },
      { root ->
        snapshotTab(root, "perps").getJSONArray("sections").put(
          JSONObject().put("id", "forbidden").put("items", JSONArray()),
        )
      },
      { root -> snapshotTab(root, "portfolio").put("handoffCommandId", "forbidden") },
      { root -> snapshotTab(root, "portfolio").remove("destination") },
    )
    invalidSnapshots.forEach { mutate ->
      val snapshot = JSONObject(fixture("home-container-v2.snapshot.json"))
      mutate(snapshot)
      assertNeedSnapshot(
        HomeContainerProtocolV2Transaction.applySnapshot(snapshot.toString(), current),
        HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
        current.revision,
      )
      assertEquals(before, current.documentCopy().toString())
    }

    val invalidPatches = listOf<(JSONObject) -> Unit>(
      { root -> navigation(root).put("selectedTabId", "perps") },
      { root -> navigationTab(root, "perps").remove("handoffCommandId") },
      { root -> navigationTab(root, "portfolio").put("handoffCommandId", "forbidden") },
      { root -> navigationTab(root, "perps").put("sections", JSONArray()) },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("tabId", "perps") },
    )
    invalidPatches.forEach { mutate ->
      val patch = JSONObject(fixture("home-container-v2.patch.json"))
        .put("baseRevision", current.revision - 1)
        .put("revision", current.revision)
      mutate(patch)
      assertInvalidPatchDoesNotMutate(patch, current)
    }
  }

  @Test
  fun `replace section requires matching stable id and valid index`() {
    val current = canonicalState()
    val before = current.documentCopy().toString()
    val mismatchedIdPatch = JSONObject(fixture("home-container-v2.patch.json"))
    mismatchedIdPatch.getJSONArray("changes").getJSONObject(2)
      .getJSONObject("value").put("id", "different")

    val mismatchedOutcome = HomeContainerProtocolV2Transaction.applyPatch(
      mismatchedIdPatch.toString(),
      current,
    )
    assertNeedSnapshot(
      mismatchedOutcome,
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      current.revision,
    )
    assertEquals(before, current.documentCopy().toString())

    val invalidIndexPatch = JSONObject(fixture("home-container-v2.patch.json"))
    invalidIndexPatch.getJSONArray("changes").getJSONObject(2).put("index", 4)
    val invalidIndexOutcome = HomeContainerProtocolV2Transaction.applyPatch(
      invalidIndexPatch.toString(),
      current,
    )
    assertNeedSnapshot(
      invalidIndexOutcome,
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      current.revision,
    )
    assertEquals(before, current.documentCopy().toString())
  }

  @Test
  fun `patch requires non-empty stable identifiers without mutating current state`() {
    val current = canonicalState()
    val invalidPatches = listOf<(JSONObject) -> Unit>(
      { root -> root.getJSONObject("owner").put("scopeKey", "") },
      { root -> root.getJSONObject("owner").put("sessionId", "") },
      { root ->
        root.getJSONArray("changes").getJSONObject(1).getJSONObject("value")
          .put("selectedTabId", "")
      },
      { root ->
        root.getJSONArray("changes").getJSONObject(1).getJSONObject("value")
          .getJSONArray("tabs").getJSONObject(0).put("id", "")
      },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("tabId", "") },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("sectionId", "") },
      { root ->
        root.getJSONArray("changes").getJSONObject(2).getJSONObject("value")
          .put("id", "")
      },
    )

    invalidPatches.forEach { mutate ->
      val root = JSONObject(fixture("home-container-v2.patch.json"))
      mutate(root)
      assertInvalidPatchDoesNotMutate(root, current)
    }
  }

  @Test
  fun `patch rejects coerced fractional and unsafe revisions and indexes atomically`() {
    val current = canonicalState()
    val invalidPatches = listOf<(JSONObject) -> Unit>(
      { root -> root.put("baseRevision", "7") },
      { root -> root.put("baseRevision", 7.5) },
      { root -> root.put("revision", "8") },
      { root -> root.put("revision", 8.5) },
      { root -> root.put("revision", 9_007_199_254_740_992L) },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("index", "0") },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("index", 0.5) },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("index", -1) },
      { root ->
        root.getJSONArray("changes").getJSONObject(2)
          .put("index", 9_007_199_254_740_992L)
      },
    )

    invalidPatches.forEach { mutate ->
      val root = JSONObject(fixture("home-container-v2.patch.json"))
      mutate(root)
      assertInvalidPatchDoesNotMutate(root, current)
    }
  }

  @Test
  fun `owner mismatch and revision gap request bounded snapshot recovery`() {
    val current = canonicalState()
    val ownerMismatchPatch = JSONObject(fixture("home-container-v2.patch.json"))
    ownerMismatchPatch.getJSONObject("owner").put("sessionId", "session-2")
    val ownerMismatch = HomeContainerProtocolV2Transaction.applyPatch(
      ownerMismatchPatch.toString(),
      current,
    )
    assertNeedSnapshot(
      ownerMismatch,
      HomeContainerProtocolV2NeedSnapshotReason.OWNER_MISMATCH,
      current.revision,
    )

    val gapPatch = JSONObject(fixture("home-container-v2.patch.json"))
      .put("baseRevision", 9)
      .put("revision", 10)
    val gap = HomeContainerProtocolV2Transaction.applyPatch(gapPatch.toString(), current)
    assertNeedSnapshot(
      gap,
      HomeContainerProtocolV2NeedSnapshotReason.REVISION_GAP,
      current.revision,
    )

    val first = ownerMismatch as HomeContainerProtocolV2ApplyOutcome.NeedSnapshot
    val repeated = HomeContainerProtocolV2Transaction.applyPatch(
      ownerMismatchPatch.toString(),
      current,
    ) as HomeContainerProtocolV2ApplyOutcome.NeedSnapshot
    assertEquals(first.coalescingKey, repeated.coalescingKey)
    assertNotEquals(first.coalescingKey, (gap as HomeContainerProtocolV2ApplyOutcome.NeedSnapshot).coalescingKey)
  }

  @Test
  fun `stale snapshot and patch acknowledge duplicate`() {
    val current = canonicalState()
    val duplicateSnapshot = HomeContainerProtocolV2Transaction.applySnapshot(
      fixture("home-container-v2.snapshot.json"),
      current,
    )
    assertTrue(duplicateSnapshot is HomeContainerProtocolV2ApplyOutcome.Duplicate)
    assertEquals("duplicate", JSONObject(duplicateSnapshot.toTransportResultJson()).getString("kind"))

    val duplicatePatch = JSONObject(fixture("home-container-v2.patch.json"))
      .put("baseRevision", 6)
      .put("revision", 7)
    val patchOutcome = HomeContainerProtocolV2Transaction.applyPatch(duplicatePatch.toString(), current)
    assertTrue(patchOutcome is HomeContainerProtocolV2ApplyOutcome.Duplicate)
  }

  @Test
  fun `malformed same-revision payloads request snapshot instead of duplicate`() {
    val current = canonicalState()
    val before = current.documentCopy().toString()

    val invalidSnapshot = JSONObject(fixture("home-container-v2.snapshot.json"))
    invalidSnapshot.getJSONObject("payload").getJSONArray("tabs").getJSONObject(0)
      .getJSONArray("sections").getJSONObject(0).put("id", "")
    assertNeedSnapshot(
      HomeContainerProtocolV2Transaction.applySnapshot(invalidSnapshot.toString(), current),
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      current.revision,
    )
    assertEquals(before, current.documentCopy().toString())

    val invalidSameRevisionPatches = listOf<(JSONObject) -> Unit>(
      { root ->
        root.getJSONArray("changes").getJSONObject(2)
          .put("sectionId", "")
          .getJSONObject("value").put("id", "")
      },
      { root -> root.getJSONArray("changes").getJSONObject(2).put("kind", "unknown") },
      { root -> root.getJSONArray("changes").getJSONObject(0).getJSONObject("value").remove("balance") },
    )
    invalidSameRevisionPatches.forEach { mutate ->
      val patch = JSONObject(fixture("home-container-v2.patch.json"))
        .put("baseRevision", current.revision - 1)
        .put("revision", current.revision)
      mutate(patch)
      assertInvalidPatchDoesNotMutate(patch, current)
    }
  }

  @Test
  fun `unsupported protocol and schema produce typed recovery results`() {
    val protocolRoot = JSONObject(fixture("home-container-v2.snapshot.json"))
      .put("protocolVersion", 3)
    val protocolOutcome = HomeContainerProtocolV2Transaction.applySnapshot(
      protocolRoot.toString(),
      current = null,
    )
    assertNeedSnapshot(
      protocolOutcome,
      HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_PROTOCOL,
      currentRevision = null,
    )

    val schemaRoot = JSONObject(fixture("home-container-v2.snapshot.json"))
      .put("schemaVersion", 3)
    val schemaOutcome = HomeContainerProtocolV2Transaction.applySnapshot(
      schemaRoot.toString(),
      current = null,
    )
    assertNeedSnapshot(
      schemaOutcome,
      HomeContainerProtocolV2NeedSnapshotReason.UNSUPPORTED_SCHEMA,
      currentRevision = null,
    )
  }

  @Test
  fun `intent includes owner intent id and rendered revision`() {
    val state = canonicalState()
    val intent = JSONObject(
      HomeContainerProtocolV2Intent.action(
        owner = state.owner,
        renderedRevision = state.revision,
        commandId = "market.favorite",
        itemId = "btc",
      ),
    )

    assertTrue(intent.getString("intentId").isNotEmpty())
    assertEquals(state.owner.scopeKey, intent.getJSONObject("owner").getString("scopeKey"))
    assertEquals(7, intent.getLong("renderedRevision"))
    assertEquals("action", intent.getJSONObject("intent").getString("kind"))
    assertEquals("market.favorite", intent.getJSONObject("intent").getString("commandId"))
    assertEquals("btc", intent.getJSONObject("intent").getString("itemId"))
    assertFalse(intent.has("revision"))
  }

  @Test
  fun `handoff intent carries tab and command without selecting it`() {
    val state = canonicalState()
    val intent = JSONObject(
      HomeContainerProtocolV2Intent.handoff(
        owner = state.owner,
        renderedRevision = state.revision,
        tabId = "perps",
        commandId = "home.perps.openWeb",
      ),
    )

    assertEquals(state.owner.scopeKey, intent.getJSONObject("owner").getString("scopeKey"))
    assertEquals(state.revision, intent.getLong("renderedRevision"))
    val payload = intent.getJSONObject("intent")
    assertEquals("handoff", payload.getString("kind"))
    assertEquals("perps", payload.getString("tabId"))
    assertEquals("home.perps.openWeb", payload.getString("commandId"))
    assertEquals("portfolio", state.snapshot.selectedTabId)
    assertEquals(listOf("portfolio", "history"), state.snapshot.inlineTabs().map { it.id })
  }

  private fun canonicalState(): HomeContainerProtocolV2State =
    HomeContainerProtocolV2Transaction.applySnapshot(
      fixture("home-container-v2.snapshot.json"),
      current = null,
    ).appliedState()

  private fun HomeContainerProtocolV2ApplyOutcome.appliedState(): HomeContainerProtocolV2State {
    assertTrue(this is HomeContainerProtocolV2ApplyOutcome.Applied)
    return (this as HomeContainerProtocolV2ApplyOutcome.Applied).state
  }

  private fun assertNeedSnapshot(
    outcome: HomeContainerProtocolV2ApplyOutcome,
    reason: HomeContainerProtocolV2NeedSnapshotReason,
    currentRevision: Long?,
  ) {
    assertTrue(outcome is HomeContainerProtocolV2ApplyOutcome.NeedSnapshot)
    val needSnapshot = outcome as HomeContainerProtocolV2ApplyOutcome.NeedSnapshot
    assertEquals(reason, needSnapshot.reason)
    assertEquals(currentRevision, needSnapshot.currentRevision)
    val result = JSONObject(outcome.toTransportResultJson())
    assertEquals("needSnapshot", result.getString("kind"))
    assertEquals(reason.wireValue, result.getString("reason"))
  }

  private fun assertInvalidPatchDoesNotMutate(
    patch: JSONObject,
    current: HomeContainerProtocolV2State,
  ) {
    val before = current.documentCopy().toString()
    assertNeedSnapshot(
      HomeContainerProtocolV2Transaction.applyPatch(patch.toString(), current),
      HomeContainerProtocolV2NeedSnapshotReason.INVALID_INVARIANT,
      current.revision,
    )
    assertEquals(before, current.documentCopy().toString())
  }

  private fun snapshotTab(root: JSONObject, tabId: String): JSONObject {
    val tabs = root.getJSONObject("payload").getJSONArray("tabs")
    return (0 until tabs.length())
      .map(tabs::getJSONObject)
      .single { it.getString("id") == tabId }
  }

  private fun navigation(root: JSONObject): JSONObject =
    root.getJSONArray("changes").getJSONObject(1).getJSONObject("value")

  private fun navigationTab(root: JSONObject, tabId: String): JSONObject {
    val tabs = navigation(root).getJSONArray("tabs")
    return (0 until tabs.length())
      .map(tabs::getJSONObject)
      .single { it.getString("id") == tabId }
  }

  private fun v1SnapshotJson(revision: Long): String {
    val envelope = JSONObject(fixture("home-container-v2.snapshot.json"))
    return JSONObject(envelope.getJSONObject("payload").toString())
      .put("schemaVersion", HOME_CONTAINER_BUSINESS_SCHEMA_VERSION)
      .put("revision", revision)
      .toString()
  }

  private fun v1PatchJson(revision: Long): String = JSONObject()
    .put("schemaVersion", HOME_CONTAINER_BUSINESS_SCHEMA_VERSION)
    .put("revision", revision)
    .put("tabs", JSONArray())
    .toString()

  private fun fixture(name: String): String {
    val resource = javaClass.classLoader?.getResource(name)
      ?: error("Missing canonical fixture: $name")
    return resource.readText()
  }
}
