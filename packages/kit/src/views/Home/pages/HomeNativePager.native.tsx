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

import type { IHomeNativePagerProps } from './HomeNativePager';

export function HomeNativePager({
  ref,
  tabs,
  initialTabName,
  renderHeader,
  renderTabBar,
  onTabChange,
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
  selectedIndexRef.current = selectedIndex;

  const setIndex = useCallback(
    (index: number) => {
      if (!tabs[index]) return;
      pagerRef.current?.setPage(index);
    },
    [tabs],
  );
  const jumpToTab = useCallback(
    (name: string) => {
      setIndex(tabs.findIndex((tab) => tab.name === name));
    },
    [setIndex, tabs],
  );
  useImperativeHandle(
    ref,
    () => ({
      jumpToTab,
      setIndex,
      getCurrentIndex: () => selectedIndexRef.current,
      getFocusedTab: () => tabs[selectedIndexRef.current]?.name ?? '',
      syncCurrentPage: () =>
        pagerRef.current?.setPageWithoutAnimation(selectedIndexRef.current),
    }),
    [jumpToTab, setIndex, tabs],
  );

  // Dynamic network capabilities may remove or reorder tabs. Restore the
  // selected business key instead of leaving native selection at an old index.
  const tabIdentity = tabs.map((tab) => `${tab.id}:${tab.name}`).join('|');
  const previousTabIdentity = useRef(tabIdentity);
  useEffect(() => {
    if (previousTabIdentity.current === tabIdentity) return;
    previousTabIdentity.current = tabIdentity;
    const selectedTab = tabs[selectedIndex];
    if (selectedTab && selectedTab.id !== selectedId) {
      setSelectedId(selectedTab.id);
      onTabChange({ tabName: selectedTab.name });
    }
    focusedTab.value = selectedTab?.name ?? '';
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
        indexDecimal.value = nativeEvent.position + nativeEvent.offset;
      }}
      onPageSelected={({ nativeEvent }) => {
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
