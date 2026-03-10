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
  const wasUserDragRef = useRef(false);

  // Track which pages have been visited for lazy mounting.
  // Initial page is marked as visited immediately.
  const [visitedPages, setVisitedPages] = useState<Record<number, boolean>>(
    () => ({
      [initialPage]: true,
    }),
  );

  // Ref to avoid stale closure in onPageSelected
  const selectedHeaderTabRef = useRef(selectedHeaderTab);
  selectedHeaderTabRef.current = selectedHeaderTab;

  // --- Atom -> PagerView sync (programmatic switching) ---
  useEffect(() => {
    const index = TAB_TO_INDEX[selectedHeaderTab];
    if (index !== undefined && index !== currentOuterIndexRef.current) {
      outerPagerRef.current?.setPage(index);
      // Update current index immediately to prevent redundant setPage calls
      currentOuterIndexRef.current = index;
    }
  }, [selectedHeaderTab]);

  const handleOuterPageScrollStateChanged = useCallback(
    (e: PageScrollStateChangedNativeEvent) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'dragging') {
        wasUserDragRef.current = true;
      } else if (state === 'idle') {
        wasUserDragRef.current = false;
      }
    },
    [],
  );

  // --- PagerView -> Atom sync (gesture swiping) ---
  const handleOuterPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const position = e.nativeEvent.position;
      const tab = INDEX_TO_TAB[position];
      currentOuterIndexRef.current = position;

      // Mark page as visited (lazy mount) — only in onPageSelected,
      // not during render, to prevent offscreenPageLimit pre-renders
      // from defeating lazy loading.
      setVisitedPages((prev) => {
        if (prev[position]) return prev;
        return { ...prev, [position]: true };
      });

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
    [],
  );

  // Determine which pages should be rendered
  const activeIndex = TAB_TO_INDEX[selectedHeaderTab] ?? 0;

  // --- Freeze/unfreeze resync ---
  //
  // Why useEffect on activeIndex instead of requestAnimationFrame in onPageSelected:
  //
  // The Freeze/unfreeze is driven by `activeIndex`, which is derived from
  // `selectedHeaderTab` (a Jotai atom updated asynchronously via setSelectedBrowserTab).
  // If we schedule sync in onPageSelected via requestAnimationFrame, the rAF may fire
  // BEFORE the async atom update triggers the React re-render that unfreezes the page.
  //
  // - iOS: UIScrollView ignores setContentOffset while the view is suspended by
  //   react-freeze (Suspense), so the sync is a no-op and the PagerView resets to page 0.
  // - Android: ViewPager2 (RecyclerView-based) is more tolerant — it queues the
  //   setCurrentItem call and applies it even during layout transitions, so the issue
  //   does not manifest.
  //
  // By using useEffect on activeIndex, we guarantee the sync runs AFTER the render
  // commit that unfreezes the page, so the native PagerView is active and responsive.
  const prevActiveIndexRef = useRef(activeIndex);
  useEffect(() => {
    const prev = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activeIndex;
    if (prev === activeIndex) return;

    requestAnimationFrame(() => {
      if (activeIndex === 0) {
        marketTabsRef?.current?.syncCurrentPage();
      } else if (activeIndex === 1) {
        earnBorrowPagerRef?.current?.syncCurrentPage();
        earnTabsRef?.current?.syncCurrentPage();
      }
    });
  }, [activeIndex, marketTabsRef, earnTabsRef, earnBorrowPagerRef]);

  const marketPage = useMemo(
    () =>
      visitedPages[0] ? (
        <View key="market" style={styles.page}>
          <Freeze freeze={activeIndex !== 0}>{marketContent}</Freeze>
        </View>
      ) : (
        <View key="market" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, activeIndex, marketContent],
  );

  const earnPage = useMemo(
    () =>
      visitedPages[1] ? (
        <View key="earn" style={styles.page}>
          <Freeze freeze={activeIndex !== 1}>{earnContent}</Freeze>
        </View>
      ) : (
        <View key="earn" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, activeIndex, earnContent],
  );

  const browserPage = useMemo(
    () =>
      visitedPages[2] ? (
        <View key="browser" style={styles.page}>
          <Freeze freeze={activeIndex !== 2}>{browserContent}</Freeze>
        </View>
      ) : (
        <View key="browser" style={styles.page}>
          <Stack flex={1} />
        </View>
      ),
    [visitedPages, activeIndex, browserContent],
  );

  return (
    <PagerView
      ref={outerPagerRef}
      style={styles.pager}
      initialPage={initialPage}
      scrollEnabled={showDiscoveryPage}
      overdrag={false}
      overScrollMode="never"
      offscreenPageLimit={1}
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
