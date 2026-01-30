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

import { SubmenuColumn } from './SubmenuColumn';
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

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleHoverIn = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, HOVER_DELAY_MS);
  }, [clearHoverTimer]);

  const handleHoverOut = useCallback(() => {
    clearHoverTimer();
    setIsHovered(false);
  }, [clearHoverTimer]);

  useEffect(() => clearHoverTimer, [clearHoverTimer]);

  // Check if Browser or MultiTabBrowser is currently selected
  const isBrowserSelected =
    focusedRouteName === ETabRoutes.Discovery ||
    focusedRouteName === multiTabBrowserRouteName;

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
    <XStack
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
  );
}
