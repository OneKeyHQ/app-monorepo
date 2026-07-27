package com.margelo.nitro.onekeynativecomponents

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerProtocolV3Test {
  @Test
  fun `domain generations may skip and update independently`() {
    val initial = canonicalState()
    val domains = JSONObject(fixture("home-container-v3.domains.json"))
    val outcome = HomeContainerProtocolV3Transaction.applyDomains(
      domains.toString(),
      initial,
    )
    val next = applied(outcome)

    assertEquals(8L, next.identity.storeCommitId)
    assertEquals("$101.00", next.snapshot.header.balance)
    assertEquals("history", next.snapshot.selectedTabId)
    assertEquals(
      "+1 USDC",
      next.snapshot.tabs
        .first { it.id == "history" }
        .sections.first()
        .items.first()
        .value,
    )
  }

  @Test
  fun `stale shell does not block a fresh surface`() {
    val initial = canonicalState()
    val domains = JSONObject(fixture("home-container-v3.domains.json"))
    val updates = domains.getJSONArray("updates")
    updates.getJSONObject(0).put("presentationRevision", 4)
    updates.getJSONObject(1)
      .put("kind", "surface")
      .put("presentationRevision", 9)
      .remove("applicabilityRevision")
    updates.getJSONObject(1)
      .put("value", JSONObject(initialThemeJson()).put("backgroundColor", "#000000"))
    while (updates.length() > 2) {
      updates.remove(updates.length() - 1)
    }

    val next = applied(
      HomeContainerProtocolV3Transaction.applyDomains(
        domains.toString(),
        initial,
      ),
    )
    assertEquals("$100.00", next.snapshot.header.balance)
    assertEquals("#000000", next.snapshot.theme.backgroundColor)
  }

  @Test
  fun `unrelated authority does not block a fresh section domain`() {
    val initial = canonicalState()
    initial.authorityRevisions
      .getJSONObject("sectionCommands")
      .put("portfolio", 10)
    val domains = JSONObject(fixture("home-container-v3.domains.json"))
    val updates = domains.getJSONArray("updates")
    while (updates.length() > 1) {
      updates.remove(0)
    }

    val next = applied(
      HomeContainerProtocolV3Transaction.applyDomains(
        domains.toString(),
        initial,
      ),
    )
    assertEquals(
      10L,
      next.authorityRevisions
        .getJSONObject("sectionCommands")
        .getLong("portfolio"),
    )
    assertEquals(
      "+1 USDC",
      next.snapshot.tabs
        .first { it.id == "history" }
        .sections.first()
        .items.first()
        .value,
    )
  }

  @Test
  fun `old owner domains are ignored`() {
    val domains = JSONObject(fixture("home-container-v3.domains.json"))
    domains.getJSONObject("identity").put("sessionId", "old-session")
    assertTrue(
      HomeContainerProtocolV3Transaction.applyDomains(
        domains.toString(),
        canonicalState(),
      ) is HomeContainerProtocolV3ApplyOutcome.Ignored,
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
    check(outcome is HomeContainerProtocolV3ApplyOutcome.Applied)
    return outcome.state
  }

  private fun initialThemeJson(): String =
    JSONObject(fixture("home-container-v3.snapshot.json"))
      .getJSONObject("payload")
      .getJSONObject("theme")
      .toString()

  private fun fixture(name: String): String =
    requireNotNull(
      javaClass.classLoader?.getResourceAsStream(name),
    ).bufferedReader().use { it.readText() }
}
