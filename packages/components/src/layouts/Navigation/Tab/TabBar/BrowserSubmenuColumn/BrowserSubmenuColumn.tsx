import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement } from 'react';

import { XStack } from '@onekeyhq/components/src/primitives';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import { BrowserSubmenuContext } from './BrowserSubmenuContext';
import { EXPANDED_SUBMENU_WIDTH, SubmenuColumn } from './SubmenuColumn';
import { VerticalDivider } from './VerticalDivider';

export interface IBrowserSubmenuColumnProps {
  webPageTabBar: ReactElement;
  focusedRouteName?: string;
  multiTabBrowserRouteName?: string;
}

const HOVER_DELAY_MS = 150;

// Browser submenu only shows on desktop and iOS (iPad)
const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;

export function BrowserSubmenuColumn({
  webPageTabBar,
  focusedRouteName,
  multiTabBrowserRouteName,
}: IBrowserSubmenuColumnProps) {
  const [isHovered, setIsHovered] = useState(false);
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
      setIsHovered(true);
    }, HOVER_DELAY_MS);
  }, [clearHoverTimer]);

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
  // Only runs on web/desktop — native iOS relies on onHoverIn/onHoverOut.
  useEffect(() => {
    if (!isHovered) return;
    if (typeof document === 'undefined') return;

    const handlePointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      // Don't collapse while a child popover (e.g. context menu) is open
      if (popoverCountRef.current > 0) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.left + EXPANDED_SUBMENU_WIDTH &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!isInside) {
        clearHoverTimer();
        setIsHovered(false);
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
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
        ref={containerRef}
        position="relative"
        flex={1}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        <VerticalDivider />
        <SubmenuColumn
          webPageTabBar={webPageTabBarWithProps}
          isExpanded={isHovered}
        />
      </XStack>
    </BrowserSubmenuContext.Provider>
  );
}
