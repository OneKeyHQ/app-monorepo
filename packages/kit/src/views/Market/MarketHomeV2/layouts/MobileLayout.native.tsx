import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import { StyleSheet } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import { IconButton, Tabs, XStack, YStack } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MarketBannerList,
  useMarketBannerList,
} from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import {
  MobileMarketNativePerpsList,
  MobileMarketNativeStockList,
  MobileMarketNativeTokenList,
  MobileMarketNativeTopCoinsList,
  MobileMarketNativeWatchlist,
} from '../components/MarketNativeList/MobileMarketNativeLists';
import { useSyncedMarketPerpsCategory } from '../components/MarketPerpsList/hooks/useSyncedMarketPerpsCategory';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import { useIsWatchlistTokenCacheReady } from '../components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { MarketStockCategorySelector } from '../components/MarketTokenList/MarketStockCategorySelector';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';
import { isMarketStockCategoryById } from '../utils';

import { useMarketTabsLogic } from './hooks';
import { getDefaultMarketStockCategoryId } from './marketStockCategoryUtils';
import {
  MARKET_MOBILE_COLUMN_HEADER_HEIGHT,
  getMarketMobileSecondaryHeaderHeight,
} from './mobileLayoutUtils';

import type {
  ILiquidityFilter,
  IMarketCategoryItem,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type {
  CollapsiblePagerViewOnPageScrollStateChangedEvent,
  CollapsiblePagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import type { SharedValue } from 'react-native-reanimated';

interface IMobileLayoutProps {
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
  tabsRef?: RefObject<ITabContainerRef | null>;
  isFocused?: boolean;
  nestedPager?: boolean;
}

interface ITabBarDynamicContext {
  filterBarProps: IMobileLayoutProps['filterBarProps'];
  watchlistFilter: IWatchlistFilterType;
  onSelectWatchlistFilter: (filter: IWatchlistFilterType) => void;
  isWatchlistEmpty: boolean;
  isTokenCacheReady: boolean;
  onEditWatchlist: () => void;
  getSpotCategoryIdByTabName: (tabName: string) => string | undefined;
  stockDataCategoryMap: Record<string, boolean>;
  stockCategories: IMarketCategoryItem[];
  selectedStockCategoryId: string;
  onSelectStockCategory: (categoryId: string) => void;
  perpsCategories: { tabId: string; name: string }[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  activeTabName: string;
}

const TabBarDynamicContext = createContext<ITabBarDynamicContext | null>(null);
const EMPTY_MARKET_STOCK_CATEGORIES: IMarketCategoryItem[] = [];
const MARKET_TAB_ITEM_PRESS_DRAG_GUARD_MS = platformEnv.isNativeIOS ? 700 : 350;
const MARKET_TAB_ITEM_PRESS_IDLE_GUARD_MS = platformEnv.isNativeIOS ? 180 : 120;
const MARKET_TAB_BAR_HEIGHT = 44;
const MARKET_BANNER_HEADER_HEIGHT = 134;

const STYLES = StyleSheet.create({
  pager: { flex: 1 },
});

interface IMarketHomeTabBarProps {
  watchlistTabName: string;
  perpsTabName: string;
  tabNames: string[];
  focusedTab: SharedValue<string>;
  onTabPress: (name: string) => void;
}

function MarketHomeTabBar({
  watchlistTabName,
  perpsTabName,
  tabNames,
  focusedTab,
  onTabPress,
}: IMarketHomeTabBarProps) {
  const ctx = useContext(TabBarDynamicContext)!;
  const currentFocusedTabName = ctx.activeTabName || tabNames[0] || '';
  const showWatchlistSubHeader = currentFocusedTabName === watchlistTabName;
  const currentSpotCategoryId = ctx.getSpotCategoryIdByTabName(
    currentFocusedTabName,
  );
  const showSpotSubHeader = Boolean(currentSpotCategoryId);
  const currentSpotCategoryHasStockData = Boolean(
    currentSpotCategoryId &&
    (isMarketStockCategoryById(
      ctx.filterBarProps.categories,
      currentSpotCategoryId,
    ) ||
      ctx.stockDataCategoryMap[currentSpotCategoryId]),
  );
  const showSpotFilterBar = Boolean(
    currentSpotCategoryId &&
    currentSpotCategoryId !== MARKET_TOP_COINS_CATEGORY_ID &&
    !currentSpotCategoryHasStockData,
  );
  const showStockCategorySelector = Boolean(
    currentSpotCategoryId &&
    isMarketStockCategoryById(
      ctx.filterBarProps.categories,
      currentSpotCategoryId,
    ) &&
    ctx.stockCategories.length > 0,
  );
  const hasSpotSecondaryControls =
    showSpotFilterBar || showStockCategorySelector;
  const showCompactSpotSubHeader =
    showSpotSubHeader && !hasSpotSecondaryControls;
  const showPerpsSubHeader = currentFocusedTabName === perpsTabName;
  let secondaryHeaderHeight = getMarketMobileSecondaryHeaderHeight();
  if (showWatchlistSubHeader && ctx.isWatchlistEmpty) {
    secondaryHeaderHeight = 0;
  } else if (showCompactSpotSubHeader) {
    secondaryHeaderHeight = MARKET_MOBILE_COLUMN_HEADER_HEIGHT;
  }

  const renderWatchlistSubHeaderContent = useCallback(
    () => (
      <>
        <XStack alignItems="center" pr="$3">
          <XStack flex={1}>
            <MarketWatchlistCategorySelector
              selectedFilter={ctx.watchlistFilter}
              onSelectFilter={ctx.onSelectWatchlistFilter}
              containerStyle={{ px: '$5', pt: '$3', pb: '$1' }}
            />
          </XStack>
          {ctx.isTokenCacheReady ? (
            <IconButton
              testID="market-render-watchlist-sub-header-content-icon-btn"
              icon="PencilOutline"
              size="small"
              variant="tertiary"
              onPress={ctx.onEditWatchlist}
            />
          ) : null}
        </XStack>
        <MarketListColumnHeader />
      </>
    ),
    [
      ctx.isTokenCacheReady,
      ctx.onEditWatchlist,
      ctx.onSelectWatchlistFilter,
      ctx.watchlistFilter,
    ],
  );

  const renderSpotSubHeaderContent = useCallback(
    () => (
      <>
        {showSpotFilterBar ? (
          <MarketFilterBarSmall
            selectedNetworkId={ctx.filterBarProps.selectedNetworkId}
            timeRange={ctx.filterBarProps.timeRange}
            onNetworkIdChange={ctx.filterBarProps.onNetworkIdChange}
            onTimeRangeChange={ctx.filterBarProps.onTimeRangeChange}
          />
        ) : null}
        {showStockCategorySelector ? (
          <MarketStockCategorySelector
            categories={ctx.stockCategories}
            selectedCategoryId={ctx.selectedStockCategoryId}
            onSelectCategory={ctx.onSelectStockCategory}
            containerStyle={{ px: '$5', pt: '$3', pb: '$1' }}
          />
        ) : null}
        <MarketListColumnHeader />
      </>
    ),
    [
      ctx.filterBarProps,
      ctx.onSelectStockCategory,
      ctx.selectedStockCategoryId,
      ctx.stockCategories,
      showSpotFilterBar,
      showStockCategorySelector,
    ],
  );

  const renderPerpsSubHeaderContent = useCallback(
    () => (
      <>
        <MarketPerpsCategorySelector
          categories={ctx.perpsCategories}
          selectedCategoryId={ctx.selectedCategoryId}
          onSelectCategory={ctx.onSelectCategory}
          containerStyle={{ px: '$5', pt: '$3', pb: '$1' }}
        />
        <MarketListColumnHeader />
      </>
    ),
    [ctx.onSelectCategory, ctx.perpsCategories, ctx.selectedCategoryId],
  );

  return (
    <YStack pointerEvents="box-none" bg="$bgApp">
      <YStack bg="$bgApp" height={MARKET_TAB_BAR_HEIGHT}>
        <Tabs.TabBar
          focusedTab={focusedTab}
          tabNames={tabNames}
          onTabPress={onTabPress}
          scrollable
          keepFocusedTabVisible
          directTabPressAnimation
          directTabPressAnimationMode="instant"
        />
      </YStack>
      {secondaryHeaderHeight > 0 ? (
        <YStack
          height={secondaryHeaderHeight}
          overflow={platformEnv.isNativeAndroid ? 'hidden' : undefined}
          pointerEvents="box-none"
          position="relative"
        >
          {showWatchlistSubHeader ? (
            <YStack height="100%" bg="$bgApp" justifyContent="flex-end">
              {renderWatchlistSubHeaderContent()}
            </YStack>
          ) : null}
          {showSpotSubHeader ? (
            <YStack height="100%" bg="$bgApp" justifyContent="flex-end">
              {renderSpotSubHeaderContent()}
            </YStack>
          ) : null}
          {showPerpsSubHeader ? (
            <YStack height="100%" bg="$bgApp" justifyContent="flex-end">
              {renderPerpsSubHeaderContent()}
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

function MobileLayoutComponent({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
  tabsRef,
  isFocused = true,
}: IMobileLayoutProps) {
  const openMarketWatchlistEditDialog = useOpenMarketWatchlistEditDialog();
  const isTokenCacheReady = useIsWatchlistTokenCacheReady();
  const {
    watchlistTabName,
    spotTabItems,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    getSpotCategoryIdByTabName,
    selectedTabName,
    isTabSelectionInFlight,
  } = useMarketTabsLogic(onTabChange, {
    spotCategories: filterBarProps.categories,
    selectedSpotCategory: filterBarProps.selectedCategory,
    onSpotCategoryChange: filterBarProps.onCategoryChange,
  });
  const tabNames = useMemo(
    () => [
      watchlistTabName,
      ...spotTabItems.map((item) => item.tabName),
      ...(showPerpsTab ? [perpsTabName] : []),
    ],
    [perpsTabName, showPerpsTab, spotTabItems, watchlistTabName],
  );
  const initialIndex = Math.max(0, tabNames.indexOf(selectedTabName));
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const activeIndexRef = useRef(initialIndex);
  const activeTabNameRef = useRef(
    tabNames[initialIndex] ?? selectedTabName ?? tabNames[0] ?? '',
  );
  const [activeTabName, setActiveTabName] = useState(activeTabNameRef.current);
  const focusedTab = useSharedValue(activeTabNameRef.current);
  const {
    bannerList,
    isLoading: isBannerLoading,
    isFetched: isBannerFetched,
  } = useMarketBannerList();
  const headerHeight =
    (isBannerLoading && !isBannerFetched) || bannerList?.length
      ? MARKET_BANNER_HEADER_HEIGHT
      : 1;
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(
    MARKET_TAB_BAR_HEIGHT + getMarketMobileSecondaryHeaderHeight(),
  );

  const tabBarHeight = useTabBarHeight();
  const [watchlistState] = useMarketWatchListV2Atom();
  const isWatchlistEmpty =
    !watchlistState.data || watchlistState.data.length === 0;
  const [watchlistFilter, setWatchlistFilter] =
    useState<IWatchlistFilterType>('all');
  const stockCategories =
    filterBarProps.stockCategories ?? EMPTY_MARKET_STOCK_CATEGORIES;
  const [selectedStockCategoryId, setSelectedStockCategoryId] = useState(
    getDefaultMarketStockCategoryId(stockCategories),
  );
  useEffect(() => {
    if (stockCategories.length === 0) {
      if (selectedStockCategoryId !== 'all') {
        setSelectedStockCategoryId('all');
      }
      return;
    }
    if (
      !stockCategories.some(
        (category) => category.id === selectedStockCategoryId,
      )
    ) {
      setSelectedStockCategoryId(
        getDefaultMarketStockCategoryId(stockCategories),
      );
    }
  }, [selectedStockCategoryId, stockCategories]);

  const [stockDataCategoryMap, setStockDataCategoryMap] = useState<
    Record<string, boolean>
  >({});
  const handleStockDataChange = useCallback(
    (categoryId: string, isStockData: boolean) => {
      setStockDataCategoryMap((previous) => {
        if (previous[categoryId] === isStockData) return previous;
        return { ...previous, [categoryId]: isStockData };
      });
    },
    [],
  );
  const { perpsCategories, selectedCategoryId, handleSelectCategory } =
    useSyncedMarketPerpsCategory();

  const lastPagerDraggingAtRef = useRef(0);
  const lastPagerUserDragEndedAtRef = useRef(0);
  const isPagerUserDraggingRef = useRef(false);

  const updateActivePage = useCallback(
    (index: number) => {
      const tabName = tabNames[index];
      if (!tabName) return;
      activeIndexRef.current = index;
      activeTabNameRef.current = tabName;
      focusedTab.value = tabName;
      setActiveTabName(tabName);
    },
    [focusedTab, tabNames],
  );

  const setPagerIndex = useCallback(
    (index: number, animated: boolean) => {
      if (!tabNames[index]) return;
      updateActivePage(index);
      if (animated) {
        pagerRef.current?.setPage(index);
      } else {
        pagerRef.current?.setPageWithoutAnimation(index);
      }
    },
    [tabNames, updateActivePage],
  );

  useImperativeHandle(
    resolvedTabsRef,
    () => ({
      jumpToTab: (tabName: string) => {
        const index = tabNames.indexOf(tabName);
        if (index >= 0) setPagerIndex(index, true);
      },
      setIndex: (index: number) => setPagerIndex(index, true),
      getFocusedTab: () => activeTabNameRef.current,
      getCurrentIndex: () => activeIndexRef.current,
      syncCurrentPage: () => {
        pagerRef.current?.setPageWithoutAnimation(activeIndexRef.current);
      },
    }),
    [setPagerIndex, tabNames],
  );

  useEffect(() => {
    if (!isFocused || isTabSelectionInFlight()) return;
    const targetIndex = tabNames.indexOf(selectedTabName);
    if (targetIndex >= 0 && targetIndex !== activeIndexRef.current) {
      setPagerIndex(targetIndex, false);
    }
  }, [
    isFocused,
    isTabSelectionInFlight,
    selectedTabName,
    setPagerIndex,
    tabNames,
  ]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const index = tabNames.indexOf(tabName);
      if (index >= 0 && index !== activeIndexRef.current) {
        setPagerIndex(index, true);
      }
    },
    [setPagerIndex, tabNames],
  );

  const handlePageSelected = useCallback(
    (event: CollapsiblePagerViewOnPageSelectedEvent) => {
      const index = Math.max(0, Math.trunc(event.nativeEvent.position));
      const tabName = tabNames[index];
      if (!tabName) return;
      updateActivePage(index);
      handleTabChange(tabName);
    },
    [handleTabChange, tabNames, updateActivePage],
  );

  const handlePagerScrollStateChanged = useCallback(
    (event: CollapsiblePagerViewOnPageScrollStateChangedEvent) => {
      const { pageScrollState } = event.nativeEvent;
      if (pageScrollState === 'dragging') {
        isPagerUserDraggingRef.current = true;
        lastPagerDraggingAtRef.current = Date.now();
      } else if (pageScrollState === 'idle' && isPagerUserDraggingRef.current) {
        isPagerUserDraggingRef.current = false;
        lastPagerUserDragEndedAtRef.current = Date.now();
      }
    },
    [],
  );

  const shouldSuppressItemPress = useCallback(() => {
    const now = Date.now();
    const dragElapsed = now - lastPagerDraggingAtRef.current;
    const idleElapsed = now - lastPagerUserDragEndedAtRef.current;
    return (
      isPagerUserDraggingRef.current ||
      (lastPagerDraggingAtRef.current > 0 &&
        dragElapsed < MARKET_TAB_ITEM_PRESS_DRAG_GUARD_MS) ||
      (lastPagerUserDragEndedAtRef.current > 0 &&
        idleElapsed < MARKET_TAB_ITEM_PRESS_IDLE_GUARD_MS)
    );
  }, []);

  const listContainerProps = useMemo(
    () => ({
      paddingBottom: platformEnv.isNativeIOS ? 125 : tabBarHeight + 40,
    }),
    [tabBarHeight],
  );
  const dynamicCtx = useMemo<ITabBarDynamicContext>(
    () => ({
      filterBarProps,
      watchlistFilter,
      onSelectWatchlistFilter: setWatchlistFilter,
      isWatchlistEmpty,
      isTokenCacheReady,
      onEditWatchlist: openMarketWatchlistEditDialog,
      getSpotCategoryIdByTabName,
      stockDataCategoryMap,
      stockCategories,
      selectedStockCategoryId,
      onSelectStockCategory: setSelectedStockCategoryId,
      perpsCategories,
      selectedCategoryId,
      onSelectCategory: handleSelectCategory,
      activeTabName,
    }),
    [
      activeTabName,
      filterBarProps,
      getSpotCategoryIdByTabName,
      handleSelectCategory,
      isTokenCacheReady,
      isWatchlistEmpty,
      openMarketWatchlistEditDialog,
      perpsCategories,
      selectedCategoryId,
      selectedStockCategoryId,
      stockCategories,
      stockDataCategoryMap,
      watchlistFilter,
    ],
  );

  const handleStickyHeaderLayout = useCallback((height: number) => {
    setStickyHeaderHeight((previous) =>
      previous === height ? previous : height,
    );
  }, []);

  return (
    <TabBarDynamicContext.Provider value={dynamicCtx}>
      <CollapsiblePagerView
        ref={pagerRef}
        style={STYLES.pager}
        initialPage={initialIndex}
        headerHeight={headerHeight}
        stickyHeaderHeight={stickyHeaderHeight}
        pageRetentionDistance={1}
        offscreenPageLimit={1}
        scrollEnabled
        testID="market-native-collapsible-pager"
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePagerScrollStateChanged}
        header={
          <YStack bg="$bgApp" pointerEvents="box-none" minHeight={1}>
            <MarketBannerList />
          </YStack>
        }
        stickyHeader={
          <YStack
            bg="$bgApp"
            pointerEvents="box-none"
            onLayout={(event) =>
              handleStickyHeaderLayout(
                Math.round(event.nativeEvent.layout.height),
              )
            }
          >
            <MarketHomeTabBar
              watchlistTabName={watchlistTabName}
              perpsTabName={perpsTabName}
              tabNames={tabNames}
              focusedTab={focusedTab}
              onTabPress={handleTabPress}
            />
          </YStack>
        }
      >
        <YStack key={watchlistTabName} flex={1} bg="$bgApp">
          <MobileMarketNativeWatchlist
            selectedFilter={watchlistFilter}
            listContainerProps={listContainerProps}
            shouldSuppressItemPress={shouldSuppressItemPress}
          />
        </YStack>
        {spotTabItems.map((item) => {
          const isStockCategory = isMarketStockCategoryById(
            filterBarProps.categories,
            item.categoryId,
          );
          let content;
          if (item.categoryId === MARKET_TOP_COINS_CATEGORY_ID) {
            content = (
              <MobileMarketNativeTopCoinsList
                listContainerProps={listContainerProps}
                shouldSuppressItemPress={shouldSuppressItemPress}
              />
            );
          } else if (isStockCategory) {
            content = (
              <MobileMarketNativeStockList
                selectedCategoryId={selectedStockCategoryId}
                listContainerProps={listContainerProps}
                shouldSuppressItemPress={shouldSuppressItemPress}
              />
            );
          } else {
            content = (
              <MobileMarketNativeTokenList
                networkId={selectedNetworkId}
                selectedCategory={item.categoryId}
                timeRange={filterBarProps.timeRange}
                listContainerProps={listContainerProps}
                onStockDataChange={handleStockDataChange}
                shouldSuppressItemPress={shouldSuppressItemPress}
              />
            );
          }
          return (
            <YStack key={item.tabName} flex={1} bg="$bgApp">
              {content}
            </YStack>
          );
        })}
        {showPerpsTab ? (
          <YStack key={perpsTabName} flex={1} bg="$bgApp">
            <MobileMarketNativePerpsList
              selectedCategoryId={selectedCategoryId}
              listContainerProps={listContainerProps}
              shouldSuppressItemPress={shouldSuppressItemPress}
            />
          </YStack>
        ) : null}
      </CollapsiblePagerView>
    </TabBarDynamicContext.Provider>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
