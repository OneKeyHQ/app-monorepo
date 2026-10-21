import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Dimensions } from 'react-native';

import { Stack, XStack } from '@onekeyhq/components';
import { useMarketDetailWatchlistSidebarPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH,
  MarketDetailWatchlistSidebar,
} from './MarketDetailWatchlistSidebar';
import { MarketDetailWatchlistSidebarContext } from './MarketDetailWatchlistSidebarContext';

import type {
  IMarketDetailWatchlistSidebarContextValue,
  IMarketDetailWatchlistSidebarMode,
} from './MarketDetailWatchlistSidebarContext';
import type { LayoutChangeEvent } from 'react-native';

// The desktop detail layout starts at a 1024px window, which leaves the detail
// content about 952px beside the 72px app nav. Docking the sidebar only once
// that much is still left keeps the main column at least as wide as the
// narrowest window it already supports; below that it opens as an overlay.
const MARKET_DETAIL_NARROWEST_CONTENT_WIDTH = 952;
export const MARKET_DETAIL_WATCHLIST_SIDEBAR_DOCK_MIN_WIDTH =
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH + MARKET_DETAIL_NARROWEST_CONTENT_WIDTH;

export function MarketDetailWatchlistSidebarFrame({
  hidden,
  children,
}: {
  // Fullscreen charts take the whole window, so the sidebar steps aside.
  hidden?: boolean;
  children: ReactNode;
}) {
  const [{ open: dockedOpen }, setPersist] =
    useMarketDetailWatchlistSidebarPersistAtom();
  const [overlayOpen, setOverlayOpen] = useState(false);
  // Seeded from the window so the first paint already picks the right mode;
  // a narrow window would otherwise flash the docked sidebar (and start its
  // fetch) before the first layout pass turns it into the overlay.
  const [frameWidth, setFrameWidth] = useState(
    () => Dimensions.get('window').width,
  );

  const mode: IMarketDetailWatchlistSidebarMode =
    frameWidth >= MARKET_DETAIL_WATCHLIST_SIDEBAR_DOCK_MIN_WIDTH
      ? 'docked'
      : 'overlay';
  const isOpen = mode === 'docked' ? dockedOpen : overlayOpen;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setFrameWidth(event.nativeEvent.layout.width);
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      if (mode === 'docked') {
        setPersist((prev) => ({ ...prev, open }));
      } else {
        setOverlayOpen(open);
      }
    },
    [mode, setPersist],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  const closeOverlay = useCallback(() => setOverlayOpen(false), []);

  const contextValue = useMemo<IMarketDetailWatchlistSidebarContextValue>(
    () => ({
      mode,
      isOpen,
      toggle: () => setOpen(!isOpen),
      close,
    }),
    [close, isOpen, mode, setOpen],
  );

  const showDocked = !hidden && mode === 'docked' && isOpen;
  const showOverlay = !hidden && mode === 'overlay' && isOpen;

  return (
    <MarketDetailWatchlistSidebarContext.Provider value={contextValue}>
      <XStack flex={1} minWidth={0} onLayout={handleLayout}>
        {showDocked ? (
          <Stack testID="market-detail-watchlist-sidebar-docked">
            <MarketDetailWatchlistSidebar onClose={close} />
          </Stack>
        ) : null}
        {/* Children keep one tree position across modes so the chart and the
            scroll container never remount when the sidebar docks or floats. */}
        <Stack flex={1} minWidth={0} position="relative">
          {children}
          {showOverlay ? (
            <Stack
              testID="market-detail-watchlist-sidebar-overlay"
              position="absolute"
              left={0}
              top={0}
              bottom={0}
              zIndex={10}
            >
              <MarketDetailWatchlistSidebar
                elevated
                onClose={closeOverlay}
                onNavigate={closeOverlay}
              />
            </Stack>
          ) : null}
        </Stack>
      </XStack>
    </MarketDetailWatchlistSidebarContext.Provider>
  );
}
