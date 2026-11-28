import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FlatList, RefreshControl, View } from 'react-native';
import {
  CollapsiblePagerView,
  NativeScroller,
  ScrollEdgeEffect,
} from 'react-native-pager-view';
import Animated, { useEvent } from 'react-native-reanimated';

import { YStack, useScrollContentTabBarOffset } from '@onekeyhq/components';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import type { ScrollViewProps } from 'react-native';
import type { CollapsiblePagerViewOnPageScrollEvent } from 'react-native-pager-view';
import type { SharedValue } from 'react-native-reanimated';

const LIST_STYLE = { flex: 1 };
const MEASURING_PAGER_STYLE = { flex: 1, opacity: 0 };
const AnimatedMarketPager =
  Animated.createAnimatedComponent(CollapsiblePagerView);

type IMarketCategory = { id: string; markets: IPerpsUniverse[] };
type IMarketPageProps = {
  category: IMarketCategory;
  stickyHeaderHeight: number;
  renderMarket: (market: IPerpsUniverse) => ReactElement;
  emptyState: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
};

const SimpleMarketPage = memo(function SimpleMarketPage({
  category,
  stickyHeaderHeight,
  renderMarket,
  emptyState,
  refreshing,
  onRefresh,
}: IMarketPageProps) {
  const tabOffset = useScrollContentTabBarOffset();
  const [viewportHeight, setViewportHeight] = useState(0);
  const renderItem = useCallback(
    ({ item }: { item: IPerpsUniverse }) => (
      <YStack mx="$5">{renderMarket(item)}</YStack>
    ),
    [renderMarket],
  );
  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => (
      <NativeScroller
        {...props}
        pagerScrollKey={`perps-simple-${category.id}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    ),
    [category.id, onRefresh, refreshing],
  );

  return (
    <FlatList
      testID={`perps-simple-market-list-${category.id}`}
      style={LIST_STYLE}
      data={category.markets}
      keyExtractor={(market) => market.name}
      renderItem={renderItem}
      renderScrollComponent={renderScrollComponent}
      ListEmptyComponent={
        <YStack mx="$5" py="$2">
          {emptyState}
        </YStack>
      }
      contentContainerStyle={{
        // Native pagers add the sticky bar as an inset. Including it here too
        // lets short pages scroll their first row underneath the pinned bar.
        minHeight: platformEnv.isNative
          ? Math.max(0, viewportHeight - stickyHeaderHeight)
          : viewportHeight,
        paddingTop: 8,
        paddingBottom: (tabOffset ?? 0) + 16,
      }}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
});

export function SimpleMarketList({
  overview,
  categories,
  selectedCategoryId,
  renderMarket,
  renderCategories,
  emptyState,
  onCategoryChange,
  refreshing,
  onRefresh,
}: {
  overview: ReactElement;
  categories: IMarketCategory[];
  selectedCategoryId: string;
  renderMarket: IMarketPageProps['renderMarket'];
  renderCategories: (
    onSelect: (tabId: string) => void,
    indexDecimal: SharedValue<number>,
  ) => ReactElement;
  emptyState: ReactElement;
  onCategoryChange: (tabId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [overviewHeight, setOverviewHeight] = useState<number | null>(null);
  const [categoriesHeight, setCategoriesHeight] = useState<number | null>(null);
  const [hasViewport, setHasViewport] = useState(false);
  const isLayoutReady =
    hasViewport && overviewHeight !== null && categoriesHeight !== null;
  const isPagerVisible = !platformEnv.isNative || isLayoutReady;
  const themeVariant = useThemeVariant();
  const pages = useMemo(
    () => categories.map(({ id }) => ({ key: id, name: id })),
    [categories],
  );
  // Tap commands switch immediately; swipe progress still follows the native
  // pager. The controller preserves identity when server categories change.
  const controller = useAppPagerController({
    pages,
    initialTabName: selectedCategoryId,
    pagerRef,
    animationEnabled: false,
    removedPageFallback: { tabName: 'perps' },
    onSelectionChange: ({ tabName }) => onCategoryChange(tabName),
  });
  const { jumpToTab, indexDecimal } = controller;
  // Native colors track the gesture on the UI thread, even while market data
  // is updating on the JS thread. Web supplies progress from its DOM pager.
  const nativePageScroll = useEvent<
    CollapsiblePagerViewOnPageScrollEvent['nativeEvent']
  >(
    (event) => {
      'worklet';
      indexDecimal.value = event.position + event.offset;
    },
    ['onPageScroll'],
  );
  const handlePageScroll = useCallback(
    ({ nativeEvent }: CollapsiblePagerViewOnPageScrollEvent) => {
      indexDecimal.value = nativeEvent.position + nativeEvent.offset;
    },
    [indexDecimal],
  );

  return (
    <AnimatedMarketPager
      ref={pagerRef}
      testID="perps-simple-market-pager"
      // Keep measuring the native slots without exposing placeholder insets.
      style={isPagerVisible ? LIST_STYLE : MEASURING_PAGER_STYLE}
      pointerEvents={isPagerVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!isPagerVisible}
      importantForAccessibility={
        isPagerVisible ? 'auto' : 'no-hide-descendants'
      }
      initialPage={controller.initialIndex}
      scrollEnabled={!platformEnv.isNative || isLayoutReady}
      onLayout={({ nativeEvent }) => {
        if (nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0) {
          setHasViewport(true);
        }
      }}
      // Keep scroller ownership stable while switching categories, as the Home
      // pager does. Recreating a page also reattaches the shared native header.
      pageRetentionDistance={categories.length}
      {...(platformEnv.isNative
        ? {
            nestedScrollEnabled: true,
            nativeSmoothHeaderScrollEnabled: isLayoutReady,
          }
        : {})}
      // iOS also uses this edge boundary to clip both pages below the sticky
      // bar while their lists retain different vertical scroll positions.
      {...(platformEnv.isNativeIOS
        ? {
            topScrollEdgeEffect: ScrollEdgeEffect.Hard,
            topOverlayColorScheme: themeVariant,
          }
        : {})}
      headerHeight={overviewHeight ?? 1}
      stickyHeaderHeight={categoriesHeight ?? 48}
      header={
        <YStack
          testID="perps-simple-overview"
          collapsable={false}
          flexShrink={0}
          bg={themeVariant === 'light' ? '$bgSubdued' : '$bgApp'}
          // Measure independently of the pager slot's previous height.
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          onLayout={({ nativeEvent }) => {
            // Moving the native header must not replace the last measured content
            // height with an empty layout and reset the shared header offset.
            const height = Math.ceil(nativeEvent.layout.height);
            if (Number.isFinite(height) && height > 0) {
              setOverviewHeight(height);
            }
          }}
        >
          {overview}
        </YStack>
      }
      stickyHeader={
        <YStack
          testID="perps-simple-sticky-categories"
          collapsable={false}
          flexShrink={0}
          position="absolute"
          top={0}
          left={0}
          right={0}
          bg={themeVariant === 'light' ? '$bgSubdued' : '$bgApp'}
          py="$2"
          onLayout={({ nativeEvent }) => {
            const height = Math.ceil(nativeEvent.layout.height);
            if (Number.isFinite(height) && height > 0) {
              setCategoriesHeight(height);
            }
          }}
        >
          {renderCategories(jumpToTab, indexDecimal)}
        </YStack>
      }
      onPageScroll={
        platformEnv.isNative
          ? // Reanimated intercepts this processed handler on the native host.
            (nativePageScroll as unknown as typeof handlePageScroll)
          : handlePageScroll
      }
      onPageSelected={({ nativeEvent }) => {
        if (categories[nativeEvent.position]) {
          controller.selectIndex(nativeEvent.position);
        }
      }}
    >
      {categories.map((category) => (
        <View key={category.id} collapsable={false} style={LIST_STYLE}>
          <SimpleMarketPage
            category={category}
            stickyHeaderHeight={categoriesHeight ?? 48}
            renderMarket={renderMarket}
            emptyState={emptyState}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </View>
      ))}
    </AnimatedMarketPager>
  );
}
