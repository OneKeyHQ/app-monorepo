package com.margelo.nitro.onekeynativecomponents

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeContainerStateTest {
  @Test
  fun `decodes the only supported state protocol`() {
    val state = HomeContainerJson.parseState(fixture().toString())

    assertEquals("wallet-1:account-1:all", state.owner.scopeKey)
    assertEquals("portfolio", state.snapshot.selectedTabId)
  }

  private fun fixture(): JSONObject {
    val resource = javaClass.classLoader?.getResource("home-container.state.json")
      ?: error("Missing HomeContainer state fixture")
    return JSONObject(resource.readText())
  }
}
