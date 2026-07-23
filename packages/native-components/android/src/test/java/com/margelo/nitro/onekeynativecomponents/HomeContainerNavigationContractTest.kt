package com.margelo.nitro.onekeynativecomponents

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeContainerNavigationContractTest {
  @Test
  fun `tab accessory is centered inside the compact tab host`() {
    assertEquals(30, homeContainerCenteredSlotOffset(hostSize = 157, childSize = 97))
    assertEquals(0, homeContainerCenteredSlotOffset(hostSize = 36, childSize = 48))
  }

  @Test
  fun `header collapse preserves the compact account region`() {
    assertEquals(
      290,
      homeContainerMaximumHeaderOffset(
        headerHeight = 350,
        compactHeaderHeight = 60,
      ),
    )
    assertEquals(
      0,
      homeContainerMaximumHeaderOffset(
        headerHeight = 48,
        compactHeaderHeight = 60,
      ),
    )
  }

  @Test
  fun `programmatic paging ignores intermediate page callbacks`() {
    assertTrue(
      homeContainerShouldIgnoreProgrammaticPageSelection(
        pendingTargetTabId = "history",
        selectedPageTabId = "defi",
      ),
    )
    assertFalse(
      homeContainerShouldIgnoreProgrammaticPageSelection(
        pendingTargetTabId = "history",
        selectedPageTabId = "history",
      ),
    )
    assertFalse(
      homeContainerShouldIgnoreProgrammaticPageSelection(
        pendingTargetTabId = null,
        selectedPageTabId = "defi",
      ),
    )
  }

  @Test
  fun `requested page transitions preserve their animation preference`() {
    assertTrue(
      homeContainerShouldAnimateTabSelection(
        requestedAnimated = true,
        isDirectTabPress = true,
      ),
    )
    assertTrue(
      homeContainerShouldAnimateTabSelection(
        requestedAnimated = true,
        isDirectTabPress = false,
      ),
    )
    assertFalse(
      homeContainerShouldAnimateTabSelection(
        requestedAnimated = false,
        isDirectTabPress = false,
      ),
    )
  }

  @Test
  fun `store reconciliation preserves the matching pending page transition`() {
    assertTrue(
      homeContainerShouldPreservePendingPageTransition(
        pendingTargetTabId = "perps",
        requestedTabId = "perps",
      ),
    )
    assertFalse(
      homeContainerShouldPreservePendingPageTransition(
        pendingTargetTabId = "perps",
        requestedTabId = "defi",
      ),
    )
    assertFalse(
      homeContainerShouldPreservePendingPageTransition(
        pendingTargetTabId = null,
        requestedTabId = "perps",
      ),
    )
  }

  @Test
  fun `pending page transition completes only after the target page settles`() {
    assertFalse(
      homeContainerShouldCompletePendingPageTransition(
        pendingTargetTabId = "perps",
        currentTabId = "perps",
        isIdle = false,
      ),
    )
    assertFalse(
      homeContainerShouldCompletePendingPageTransition(
        pendingTargetTabId = "perps",
        currentTabId = "defi",
        isIdle = true,
      ),
    )
    assertTrue(
      homeContainerShouldCompletePendingPageTransition(
        pendingTargetTabId = "perps",
        currentTabId = "perps",
        isIdle = true,
      ),
    )
  }

  @Test
  fun `deferred page reconciliation follows the selected tab after navigation changes`() {
    assertTrue(
      homeContainerShouldReconcileDeferredPageSelection(
        requestedTabId = "portfolio",
        selectedTabId = "portfolio",
        requestedIndex = 0,
        tabIdAtRequestedIndex = "portfolio",
      ),
    )
    assertFalse(
      homeContainerShouldReconcileDeferredPageSelection(
        requestedTabId = "portfolio",
        selectedTabId = "history",
        requestedIndex = 0,
        tabIdAtRequestedIndex = "portfolio",
      ),
    )
    assertFalse(
      homeContainerShouldReconcileDeferredPageSelection(
        requestedTabId = "portfolio",
        selectedTabId = "portfolio",
        requestedIndex = 0,
        tabIdAtRequestedIndex = "history",
      ),
    )
  }
}
