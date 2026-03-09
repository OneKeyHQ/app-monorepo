import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import type { ITabContainerRef } from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

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
}: IOuterTabPagerViewProps) {
  const initialPage = TAB_TO_INDEX[selectedHeaderTab] ?? 0;
  const outerPagerRef = useRef<PagerView>(null);
  const currentOuterIndexRef = useRef(initialPage);

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

  // Track previous active index for freeze/unfreeze sync
  const prevActiveIndexRef = useRef(initialPage);

  // --- Atom -> PagerView sync (programmatic switching) ---
  useEffect(() => {
    const index = TAB_TO_INDEX[selectedHeaderTab];
    if (index !== undefined && index !== currentOuterIndexRef.current) {
      outerPagerRef.current?.setPage(index);
      // Update current index immediately to prevent redundant setPage calls
      currentOuterIndexRef.current = index;
    }
  }, [selectedHeaderTab]);

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

      // Sync inner pager on re-activation (freeze/unfreeze resync)
      const prevIndex = prevActiveIndexRef.current;
      prevActiveIndexRef.current = position;

      if (prevIndex !== position) {
        requestAnimationFrame(() => {
          if (position === 0) {
            marketTabsRef?.current?.syncCurrentPage();
          } else if (position === 1) {
            earnTabsRef?.current?.syncCurrentPage();
          }
        });
      }

      // Update atom only if tab actually changed
      if (tab && tab !== selectedHeaderTabRef.current) {
        void backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
      }
    },
    [marketTabsRef, earnTabsRef],
  );

  // Determine which pages should be rendered
  const activeIndex = TAB_TO_INDEX[selectedHeaderTab] ?? 0;

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
      onPageSelected={handleOuterPageSelected}
    >
      {marketPage}
      {earnPage}
      {browserPage}
    </PagerView>
  );
}

export const OuterTabPagerView = memo(OuterTabPagerViewComponent);
