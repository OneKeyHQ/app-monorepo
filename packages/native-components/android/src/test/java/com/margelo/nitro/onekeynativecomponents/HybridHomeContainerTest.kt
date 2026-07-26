package com.margelo.nitro.onekeynativecomponents

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HybridHomeContainerTest {
  @Test
  fun `initial snapshot is submitted only once per value`() {
    assertFalse(
      homeContainerShouldSubmitInitialSnapshot(
        current = "",
        next = "",
      ),
    )
    assertTrue(
      homeContainerShouldSubmitInitialSnapshot(
        current = "",
        next = "snapshot-1",
      ),
    )
    assertFalse(
      homeContainerShouldSubmitInitialSnapshot(
        current = "snapshot-1",
        next = "snapshot-1",
      ),
    )
    assertTrue(
      homeContainerShouldSubmitInitialSnapshot(
        current = "snapshot-1",
        next = "snapshot-2",
      ),
    )
  }
}
