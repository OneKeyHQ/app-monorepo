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
  initialHeaderHeight,
  initialStickyHeaderHeight,
}: IMarketDetailPagerProps) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState<number | null>(
    null,
  );
  const [hasViewport, setHasViewport] = useState(false);
  const isLayoutReady =
    hasViewport && headerHeight !== null && stickyHeaderHeight !== null;
  const canShowInitialLayout =
    initialHeaderHeight !== undefined &&
    initialStickyHeaderHeight !== undefined;
  const isVisible = canShowInitialLayout || isLayoutReady;
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
      <View
        testID="market-detail-native-pager-container"
        style={{ flex: 1, backgroundColor: theme.bgApp.val }}
        onLayout={({ nativeEvent }) => {
          if (nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0)
            setHasViewport(true);
        }}
      >
        <CollapsiblePagerView
          ref={pagerRef}
          testID="market-detail-native-pager"
          style={{
            flex: 1,
            backgroundColor: theme.bgApp.val,
            opacity: isVisible ? 1 : 0,
          }}
          pointerEvents={isVisible ? 'auto' : 'none'}
          accessibilityElementsHidden={!isVisible}
          initialPage={controller.initialIndex}
          scrollEnabled={scrollEnabled}
          nestedScrollEnabled
          nativeSmoothHeaderScrollEnabled={isLayoutReady}
          headerHeight={headerHeight ?? initialHeaderHeight ?? 1}
          stickyHeaderHeight={
            stickyHeaderHeight ?? initialStickyHeaderHeight ?? 44
          }
          pageRetentionDistance={children.length}
          offscreenPageLimit={Math.max(1, children.length - 1)}
          header={
            <View
              testID="market-detail-native-header"
              collapsable={false}
              // Measure intrinsic content independently of the pager's reserved slot.
              style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
              onLayout={({ nativeEvent }) => {
                const height = Math.ceil(nativeEvent.layout.height);
                if (height > 0) setHeaderHeight(height);
              }}
            >
              {renderHeader()}
            </View>
          }
          stickyHeader={
            <View
              testID="market-detail-native-sticky-header"
              collapsable={false}
              onLayout={({ nativeEvent }) => {
                const height = Math.ceil(nativeEvent.layout.height);
                if (height > 0) setStickyHeaderHeight(height);
              }}
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
      </View>
    </MarketDetailNativeContext.Provider>
  );
}
