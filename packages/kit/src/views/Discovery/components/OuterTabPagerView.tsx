import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  runOnJS,
  useAnimatedRef,
  useEvent,
  useHandler,
} from 'react-native-reanimated';

import type { ITabContainerRef } from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IEarnBorrowPagerViewRef } from '../../Earn/components/EarnBorrowPagerView';
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewOnPageScrollEvent,
  PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import type { SharedValue } from 'react-native-reanimated';

// --- AnimatedPagerView: enables worklet-based onPageScroll on the UI thread ---

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

// --- Styles (defined before component to satisfy no-use-before-define) ---

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});

// --- Tab <-> Index mapping ---

const TAB_TO_INDEX: Record<string, number> = {
  [ETranslations.global_market]: 0,
  [ETranslations.global_earn]: 1,
  [ETranslations.global_browser]: 2,
};

const INDEX_TO_TAB: ETranslations[] = [
  ETranslations.global_market,
  ETranslations.global_earn,
  ETranslations.global_browser,
];

// --- Worklet-based page scroll handler (same pattern as collapsible-tab-view) ---

function usePageScrollHandler(
  handlers: {
    onPageScroll: (
      event: PagerViewOnPageScrollEvent['nativeEvent'],
      context: Record<string, unknown>,
    ) => void;
  },
  dependencies?: unknown[],
): (event: PagerViewOnPageScrollEvent) => void {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);

  // Reanimated's useEvent return type (EventHandlerProcessed) doesn't match
  // AnimatedPagerView's onPageScroll prop (DirectEventHandler), but they are
  // compatible at runtime — Reanimated intercepts the native event internally.
  return useEvent(
    (
      event: { eventName: string } & PagerViewOnPageScrollEvent['nativeEvent'],
    ) => {
      'worklet';

      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    ['onPageScroll'],
    doDependenciesDiffer,
  ) as unknown as (event: PagerViewOnPageScrollEvent) => void;
}

// --- Types ---

interface IOuterTabPagerViewProps {
  selectedHeaderTab: ETranslations;
  showDiscoveryPage: boolean;
  marketContent: React.ReactNode;
  earnContent: React.ReactNode;
  browserContent: React.ReactNode;
  marketTabsRef?: React.RefObject<ITabContainerRef | null>;
  earnTabsRef?: React.RefObject<ITabContainerRef | null>;
  earnBorrowPagerRef?: React.RefObject<IEarnBorrowPagerViewRef | null>;
  pageScrollPosition?: SharedValue<number>;
}

// --- Component ---

function OuterTabPagerViewComponent({
  selectedHeaderTab,
  showDiscoveryPage,
  marketContent,
  earnContent,
  browserContent,
  marketTabsRef,
  earnTabsRef,
  earnBorrowPagerRef,
  pageScrollPosition,
}: IOuterTabPagerViewProps) {
  const initialPage = TAB_TO_INDEX[selectedHeaderTab] ?? 0;
  const outerPagerRef = useAnimatedRef<PagerView>();
  const currentOuterIndexRef = useRef(initialPage);
  const [activePageIndex, setActivePageIndex] = useState(initialPage);
  const wasUserDragRef = useRef(false);
  const isProgrammaticSwitchRef = useRef(false);
  const [isOuterPageTransitioning, setIsOuterPageTransitioning] =
    useState(false);
  const isOuterPageTransitioningRef = useRef(false);
  const [visiblePagePair, setVisiblePagePair] = useState<
    [number, number] | null
  >(null);
  const visiblePagePairRef = useRef<[number, number] | null>(null);

  // Track which pages have been visited for lazy mounting.
  // Initial page is marked as visited immediately.
  const [visitedPages, setVisitedPages] = useState<Record<number, boolean>>(
    () => ({
      [initialPage]: true,
    }),
  );
  const visitedPagesRef = useRef<Record<number, boolean>>({
    [initialPage]: true,
  });

  // Ref to avoid stale closure in onPageSelected
  const selectedHeaderTabRef = useRef(selectedHeaderTab);
  selectedHeaderTabRef.current = selectedHeaderTab;

  const setTransitioning = useCallback((value: boolean) => {
    if (isOuterPageTransitioningRef.current === value) {
      return;
    }
    isOuterPageTransitioningRef.current = value;
    setIsOuterPageTransitioning(value);
  }, []);

  const setVisiblePair = useCallback((pair: [number, number] | null) => {
    const prev = visiblePagePairRef.current;
    if (
      prev === pair ||
      (prev && pair && prev[0] === pair[0] && prev[1] === pair[1])
    ) {
      return;
    }
    visiblePagePairRef.current = pair;
    setVisiblePagePair(pair);
  }, []);

  const markPagesVisited = useCallback((indexes: number[]) => {
    const deduped = Array.from(new Set(indexes));
    const nextVisited = { ...visitedPagesRef.current };
    let changed = false;
    deduped.forEach((index) => {
      if (!nextVisited[index]) {
        nextVisited[index] = true;
        changed = true;
      }
    });
    if (!changed) {
      return;
    }
    visitedPagesRef.current = nextVisited;
    setVisitedPages(nextVisited);
  }, []);

  // --- Atom -> PagerView sync (programmatic switching) ---
  useEffect(() => {
    const index = TAB_TO_INDEX[selectedHeaderTab];
    if (index !== undefined) {
      // Ensure target page is mounted before transition to avoid blank content.
      markPagesVisited([index]);
    }
    if (index !== undefined && index !== currentOuterIndexRef.current) {
      const previousIndex = currentOuterIndexRef.current;
      isProgrammaticSwitchRef.current = true;
      setTransitioning(true);
      setVisiblePair([previousIndex, index]);
      // Update current index immediately to prevent redundant setPage calls
      currentOuterIndexRef.current = index;
      setActivePageIndex(index);
      // NOTE: setPage() is NOT called here. react-freeze (Suspense with
      // fallback=null) removes native views when frozen. The state updates
      // above are batched and won't unfreeze the target page until the next
      // render commit. Calling setPage() here would scroll PagerView to a
      // page whose native views haven't been re-created yet, causing a
      // white flash on iOS. Instead, setPage() is deferred to the
      // prevActiveIndexRef effect below, which runs after the render that
      // unfreezes the target page.
    }
  }, [markPagesVisited, selectedHeaderTab, setTransitioning, setVisiblePair]);

  const handleOuterPageScrollStateChanged = useCallback(
    (e: PageScrollStateChangedNativeEvent) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'dragging') {
        wasUserDragRef.current = true;
        setTransitioning(true);
      } else if (state === 'settling') {
        setTransitioning(true);
      } else if (state === 'idle') {
        wasUserDragRef.current = false;
        setTransitioning(false);
        setVisiblePair(null);
      }
    },
    [setTransitioning, setVisiblePair],
  );

  // JS-thread handler for freeze/unfreeze logic during user-gesture swipes.
  // Called from the worklet-based onPageScroll via runOnJS.
  const handlePageScrollJS = useCallback(
    (position: number, offset: number) => {
      if (!wasUserDragRef.current) {
        return;
      }
      if (offset <= 0) {
        return;
      }
      const nextPosition = Math.min(position + 1, INDEX_TO_TAB.length - 1);
      const prevPair = visiblePagePairRef.current;
      if (
        prevPair &&
        prevPair[0] === position &&
        prevPair[1] === nextPosition
      ) {
        return;
      }
      setVisiblePair([position, nextPosition]);
      markPagesVisited([position, nextPosition]);
    },
    [markPagesVisited, setVisiblePair],
  );

  // Worklet-based onPageScroll: updates pageScrollPosition on the UI thread
  // with zero bridge overhead, then dispatches freeze logic to JS thread.
  const pageScrollHandler = usePageScrollHandler({
    onPageScroll: (e) => {
      'worklet';

      const position = e.position;
      const offset = e.offset;

      if (pageScrollPosition) {
        pageScrollPosition.value = position + offset;
      }

      runOnJS(handlePageScrollJS)(position, offset);
    },
  });

  // --- PagerView -> Atom sync (gesture swiping) ---
  const handleOuterPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const position = e.nativeEvent.position;
      const tab = INDEX_TO_TAB[position];

      // Only update state for user-gesture swipes.
      // iOS may emit synthetic onPageSelected during freeze/unfreeze,
      // which would override activePageIndex and cancel the deferred
      // setPage() rAF for programmatic tab switches.
      if (!wasUserDragRef.current) {
        return;
      }

      currentOuterIndexRef.current = position;
      setActivePageIndex(position);
      markPagesVisited([position]);

      // Update atom only if tab actually changed
      if (tab && tab !== selectedHeaderTabRef.current) {
        void backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
      }
    },
    [markPagesVisited],
  );

  // Determine which pages should be rendered
  const shouldFreezePage = useCallback(
    (pageIndex: number) => {
      if (isOuterPageTransitioning) {
        if (visiblePagePair) {
          return (
            visiblePagePair[0] !== pageIndex && visiblePagePair[1] !== pageIndex
          );
        }
        return activePageIndex !== pageIndex;
      }
      return activePageIndex !== pageIndex;
    },
    [activePageIndex, isOuterPageTransitioning, visiblePagePair],
  );

  // --- Freeze/unfreeze resync & programmatic page scroll ---
  //
  // This effect runs AFTER the render commit that unfreezes the target page.
  // It handles two tasks:
  //
  // 1. Scroll PagerView to the target page (programmatic tab switches only).
  //    setPage() must be called here — NOT in the selectedHeaderTab effect —
  //    because react-freeze v1 uses Suspense with fallback=null, which removes
  //    native views when frozen. Calling setPage() before the unfreeze render
  //    scrolls PagerView to a blank page, causing a white flash on iOS.
  //
  // 2. Sync inner tab containers (Market/Earn) after freeze/unfreeze.
  //    iOS UIScrollView ignores setContentOffset while suspended by react-freeze,
  //    so syncing must happen after the render commit that unfreezes the page.
  const prevActiveIndexRef = useRef(activePageIndex);
  useEffect(() => {
    const prev = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activePageIndex;
    if (prev === activePageIndex) return;

    const rafId = requestAnimationFrame(() => {
      // Only scroll PagerView for programmatic switches (header tab taps).
      // For user-gesture swipes, PagerView already handles scrolling natively.
      if (isProgrammaticSwitchRef.current) {
        isProgrammaticSwitchRef.current = false;
        outerPagerRef.current?.setPage(activePageIndex);
      }

      if (activePageIndex === 0) {
        marketTabsRef?.current?.syncCurrentPage();
      } else if (activePageIndex === 1) {
        earnBorrowPagerRef?.current?.syncCurrentPage();
        earnTabsRef?.current?.syncCurrentPage();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    activePageIndex,
    outerPagerRef,
    marketTabsRef,
    earnTabsRef,
    earnBorrowPagerRef,
  ]);

  const marketPage = useMemo(
    () =>
      visitedPages[0] ? (
        <View key="market" style={styles.page}>
          <Freeze freeze={shouldFreezePage(0)}>{marketContent}</Freeze>
        </View>
      ) : (
        <View key="market" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, shouldFreezePage, marketContent],
  );

  const earnPage = useMemo(
    () =>
      visitedPages[1] ? (
        <View key="earn" style={styles.page}>
          <Freeze freeze={shouldFreezePage(1)}>{earnContent}</Freeze>
        </View>
      ) : (
        <View key="earn" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, shouldFreezePage, earnContent],
  );

  const browserPage = useMemo(
    () =>
      visitedPages[2] ? (
        <View key="browser" style={styles.page}>
          <Freeze freeze={shouldFreezePage(2)}>{browserContent}</Freeze>
        </View>
      ) : (
        <View key="browser" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, shouldFreezePage, browserContent],
  );

  return (
    <AnimatedPagerView
      ref={outerPagerRef}
      style={styles.pager}
      initialPage={initialPage}
      scrollEnabled={showDiscoveryPage}
      overdrag
      overScrollMode="always"
      scrollSensitivity={4}
      offscreenPageLimit={1}
      onPageScroll={pageScrollHandler}
      onPageScrollStateChanged={handleOuterPageScrollStateChanged}
      onPageSelected={handleOuterPageSelected}
    >
      {marketPage}
      {earnPage}
      {browserPage}
    </AnimatedPagerView>
  );
}

export const OuterTabPagerView = memo(OuterTabPagerViewComponent);
