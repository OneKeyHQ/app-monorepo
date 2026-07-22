package com.margelo.nitro.onekeynativecomponents

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerProtocolV3Test {
  @Test
  fun `canonical snapshot and patch preserve independent revision vectors`() {
    val initial = applied(
      HomeContainerProtocolV3Transaction.applySnapshot(
        fixture("home-container-v3.snapshot.json"),
      ),
    )
    assertEquals(11L, initial.transportRevision)
    assertEquals(7L, initial.identity.storeCommitId)
    assertEquals("$100.00", initial.legacyState.snapshot.header.balance)

    val next = applied(
      HomeContainerProtocolV3Transaction.applyPatch(
        fixture("home-container-v3.patch.json"),
        current = initial,
        availableSlotRevisions = initial.slotRevisions,
      ),
    )
    assertEquals(12L, next.transportRevision)
    assertEquals(8L, next.identity.storeCommitId)
    assertEquals("history", next.legacyState.snapshot.selectedTabId)
    assertEquals("$101.00", next.legacyState.snapshot.header.balance)
    assertEquals(3L, next.authorityRevisions.getLong("tabApplicability"))
  }

  @Test
  fun `patch waits only for explicitly required slot revisions`() {
    val current = canonicalState()
    val patch = JSONObject(fixture("home-container-v3.patch.json"))
      .put(
        "requiredSlotRevisions",
        JSONObject().put("content.state.defi", 9),
      )
    val outcome = HomeContainerProtocolV3Transaction.applyPatch(
      patch.toString(),
      current = current,
      availableSlotRevisions = current.slotRevisions,
    )
    assertNeedSnapshot(
      outcome,
      HomeContainerProtocolV3NeedSnapshotReason.SLOT_REVISION_GAP,
    )
  }

  @Test
  fun `patch rejects mounted slot regressions and records only required slots`() {
    val current = canonicalState()
    val regressingSlots = current.slotRevisions.toMutableMap()
    val firstSlot = regressingSlots.entries.first()
    regressingSlots[firstSlot.key] = firstSlot.value - 1
    assertNeedSnapshot(
      HomeContainerProtocolV3Transaction.applyPatch(
        fixture("home-container-v3.patch.json"),
        current,
        regressingSlots,
      ),
      HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT,
    )

    val unrequiredSlots = current.slotRevisions + ("header.action-row" to 99L)
    val next = applied(
      HomeContainerProtocolV3Transaction.applyPatch(
        fixture("home-container-v3.patch.json"),
        current,
        unrequiredSlots,
      ),
    )
    assertFalse(next.slotRevisions.containsKey("header.action-row"))
  }

  @Test
  fun `available slot vector is derived only from valid mounted metadata for current owner`() {
    val owner = HomeContainerProtocolV2Owner("wallet", "session")
    val otherOwner = HomeContainerProtocolV2Owner("wallet", "other-session")
    val revisions = homeContainerProtocolV3AvailableSlotRevisions(
      owner,
      listOf(
        HomeContainerProtocolV3MountedSlotMetadata(
          "header.balance",
          owner,
          slotRevision = 7,
          producedByStoreCommitId = 9,
        ),
        HomeContainerProtocolV3MountedSlotMetadata(
          "header.action-row",
          otherOwner,
          slotRevision = 11,
          producedByStoreCommitId = 9,
        ),
        HomeContainerProtocolV3MountedSlotMetadata(
          "content.state.defi",
          owner,
          slotRevision = -1,
          producedByStoreCommitId = 9,
        ),
      ),
    )
    assertEquals(mapOf("header.balance" to 7L), revisions)
  }

  @Test
  fun `transport gaps and authority regression request a snapshot`() {
    val current = canonicalState()
    val gap = JSONObject(fixture("home-container-v3.patch.json"))
      .put("baseTransportRevision", 10)
    assertNeedSnapshot(
      HomeContainerProtocolV3Transaction.applyPatch(
        gap.toString(),
        current,
        current.slotRevisions,
      ),
      HomeContainerProtocolV3NeedSnapshotReason.REVISION_GAP,
    )

    val regression = JSONObject(fixture("home-container-v3.patch.json"))
      .put("baseTransportRevision", current.transportRevision - 1)
      .put("transportRevision", current.transportRevision)
    regression.getJSONObject("authorityRevisions")
      .put("tabApplicability", 2)
    assertNeedSnapshot(
      HomeContainerProtocolV3Transaction.applyPatch(
        regression.toString(),
        current,
        current.slotRevisions,
      ),
      HomeContainerProtocolV3NeedSnapshotReason.INVALID_INVARIANT,
    )
  }

  @Test
  fun `same applicability revision accepts rapid tabs and rejects unknown authority`() {
    val current = canonicalState()
    listOf("portfolio", "defi").forEachIndexed { index, tabId ->
      val intent = JSONObject()
        .put("protocolVersion", 3)
        .put("intentId", "tab-$index")
        .put(
          "owner",
          JSONObject()
            .put("scopeKey", current.identity.owner.scopeKey)
            .put("sessionId", current.identity.owner.sessionId),
        )
        .put(
          "authority",
          JSONObject().put("kind", "tabApplicability").put("revision", 3),
        )
        .put(
          "intent",
          JSONObject().put("kind", "selectTab").put("tabId", tabId),
        )
      assertTrue(
        HomeContainerProtocolV3Transaction.validateIntent(
          intent.toString(),
          current,
        ),
      )
    }

    val unknown = JSONObject()
      .put("protocolVersion", 3)
      .put("intentId", "unknown")
      .put(
        "owner",
        JSONObject()
          .put("scopeKey", current.identity.owner.scopeKey)
          .put("sessionId", current.identity.owner.sessionId),
      )
      .put(
        "authority",
        JSONObject().put("kind", "globalRevision").put("revision", 3),
      )
      .put(
        "intent",
        JSONObject().put("kind", "selectTab").put("tabId", "portfolio"),
      )
    assertFalse(
      HomeContainerProtocolV3Transaction.validateIntent(
        unknown.toString(),
        current,
      ),
    )
  }

  private fun canonicalState(): HomeContainerProtocolV3State = applied(
    HomeContainerProtocolV3Transaction.applySnapshot(
      fixture("home-container-v3.snapshot.json"),
    ),
  )

  private fun applied(
    outcome: HomeContainerProtocolV3ApplyOutcome,
  ): HomeContainerProtocolV3State {
    assertTrue(outcome is HomeContainerProtocolV3ApplyOutcome.Applied)
    return (outcome as HomeContainerProtocolV3ApplyOutcome.Applied).state
  }

  private fun assertNeedSnapshot(
    outcome: HomeContainerProtocolV3ApplyOutcome,
    reason: HomeContainerProtocolV3NeedSnapshotReason,
  ) {
    assertTrue(outcome is HomeContainerProtocolV3ApplyOutcome.NeedSnapshot)
    assertEquals(
      reason,
      (outcome as HomeContainerProtocolV3ApplyOutcome.NeedSnapshot).reason,
    )
  }

  private fun fixture(name: String): String {
    val resource = javaClass.classLoader?.getResource(name)
      ?: error("Missing canonical fixture: $name")
    return resource.readText()
  }
}
