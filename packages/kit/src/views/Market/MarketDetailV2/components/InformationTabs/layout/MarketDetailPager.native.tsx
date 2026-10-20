import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { View } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@onekeyhq/components';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';

import {
  MarketDetailNativeContext,
  MarketDetailNativePageContext,
} from './MarketDetailNativeContext';

import type { IMarketDetailPagerProps } from './MarketDetailPager';

function MarketDetailPage({
  pageKey,
  isFocused,
  children,
}: {
  pageKey: string;
  isFocused: boolean;
  children: ReactNode;
}) {
  const scrollY = useSharedValue(0);
  const value = useMemo(
    () => ({ key: pageKey, isFocused, scrollY }),
    [pageKey, isFocused, scrollY],
  );
  return (
    <MarketDetailNativePageContext.Provider value={value}>
      {children}
    </MarketDetailNativePageContext.Provider>
  );
}

export function MarketDetailPager({
  children,
  initialTabName,
  renderHeader,
  renderTabBar,
  onTabChange,
  scrollEnabled = true,
}: IMarketDetailPagerProps) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(44);
  const theme = useTheme();
  const pages = useMemo(
    () =>
      children.map((tab) => ({
        key: String(tab.key),
        name: tab.props.name,
      })),
    [children],
  );
  const followsPageScroll = useRef(true);
  const onBeforeCommand = useCallback((_index: number, animated: boolean) => {
    followsPageScroll.current = animated;
  }, []);
  const controller = useAppPagerController({
    pages,
    pagerRef,
    initialTabName,
    onSelectionChange: onTabChange,
    onBeforeCommand,
  });
  const context = useMemo(
    () => ({ focusedName: controller.focusedName }),
    [controller.focusedName],
  );

  return (
    <MarketDetailNativeContext.Provider value={context}>
      <CollapsiblePagerView
        ref={pagerRef}
        testID="market-detail-native-pager"
        style={{ flex: 1, backgroundColor: theme.bgApp.val }}
        initialPage={controller.initialIndex}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        nativeSmoothHeaderScrollEnabled
        headerHeight={headerHeight}
        stickyHeaderHeight={stickyHeaderHeight}
        pageRetentionDistance={children.length}
        offscreenPageLimit={Math.max(1, children.length - 1)}
        header={
          <View
            collapsable={false}
            onLayout={({ nativeEvent }) =>
              setHeaderHeight(Math.ceil(nativeEvent.layout.height))
            }
          >
            {renderHeader()}
          </View>
        }
        stickyHeader={
          <View
            collapsable={false}
            onLayout={({ nativeEvent }) =>
              setStickyHeaderHeight(Math.ceil(nativeEvent.layout.height))
            }
          >
            {renderTabBar({
              focusedTab: controller.focusedTab,
              indexDecimal: controller.indexDecimal,
              tabNames: pages.map((page) => page.name),
              onTabPress: controller.jumpToTab,
            })}
          </View>
        }
        onPageScroll={({ nativeEvent }) => {
          if (followsPageScroll.current) {
            controller.indexDecimal.value =
              nativeEvent.position + nativeEvent.offset;
          }
        }}
        onPageScrollStateChanged={({ nativeEvent }) => {
          if (nativeEvent.pageScrollState === 'dragging') {
            followsPageScroll.current = true;
          }
        }}
        onPageSelected={({ nativeEvent }) =>
          controller.selectIndex(nativeEvent.position)
        }
      >
        {children.map((tab, index) => (
          <View key={tab.key} collapsable={false} style={{ flex: 1 }}>
            <MarketDetailPage
              pageKey={String(tab.key)}
              isFocused={index === controller.selectedIndex}
            >
              {tab.props.children}
            </MarketDetailPage>
          </View>
        ))}
      </CollapsiblePagerView>
    </MarketDetailNativeContext.Provider>
  );
}
