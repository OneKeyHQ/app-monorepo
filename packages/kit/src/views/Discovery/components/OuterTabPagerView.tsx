import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

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
}: IOuterTabPagerViewProps) {
  const initialPage = TAB_TO_INDEX[selectedHeaderTab] ?? 0;
  const outerPagerRef = useRef<PagerView>(null);
  const currentOuterIndexRef = useRef(initialPage);
  const [activePageIndex, setActivePageIndex] = useState(initialPage);
  const wasUserDragRef = useRef(false);
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
      setTransitioning(true);
      setVisiblePair([previousIndex, index]);
      outerPagerRef.current?.setPage(index);
      // Update current index immediately to prevent redundant setPage calls
      currentOuterIndexRef.current = index;
      setActivePageIndex(index);
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

  // During horizontal swipe, pre-mount the neighbor page and keep only
  // the current + target pages unfrozen to avoid black frames.
  const handleOuterPageScroll = useCallback(
    (e: PagerViewOnPageScrollEvent) => {
      const { position, offset } = e.nativeEvent;
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

  // --- PagerView -> Atom sync (gesture swiping) ---
  const handleOuterPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const position = e.nativeEvent.position;
      const tab = INDEX_TO_TAB[position];
      currentOuterIndexRef.current = position;
      setActivePageIndex(position);

      // Mark page as visited (lazy mount) — only in onPageSelected,
      // not during render, to prevent offscreenPageLimit pre-renders
      // from defeating lazy loading.
      markPagesVisited([position]);

      // Persist tab only for user-gesture swipes.
      // iOS may emit synthetic onPageSelected during freeze/unfreeze.
      if (!wasUserDragRef.current) {
        return;
      }

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

  // --- Freeze/unfreeze resync ---
  //
  // Why useEffect on activeIndex instead of requestAnimationFrame in onPageSelected:
  //
  // The freeze/unfreeze sync is driven by `activePageIndex`, which updates
  // immediately from PagerView selection events (or programmatic tab changes).
  // If we schedule sync in onPageSelected via requestAnimationFrame, the rAF may fire
  // before the render commit that applies the new freeze state.
  //
  // - iOS: UIScrollView ignores setContentOffset while the view is suspended by
  //   react-freeze (Suspense), so the sync is a no-op and the PagerView resets to page 0.
  // - Android: ViewPager2 (RecyclerView-based) is more tolerant — it queues the
  //   setCurrentItem call and applies it even during layout transitions, so the issue
  //   does not manifest.
  //
  // By using useEffect on activePageIndex, we guarantee the sync runs AFTER the render
  // commit that unfreezes the page, so the native PagerView is active and responsive.
  const prevActiveIndexRef = useRef(activePageIndex);
  useEffect(() => {
    const prev = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activePageIndex;
    if (prev === activePageIndex) return;

    requestAnimationFrame(() => {
      if (activePageIndex === 0) {
        marketTabsRef?.current?.syncCurrentPage();
      } else if (activePageIndex === 1) {
        earnBorrowPagerRef?.current?.syncCurrentPage();
        earnTabsRef?.current?.syncCurrentPage();
      }
    });
  }, [activePageIndex, marketTabsRef, earnTabsRef, earnBorrowPagerRef]);

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
    <PagerView
      ref={outerPagerRef}
      style={styles.pager}
      initialPage={initialPage}
      scrollEnabled={showDiscoveryPage}
      overdrag
      overScrollMode="always"
      offscreenPageLimit={1}
      onPageScroll={handleOuterPageScroll}
      onPageScrollStateChanged={handleOuterPageScrollStateChanged}
      onPageSelected={handleOuterPageSelected}
    >
      {marketPage}
      {earnPage}
      {browserPage}
    </PagerView>
  );
}

export const OuterTabPagerView = memo(OuterTabPagerViewComponent);
