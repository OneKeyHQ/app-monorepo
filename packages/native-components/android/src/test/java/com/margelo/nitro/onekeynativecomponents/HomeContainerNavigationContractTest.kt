package com.margelo.nitro.onekeynativecomponents

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
  fun `collapse updates are dispatched only when the bounded offset changes`() {
    assertTrue(
      homeContainerShouldDispatchCollapseOffset(
        previousOffset = null,
        nextOffset = 0,
      ),
    )
    assertTrue(
      homeContainerShouldDispatchCollapseOffset(
        previousOffset = 120,
        nextOffset = 121,
      ),
    )
    assertFalse(
      homeContainerShouldDispatchCollapseOffset(
        previousOffset = 640,
        nextOffset = 640,
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
  fun `gesture paging remains pending until the selected page settles`() {
    assertEquals(
      "defi",
      homeContainerPendingPageTransition(
        pendingTargetTabId = null,
        selectedPageTabId = "defi",
        isIdle = false,
        isProgrammatic = false,
      ),
    )
    assertEquals(
      "portfolio",
      homeContainerPendingPageTransition(
        pendingTargetTabId = "defi",
        selectedPageTabId = "portfolio",
        isIdle = false,
        isProgrammatic = false,
      ),
    )
    assertEquals(
      "history",
      homeContainerPendingPageTransition(
        pendingTargetTabId = "history",
        selectedPageTabId = "defi",
        isIdle = true,
        isProgrammatic = true,
      ),
    )
    assertNull(
      homeContainerPendingPageTransition(
        pendingTargetTabId = null,
        selectedPageTabId = "portfolio",
        isIdle = true,
        isProgrammatic = false,
      ),
    )
  }

  @Test
  fun `pending page owns navigation while Store snapshots catch up`() {
    assertEquals(
      "defi",
      homeContainerNavigationTabId(
        pendingTargetTabId = "defi",
        requestedTabId = "portfolio",
        inlineTabIds = listOf("portfolio", "defi", "history"),
      ),
    )
    assertEquals(
      "portfolio",
      homeContainerNavigationTabId(
        pendingTargetTabId = "nft",
        requestedTabId = "portfolio",
        inlineTabIds = listOf("portfolio", "defi", "history"),
      ),
    )
    assertEquals(
      "portfolio",
      homeContainerNavigationTabId(
        pendingTargetTabId = null,
        requestedTabId = "handoff",
        inlineTabIds = listOf("portfolio", "defi", "history"),
        fallbackTabId = "portfolio",
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

  @Test
  fun `shared chrome keeps ownership until the pull direction is resolved`() {
    assertFalse(
      homeContainerShouldHonorChildDisallowIntercept(
        childRequestsDisallow = true,
        chromeGestureCandidate = true,
      ),
    )
    assertTrue(
      homeContainerShouldHonorChildDisallowIntercept(
        childRequestsDisallow = true,
        chromeGestureCandidate = false,
      ),
    )
    assertFalse(
      homeContainerShouldHonorChildDisallowIntercept(
        childRequestsDisallow = false,
        chromeGestureCandidate = true,
      ),
    )
  }

  @Test
  fun `horizontal gestures remain owned by pager and header carousels`() {
    assertTrue(
      homeContainerGestureIsHorizontal(
        distanceX = 32f,
        distanceY = 8f,
        touchSlop = 12,
      ),
    )
    assertFalse(
      homeContainerGestureIsHorizontal(
        distanceX = 8f,
        distanceY = 32f,
        touchSlop = 12,
      ),
    )
    assertFalse(
      homeContainerGestureIsHorizontal(
        distanceX = 8f,
        distanceY = 2f,
        touchSlop = 12,
      ),
    )
  }

  @Test
  fun `upward gestures over shared chrome scroll the active page`() {
    assertTrue(
      homeContainerShouldRelayChromeVerticalGesture(
        deltaY = -32f,
        distanceX = 4f,
        distanceY = 32f,
        touchSlop = 12,
        pageCanScrollUp = false,
      ),
    )
  }

  @Test
  fun `downward chrome gestures scroll the page before refreshing at the top`() {
    assertTrue(
      homeContainerShouldRelayChromeVerticalGesture(
        deltaY = 32f,
        distanceX = 4f,
        distanceY = 32f,
        touchSlop = 12,
        pageCanScrollUp = true,
      ),
    )
    assertFalse(
      homeContainerShouldRelayChromeVerticalGesture(
        deltaY = 32f,
        distanceX = 4f,
        distanceY = 32f,
        touchSlop = 12,
        pageCanScrollUp = false,
      ),
    )
  }

  @Test
  fun `chrome taps and unresolved gestures are not relayed to the page`() {
    assertFalse(
      homeContainerShouldRelayChromeVerticalGesture(
        deltaY = -8f,
        distanceX = 2f,
        distanceY = 8f,
        touchSlop = 12,
        pageCanScrollUp = false,
      ),
    )
    assertFalse(
      homeContainerShouldRelayChromeVerticalGesture(
        deltaY = -24f,
        distanceX = 32f,
        distanceY = 24f,
        touchSlop = 12,
        pageCanScrollUp = false,
      ),
    )
  }

  @Test
  fun `tab switch aligns a page that is still inside the shared header spacer`() {
    assertEquals(
      640,
      homeContainerTargetSynchronizedCollapseOffset(
        currentOffset = 0,
        requestedOffset = 640,
        maximumHeaderOffset = 640,
      ),
    )
    assertEquals(
      640,
      homeContainerTargetSynchronizedCollapseOffset(
        currentOffset = 120,
        requestedOffset = 900,
        maximumHeaderOffset = 640,
      ),
    )
  }

  @Test
  fun `tab switch preserves a page that has already scrolled into body content`() {
    assertNull(
      homeContainerTargetSynchronizedCollapseOffset(
        currentOffset = 900,
        requestedOffset = 320,
        maximumHeaderOffset = 640,
      ),
    )
  }
}
