import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, Ref } from 'react';

import { XStack } from '@onekeyhq/components/src/primitives';
import type { TamaguiElement } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import {
  BrowserSubmenuCloseArmedContext,
  BrowserSubmenuContext,
} from './BrowserSubmenuContext';
import { createCloseArmGuard } from './closeArmGuard';
import { EXPANDED_SUBMENU_WIDTH, SubmenuColumn } from './SubmenuColumn';
import { VerticalDivider } from './VerticalDivider';

export interface IBrowserSubmenuColumnProps {
  webPageTabBar: ReactElement;
  focusedRouteName?: string;
  multiTabBrowserRouteName?: string;
}

// Hover-intent delay before the tab column expands. Short enough to feel
// responsive, long enough that a cursor passing through the narrow column
// (e.g. on its way to the primary sidebar) does not pop the overlay open.
const HOVER_DELAY_MS = 300;
// After expanding, tab close buttons arm only when the pointer moves at least
// POINTER_MOVE_THRESHOLD_PX (absorbs click jitter) after the column has
// settled for CLOSE_ARM_DELAY_MS. Movement still carried over from reaching
// for a favicon in the collapsed column does not count.
const CLOSE_ARM_DELAY_MS = 250;
const POINTER_MOVE_THRESHOLD_PX = 4;

// Browser submenu only shows in the desktop app.
const isShowWebTabBar = platformEnv.isDesktop;

export function BrowserSubmenuColumn({
  webPageTabBar,
  focusedRouteName,
  multiTabBrowserRouteName,
}: IBrowserSubmenuColumnProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCloseArmed, setIsCloseArmed] = useState(false);
  const isHoveredRef = useRef(isHovered);
  isHoveredRef.current = isHovered;
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const popoverCountRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const checkPointerOutside = useCallback(() => {
    const pointer = lastPointerRef.current;
    const container = containerRef.current;
    if (!pointer || !container) return;
    const rect = container.getBoundingClientRect();
    const isInside =
      pointer.x >= rect.left &&
      pointer.x <= rect.left + EXPANDED_SUBMENU_WIDTH &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom;
    if (!isInside) {
      clearHoverTimer();
      setIsHovered(false);
    }
  }, [clearHoverTimer]);

  const reportPopoverOpen = useCallback(
    (isOpen: boolean) => {
      popoverCountRef.current += isOpen ? 1 : -1;
      popoverCountRef.current = Math.max(0, popoverCountRef.current);
      // When all popovers close, immediately check if cursor is outside
      if (popoverCountRef.current === 0) {
        checkPointerOutside();
      }
    },
    [checkPointerOutside],
  );

  const contextValue = useMemo(
    () => ({ reportPopoverOpen }),
    [reportPopoverOpen],
  );

  const handleHoverIn = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      // Disarm in the same batch as expanding, so no extra render is needed
      // and rows never show a close button in the first expanded frame.
      // Skip when already expanded (e.g. re-entering from a popover), since
      // the arming effect would not re-run to arm it again.
      if (!isHoveredRef.current) {
        setIsCloseArmed(false);
      }
      setIsHovered(true);
    }, HOVER_DELAY_MS);
  }, [clearHoverTimer]);

  // Keep the latest pointer position while collapsed too, so the close guard
  // can anchor its movement origin to where the pointer rested at expansion.
  const handleContainerPointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handleHoverOut = useCallback(() => {
    clearHoverTimer();
    if (popoverCountRef.current > 0) return;
    setIsHovered(false);
  }, [clearHoverTimer]);

  // Check if Browser or MultiTabBrowser is currently selected
  const isBrowserSelected =
    focusedRouteName === ETabRoutes.Discovery ||
    focusedRouteName === multiTabBrowserRouteName;

  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  // Reset hover state when navigating away from the browser tab
  useEffect(() => {
    if (!isBrowserSelected) {
      clearHoverTimer();
      setIsHovered(false);
    }
  }, [isBrowserSelected, clearHoverTimer]);

  // When expanded, monitor pointer position to detect cursor leaving.
  // Uses coordinate-based check instead of DOM containment because
  // popovers render via portals outside the sidebar DOM tree.
  useEffect(() => {
    if (!isHovered) return;
    if (typeof document === 'undefined') return;

    // Cache the bounding rect so pointermove avoids forcing layout.
    // Refresh on scroll/resize since those can shift the sidebar.
    let cachedRect: DOMRect | null = null;
    let rectRafId: number | null = null;
    const updateCachedRect = () => {
      if (rectRafId !== null) return;
      rectRafId = requestAnimationFrame(() => {
        rectRafId = null;
        const container = containerRef.current;
        if (container) {
          cachedRect = container.getBoundingClientRect();
        }
      });
    };
    // Synchronous initial read — effect runs between frames, no layout thrash.
    const container = containerRef.current;
    if (container) {
      cachedRect = container.getBoundingClientRect();
    }
    window.addEventListener('resize', updateCachedRect);
    window.addEventListener('scroll', updateCachedRect, true);

    let rafId: number | null = null;
    const closeArmGuard = createCloseArmGuard({
      delayMs: CLOSE_ARM_DELAY_MS,
      thresholdPx: POINTER_MOVE_THRESHOLD_PX,
      getLatestPointer: () => lastPointerRef.current,
      onArm: () => setIsCloseArmed(true),
    });

    const handlePointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      closeArmGuard.onPointerMove(lastPointerRef.current);
      if (popoverCountRef.current > 0) return;

      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        // Re-check: popover may have opened between scheduling and execution
        if (popoverCountRef.current > 0) return;
        if (!cachedRect) return;
        const pointer = lastPointerRef.current;
        if (!pointer) return;
        const isInside =
          pointer.x >= cachedRect.left &&
          pointer.x <= cachedRect.left + EXPANDED_SUBMENU_WIDTH &&
          pointer.y >= cachedRect.top &&
          pointer.y <= cachedRect.bottom;
        if (!isInside) {
          clearHoverTimer();
          setIsHovered(false);
        }
      });
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', updateCachedRect);
      window.removeEventListener('scroll', updateCachedRect, true);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (rectRafId !== null) cancelAnimationFrame(rectRafId);
      closeArmGuard.dispose();
    };
  }, [isHovered, clearHoverTimer]);

  type ITabBarProps = { inSubmenu?: boolean; isExpanded?: boolean };

  const webPageTabBarWithProps = useMemo(
    () =>
      cloneElement(webPageTabBar as ReactElement<ITabBarProps>, {
        inSubmenu: true,
        isExpanded: isHovered,
      }),
    [webPageTabBar, isHovered],
  );

  // Early return if conditions not met (after all hooks)
  if (!isShowWebTabBar || !isBrowserSelected) {
    return null;
  }

  return (
    <BrowserSubmenuContext.Provider value={contextValue}>
      <XStack
        ref={containerRef as unknown as Ref<TamaguiElement>}
        position="relative"
        flex={1}
        onPointerMove={handleContainerPointerMove}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
      >
        <VerticalDivider />
        <BrowserSubmenuCloseArmedContext.Provider value={isCloseArmed}>
          <SubmenuColumn
            webPageTabBar={webPageTabBarWithProps}
            isExpanded={isHovered}
          />
        </BrowserSubmenuCloseArmedContext.Provider>
      </XStack>
    </BrowserSubmenuContext.Provider>
  );
}
