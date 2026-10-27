import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Stack, XStack } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
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

// Opening slides the sidebar in from the left (a transform, on the 200ms
// `fast` preset) in both modes; closing is instant. Animating the docked
// column's width instead relaid the chart out every frame.
const SLIDE_TRANSITION = 'fast';
const SLIDE_ANIMATE_ONLY: string[] = ['transform'];
const DOCKED_ENTER_STYLE = { x: -MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH };
// The overlay starts fully out of view, its shadow included.
const OVERLAY_ENTER_STYLE = {
  x: -(MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH + 32),
};

export function MarketDetailWatchlistSidebarFrame({
  hidden,
  children,
}: {
  // Fullscreen charts take the whole window, so the sidebar steps aside.
  hidden?: boolean;
  children: ReactNode;
}) {
  const [{ open: savedDockedOpen }, setPersist] =
    useMarketDetailWatchlistSidebarPersistAtom();
  const [{ data: watchListData, isMounted: isWatchListMounted }] =
    useMarketWatchListV2Atom();
  // Until the user picks a state, the sidebar opens for users who have
  // favorites. The answer is fixed once the watchlist loads, so removing the
  // last favorite from the open sidebar does not snap it shut.
  const [defaultDockedOpen, setDefaultDockedOpen] = useState<
    boolean | undefined
  >(undefined);
  if (defaultDockedOpen === undefined && isWatchListMounted) {
    setDefaultDockedOpen((watchListData?.length ?? 0) > 0);
  }
  const dockedOpen = savedDockedOpen ?? defaultDockedOpen ?? false;
  const [overlayOpen, setOverlayOpen] = useState(false);
  // The mode waits for the frame's own width: the window's also counts the
  // app navigation, so seeding from it could mount the docked sidebar (and
  // start its fetch) only to turn it into a closed overlay one layout later.
  // Until then neither sidebar nor the header toggle renders.
  const [frameWidth, setFrameWidth] = useState<number | undefined>(undefined);
  const isReady = frameWidth !== undefined;

  const mode: IMarketDetailWatchlistSidebarMode =
    frameWidth === undefined ||
    frameWidth >= MARKET_DETAIL_WATCHLIST_SIDEBAR_DOCK_MIN_WIDTH
      ? 'docked'
      : 'overlay';
  const isOpen = mode === 'docked' ? dockedOpen : overlayOpen;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setFrameWidth(event.nativeEvent.layout.width);
  }, []);

  // Only an open the user asks for slides in; a docked sidebar that is
  // already open when the page appears shows in place.
  const [animateDockedEnter, setAnimateDockedEnter] = useState(false);

  const setOpen = useCallback(
    (open: boolean) => {
      if (mode === 'docked') {
        if (open) setAnimateDockedEnter(true);
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
      isReady,
      mode,
      isOpen,
      toggle: () => setOpen(!isOpen),
      close,
    }),
    [close, isOpen, isReady, mode, setOpen],
  );

  const showDocked = isReady && !hidden && mode === 'docked' && isOpen;
  const showOverlay = isReady && !hidden && mode === 'overlay' && isOpen;

  return (
    <MarketDetailWatchlistSidebarContext.Provider value={contextValue}>
      {/* Clips the sidebar while it slides, so it never draws over the app's
          own navigation to the left. */}
      <XStack flex={1} minWidth={0} overflow="hidden" onLayout={handleLayout}>
        {showDocked ? (
          <Stack
            testID="market-detail-watchlist-sidebar-docked"
            transition={SLIDE_TRANSITION}
            animateOnly={SLIDE_ANIMATE_ONLY}
            enterStyle={animateDockedEnter ? DOCKED_ENTER_STYLE : undefined}
          >
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
              transition={SLIDE_TRANSITION}
              animateOnly={SLIDE_ANIMATE_ONLY}
              enterStyle={OVERLAY_ENTER_STYLE}
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
