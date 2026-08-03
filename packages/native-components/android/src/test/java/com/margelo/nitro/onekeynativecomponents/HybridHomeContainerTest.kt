package com.margelo.nitro.onekeynativecomponents

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HybridHomeContainerTest {
  @Test
  fun `initial state is submitted only once per value`() {
    assertFalse(
      homeContainerShouldSubmitInitialState(
        current = "",
        next = "",
      ),
    )
    assertTrue(
      homeContainerShouldSubmitInitialState(
        current = "",
        next = "state-1",
      ),
    )
    assertFalse(
      homeContainerShouldSubmitInitialState(
        current = "state-1",
        next = "state-1",
      ),
    )
    assertTrue(
      homeContainerShouldSubmitInitialState(
        current = "state-1",
        next = "state-2",
      ),
    )
  }
}
