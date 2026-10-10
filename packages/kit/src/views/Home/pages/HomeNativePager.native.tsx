import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { View } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@onekeyhq/components';

import { HomeNativeTabContext } from '../hooks/useHomeTab.native';

import { debugPerpsChain } from './perpsChainTrace';

import type { IHomeNativePagerProps } from './HomeNativePager';

export function HomeNativePager({
  ref,
  tabs,
  initialTabName,
  renderHeader,
  renderTabBar,
  onTabChange,
  onTabPrepare,
}: IHomeNativePagerProps) {
  const initialIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.name === initialTabName),
  );
  const [selectedId, setSelectedId] = useState(tabs[initialIndex]?.id);
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedId),
  );
  const [headerHeight, setHeaderHeight] = useState(182);
  const [stickyHeight, setStickyHeight] = useState(48);
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const focusedTab = useSharedValue(tabs[initialIndex]?.name ?? '');
  const indexDecimal = useSharedValue(initialIndex);
  const theme = useTheme();
  const selectedIndexRef = useRef(selectedIndex);
  const followsPageScrollRef = useRef(true);
  const dragRef = useRef<{
    startIndex: number;
    preparedIndices: Set<number>;
  } | null>(null);
  selectedIndexRef.current = selectedIndex;

  const setIndex = useCallback(
    (index: number) => {
      debugPerpsChain('pager.command', { index });
      if (!tabs[index]) return;
      dragRef.current = null;
      if (Math.abs(index - selectedIndexRef.current) > 1) {
        // Immediate jumps may omit progress events; ignore queued old progress
        // until the next drag or animated command takes ownership.
        followsPageScrollRef.current = false;
        indexDecimal.value = index;
        pagerRef.current?.setPageWithoutAnimation(index);
      } else {
        followsPageScrollRef.current = true;
        pagerRef.current?.setPage(index);
      }
    },
    [indexDecimal, tabs],
  );
  const jumpToTab = useCallback(
    (name: string) => {
      setIndex(tabs.findIndex((tab) => tab.name === name));
    },
    [setIndex, tabs],
  );
  const syncCurrentPage = useCallback(() => {
    dragRef.current = null;
    followsPageScrollRef.current = false;
    indexDecimal.value = selectedIndexRef.current;
    pagerRef.current?.setPageWithoutAnimation(selectedIndexRef.current);
  }, [indexDecimal]);
  useImperativeHandle(
    ref,
    () => ({
      jumpToTab,
      setIndex,
      getCurrentIndex: () => selectedIndexRef.current,
      getFocusedTab: () => tabs[selectedIndexRef.current]?.name ?? '',
      syncCurrentPage,
    }),
    [jumpToTab, setIndex, syncCurrentPage, tabs],
  );

  // Dynamic network capabilities may remove or reorder tabs. Restore the
  // selected business key instead of leaving native selection at an old index.
  const tabIdentity = tabs.map((tab) => `${tab.id}:${tab.name}`).join('|');
  const previousTabIdentity = useRef(tabIdentity);
  useEffect(() => {
    if (previousTabIdentity.current === tabIdentity) return;
    previousTabIdentity.current = tabIdentity;
    dragRef.current = null;
    const selectedTab = tabs[selectedIndex];
    if (selectedTab && selectedTab.id !== selectedId) {
      setSelectedId(selectedTab.id);
      onTabChange({ tabName: selectedTab.name });
    }
    focusedTab.value = selectedTab?.name ?? '';
    followsPageScrollRef.current = false;
    indexDecimal.value = selectedIndex;
    pagerRef.current?.setPageWithoutAnimation(selectedIndex);
  }, [
    tabIdentity,
    tabs,
    selectedId,
    selectedIndex,
    focusedTab,
    indexDecimal,
    onTabChange,
  ]);

  const pageContexts = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        isFocused: tab.id === tabs[selectedIndex]?.id,
      })),
    [tabs, selectedIndex],
  );
  const tabBarProps = useMemo(
    () => ({ focusedTab, indexDecimal, onTabPress: jumpToTab }),
    [focusedTab, indexDecimal, jumpToTab],
  );
  return (
    <CollapsiblePagerView
      ref={pagerRef}
      style={{ flex: 1, backgroundColor: theme.bgApp.val }}
      initialPage={initialIndex}
      nestedScrollEnabled
      nativeSmoothHeaderScrollEnabled
      headerHeight={headerHeight}
      stickyHeaderHeight={stickyHeight}
      // Spot remains the owner of shared asset loading even while offscreen.
      pageRetentionDistance={tabs.length}
      offscreenPageLimit={Math.max(1, tabs.length - 1)}
      header={
        <View
          onLayout={(event) =>
            setHeaderHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          {renderHeader()}
        </View>
      }
      stickyHeader={
        <View
          style={{ backgroundColor: theme.bgApp.val }}
          onLayout={(event) =>
            setStickyHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          {renderTabBar(tabBarProps)}
        </View>
      }
      onPageScroll={({ nativeEvent }) => {
        const progress = nativeEvent.position + nativeEvent.offset;
        if (followsPageScrollRef.current) {
          indexDecimal.value = progress;
        }
        const drag = dragRef.current;
        if (drag && progress !== drag.startIndex) {
          const targetIndex =
            drag.startIndex + (progress > drag.startIndex ? 1 : -1);
          const target = tabs[targetIndex];
          if (target && !drag.preparedIndices.has(targetIndex)) {
            drag.preparedIndices.add(targetIndex);
            debugPerpsChain('pager.prepare', {
              index: targetIndex,
              progress,
              selectedIndex: selectedIndexRef.current,
            });
            onTabPrepare?.({ tabId: target.id });
          }
        }
      }}
      onPageScrollStateChanged={({ nativeEvent }) => {
        if (nativeEvent.pageScrollState === 'dragging') {
          followsPageScrollRef.current = true;
          dragRef.current = {
            startIndex: selectedIndexRef.current,
            preparedIndices: new Set(),
          };
          debugPerpsChain('pager.drag.start', {
            index: selectedIndexRef.current,
          });
        } else if (nativeEvent.pageScrollState === 'idle') {
          debugPerpsChain('pager.drag.end', {
            index: selectedIndexRef.current,
          });
          dragRef.current = null;
        }
      }}
      onPageSelected={({ nativeEvent }) => {
        debugPerpsChain('pager.selected.receive', {
          index: nativeEvent.position,
        });
        const tab = tabs[nativeEvent.position];
        if (!tab) return;
        setSelectedId(tab.id);
        focusedTab.value = tab.name;
        onTabChange({ tabName: tab.name });
      }}
    >
      {tabs.map((tab, index) => (
        <View key={tab.id} collapsable={false} style={{ flex: 1 }}>
          <HomeNativeTabContext.Provider value={pageContexts[index]}>
            {tab.component}
          </HomeNativeTabContext.Provider>
        </View>
      ))}
    </CollapsiblePagerView>
  );
}
