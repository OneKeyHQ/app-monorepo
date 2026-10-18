import {
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { View } from 'react-native';
import {
  CollapsiblePagerView,
  ScrollEdgeEffect,
} from 'react-native-pager-view';

import { useTheme, useThemeName } from '@onekeyhq/components';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';

import { SpotlightScrollStateContext } from '../../../components/Spotlight/SpotlightScrollStateContext';
import { HomeNativeTabContext } from '../hooks/useHomeTab.native';

import { debugPerpsChain } from './perpsChainTrace';

import type { IHomeNativePagerProps } from './HomeNativePager';
import type { ISpotlightScrollState } from '../../../components/Spotlight/SpotlightScrollStateContext';

export function HomeNativePager({
  ref,
  tabs,
  initialTabName,
  headerHeightHint,
  renderHeader,
  topOverlay,
  onTopScrollEdgeCapability,
  topEdgeActive,
  renderTabBar,
  onTabChange,
  onTabPrepare,
}: IHomeNativePagerProps) {
  const [headerLayout, setHeaderLayout] = useState({
    hint: headerHeightHint,
    height: headerHeightHint ?? 182,
    generation: 0,
  });
  if (headerLayout.hint !== headerHeightHint) {
    // Reset before committing a new header variant, including A -> B -> A.
    setHeaderLayout({
      hint: headerHeightHint,
      height: headerHeightHint ?? 182,
      generation: headerLayout.generation + 1,
    });
  }
  const [stickyHeight, setStickyHeight] = useState(48);
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const theme = useTheme();
  const themeName = useThemeName();
  const capabilityCallbackRef = useRef(onTopScrollEdgeCapability);
  capabilityCallbackRef.current = onTopScrollEdgeCapability;
  const capabilitySessionRef = useRef<{
    active: boolean;
    mounted: boolean;
    lastAvailable: boolean | undefined;
  }>({
    active: false,
    mounted: false,
    lastAvailable: topEdgeActive ? true : undefined,
  });
  useLayoutEffect(() => {
    const session = capabilitySessionRef.current;
    session.active = true;
    session.mounted = true;
    if (session.lastAvailable !== undefined) {
      capabilityCallbackRef.current?.(session.lastAvailable);
    }
    return () => {
      session.active = false;
      capabilityCallbackRef.current?.(false);
    };
  }, []);
  const mountedPageKeysRef = useRef<{
    pageIdentity: string;
    keys: readonly string[];
  } | null>(null);
  const [spotlightScrollState, setSpotlightScrollState] = useState<
    (ISpotlightScrollState & { pageIdentity: string }) | null
  >(null);
  const followsPageScrollRef = useRef(true);
  const dragRef = useRef<{
    startIndex: number;
    preparedIndices: Set<number>;
  } | null>(null);
  const controller = useAppPagerController({
    pages: tabs.map((tab) => ({ key: tab.id, name: tab.name })),
    initialTabName,
    pagerRef,
    onSelectionChange: ({ tabName }) => onTabChange({ tabName }),
    onBeforeCommand: (index, animated, reason) => {
      if (reason !== 'reconcile') setSpotlightScrollState(null);
      dragRef.current = null;
      followsPageScrollRef.current = animated;
      if (reason === 'command') debugPerpsChain('pager.command', { index });
    },
  });
  const {
    initialIndex,
    selectedIndex,
    selectedIndexRef,
    focusedTab,
    indexDecimal,
    jumpToTab,
    setIndex,
    syncCurrentPage,
    getCurrentIndex,
    getFocusedTab,
  } = controller;
  useImperativeHandle(
    ref,
    () => ({
      jumpToTab,
      setIndex,
      getCurrentIndex,
      getFocusedTab,
      syncCurrentPage,
    }),
    [jumpToTab, setIndex, getCurrentIndex, getFocusedTab, syncCurrentPage],
  );
  const pageIdentity = JSON.stringify(tabs.map((tab) => tab.id));

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
      topScrollEdgeEffect={topOverlay ? ScrollEdgeEffect.Hard : undefined}
      topOverlayColorScheme={topOverlay ? themeName : undefined}
      topOverlay={topOverlay}
      onScrollEdgeCapability={(event) => {
        const session = capabilitySessionRef.current;
        if (!session.active && session.mounted) return;
        session.lastAvailable = event.nativeEvent.available;
        if (session.active) {
          capabilityCallbackRef.current?.(event.nativeEvent.available);
        }
      }}
      headerHeight={headerLayout.height}
      stickyHeaderHeight={stickyHeight}
      // Spot remains the owner of shared asset loading even while offscreen.
      pageRetentionDistance={tabs.length}
      offscreenPageLimit={Math.max(1, tabs.length - 1)}
      header={
        <View
          onLayout={(event) => {
            const height = Math.ceil(event.nativeEvent.layout.height);
            setHeaderLayout((current) =>
              current.generation === headerLayout.generation
                ? { ...current, height }
                : current,
            );
          }}
        >
          <SpotlightScrollStateContext.Provider
            value={
              spotlightScrollState?.pageIdentity === pageIdentity &&
              spotlightScrollState.pageKey ===
                mountedPageKeysRef.current?.keys[selectedIndex]
                ? spotlightScrollState
                : null
            }
          >
            {renderHeader()}
          </SpotlightScrollStateContext.Provider>
        </View>
      }
      stickyHeader={
        <View
          style={{
            backgroundColor: topEdgeActive ? 'transparent' : theme.bgApp.val,
          }}
          onLayout={(event) =>
            setStickyHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          {renderTabBar({ ...tabBarProps, topEdgeActive })}
        </View>
      }
      onMountedPagesChanged={({ pageKeys }) => {
        const previous = mountedPageKeysRef.current;
        if (
          previous?.pageIdentity !== pageIdentity ||
          previous.keys.length !== pageKeys.length ||
          previous.keys.some((key, index) => key !== pageKeys[index])
        ) {
          setSpotlightScrollState(null);
        }
        mountedPageKeysRef.current = { pageIdentity, keys: pageKeys };
      }}
      onCollapsibleStateChanged={({ nativeEvent }) => {
        const mounted = mountedPageKeysRef.current;
        if (
          mounted?.pageIdentity !== pageIdentity ||
          nativeEvent.position !== selectedIndexRef.current ||
          mounted.keys[nativeEvent.position] !== nativeEvent.pageKey
        )
          return;
        const settled = nativeEvent.headerSettledAtTop;
        setSpotlightScrollState((previous) =>
          previous?.pageIdentity === pageIdentity &&
          previous.pageKey === nativeEvent.pageKey &&
          previous.headerSettledAtTop === settled
            ? previous
            : {
                pageIdentity,
                pageKey: nativeEvent.pageKey,
                headerSettledAtTop: settled,
              },
        );
      }}
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
        if (nativeEvent.pageScrollState !== 'idle')
          setSpotlightScrollState(null);
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
        setSpotlightScrollState(null);
        controller.selectIndex(nativeEvent.position);
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
