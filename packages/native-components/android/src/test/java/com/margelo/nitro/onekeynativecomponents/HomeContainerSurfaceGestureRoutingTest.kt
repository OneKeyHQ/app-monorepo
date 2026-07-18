package com.margelo.nitro.onekeynativecomponents

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerSurfaceGestureRoutingTest {
  @Test
  fun bodySlotKeepsGestureOwnership() {
    assertTrue(shouldHomeContainerSlotKeepGestureOwnership("content.body"))
  }

  @Test
  fun ordinarySlotsContinueUsingSurfaceRouting() {
    assertFalse(shouldHomeContainerSlotKeepGestureOwnership("content.header.balance"))
    assertFalse(shouldHomeContainerSlotKeepGestureOwnership("content.footer.market"))
  }
}
