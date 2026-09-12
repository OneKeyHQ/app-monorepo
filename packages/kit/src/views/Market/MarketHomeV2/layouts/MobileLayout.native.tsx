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

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import {
  IconButton,
  Tabs,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
  useTheme,
} from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import {
  MarketBannerList,
  useMarketBannerState,
} from '../components/MarketBanner/MarketBannerList';
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
import {
  type IMarketWatchlistDataCache,
  useIsWatchlistTokenCacheReady,
} from '../components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { MarketStockCategorySelector } from '../components/MarketTokenList/MarketStockCategorySelector';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';
import {
  isMarketStockCategoryById,
  shouldShowSpotNetworkSelector,
} from '../utils';

import { useMarketTabsLogic } from './hooks';
import { getDefaultMarketStockCategoryId } from './marketStockCategoryUtils';
import { shouldHandleMarketPagerPageSelected } from './marketTabSelectionGuards';
import {
  MARKET_MOBILE_COLUMN_HEADER_HEIGHT,
  getMarketMobileBannerHeaderHeight,
  getMarketMobileSecondaryHeaderHeight,
  resolveMarketBannerHeaderDecision,
} from './mobileLayoutUtils';

import type { IMarketPerpsDataCache } from '../components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import type {
  ILiquidityFilter,
  IMarketCategoryItem,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type {
  CollapsiblePagerNativeSubHeaderConfig,
  CollapsiblePagerNativeTabBarConfig,
  CollapsiblePagerViewOnNativeSubHeaderPressEvent,
  CollapsiblePagerViewOnNativeTabPressEvent,
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

const STYLES = StyleSheet.create({
  pager: { flex: 1 },
});

interface IMarketHomeTabBarProps {
  watchlistTabName: string;
  perpsTabName: string;
  tabNames: string[];
  focusedTab: SharedValue<string>;
  onTabPress: (name: string) => void;
  useNativeTabBar: boolean;
  useNativeStockSubHeader: boolean;
}

function MarketHomeTabBar({
  watchlistTabName,
  perpsTabName,
  tabNames,
  focusedTab,
  onTabPress,
  useNativeTabBar,
  useNativeStockSubHeader,
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
  const showSpotNetworkSelector = shouldShowSpotNetworkSelector(
    currentSpotCategoryId,
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
            showNetworkSelector={showSpotNetworkSelector}
            onNetworkIdChange={ctx.filterBarProps.onNetworkIdChange}
            onTimeRangeChange={ctx.filterBarProps.onTimeRangeChange}
          />
        ) : null}
        {showStockCategorySelector && !useNativeStockSubHeader ? (
          <MarketStockCategorySelector
            categories={ctx.stockCategories}
            selectedCategoryId={ctx.selectedStockCategoryId}
            onSelectCategory={ctx.onSelectStockCategory}
            containerStyle={{ px: '$5', pt: '$3', pb: '$1' }}
          />
        ) : null}
        {useNativeStockSubHeader && showStockCategorySelector ? null : (
          <MarketListColumnHeader />
        )}
      </>
    ),
    [
      ctx.filterBarProps,
      ctx.onSelectStockCategory,
      ctx.selectedStockCategoryId,
      ctx.stockCategories,
      showSpotFilterBar,
      showSpotNetworkSelector,
      showStockCategorySelector,
      useNativeStockSubHeader,
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
        {useNativeTabBar ? null : (
          <Tabs.TabBar
            focusedTab={focusedTab}
            tabNames={tabNames}
            onTabPress={onTabPress}
            scrollable
            keepFocusedTabVisible
            directTabPressAnimation
            directTabPressAnimationMode="instant"
          />
        )}
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
  nestedPager = false,
}: IMobileLayoutProps) {
  const intl = useIntl();
  const openMarketWatchlistEditDialog = useOpenMarketWatchlistEditDialog();
  const isTokenCacheReady = useIsWatchlistTokenCacheReady();
  const {
    watchlistTabName,
    showWatchlistTab,
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
      ...(showWatchlistTab ? [watchlistTabName] : []),
      ...spotTabItems.map((item) => item.tabName),
      ...(showPerpsTab ? [perpsTabName] : []),
    ],
    [
      perpsTabName,
      showPerpsTab,
      showWatchlistTab,
      spotTabItems,
      watchlistTabName,
    ],
  );
  const initialIndex = useRef(
    Math.max(0, tabNames.indexOf(selectedTabName)),
  ).current;
  const pagerRef = useRef<CollapsiblePagerView>(null);
  // Keep successful data when the pager unmounts a distant page.
  const watchlistDataCacheRef = useRef<IMarketWatchlistDataCache | undefined>(
    undefined,
  );
  const topCoinsDataCacheRef = useRef<IMarketAssetListItem[] | undefined>(
    undefined,
  );
  const perpsDataCacheRef = useRef<IMarketPerpsDataCache | undefined>(
    undefined,
  );
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const activeIndexRef = useRef(initialIndex);
  const activeTabNameRef = useRef(
    tabNames[initialIndex] ?? selectedTabName ?? tabNames[0] ?? '',
  );
  const selectedTabNameRef = useRef(selectedTabName);
  selectedTabNameRef.current = selectedTabName;
  const [activeTabName, setActiveTabName] = useState(activeTabNameRef.current);
  const focusedTab = useSharedValue(activeTabNameRef.current);
  const theme = useTheme();
  const nativeTabBar = useMemo<CollapsiblePagerNativeTabBarConfig | undefined>(
    () =>
      platformEnv.isNative
        ? {
            items: tabNames.map((name, index) => ({
              key: name,
              title: name,
              accessibilityLabel: name,
              testID: `market-native-tab-${index}`,
            })),
            style: {
              height: MARKET_TAB_BAR_HEIGHT,
              contentPaddingHorizontal: 20,
              itemSpacing: 8,
              fontSize: 16,
              fontFamily: 'Roobert-Medium',
              backgroundColor: theme.bgApp.val,
              activeTextColor: theme.text.val,
              inactiveTextColor: theme.textSubdued.val,
              indicatorColor: theme.text.val,
              indicatorHeight: 2,
              indicatorBottom: 0,
            },
          }
        : undefined,
    [tabNames, theme.bgApp.val, theme.text.val, theme.textSubdued.val],
  );
  const {
    bannerList,
    isFetched: isBannerFetched,
    scope: bannerScope,
  } = useMarketBannerState();
  const bannerDecisionRef = useRef({
    scope: bannerScope,
    isDecided: false,
    hasBanners: false,
  });
  const bannerHeaderHeightRef = useRef({
    scope: bannerScope,
    height: getMarketMobileBannerHeaderHeight(bannerList),
  });
  if (bannerHeaderHeightRef.current.scope !== bannerScope) {
    bannerHeaderHeightRef.current = {
      scope: bannerScope,
      height: getMarketMobileBannerHeaderHeight([]),
    };
  }
  if (
    isBannerFetched &&
    bannerList.length > 0 &&
    (bannerDecisionRef.current.scope !== bannerScope ||
      !bannerDecisionRef.current.isDecided)
  ) {
    bannerHeaderHeightRef.current.height =
      getMarketMobileBannerHeaderHeight(bannerList);
  }
  bannerDecisionRef.current = resolveMarketBannerHeaderDecision({
    current: bannerDecisionRef.current,
    scope: bannerScope,
    isFetched: isBannerFetched,
    bannerCount: bannerList.length,
  });
  const headerHeight = bannerDecisionRef.current.hasBanners
    ? bannerHeaderHeightRef.current.height
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
  const activeSpotCategoryId = getSpotCategoryIdByTabName(activeTabName);
  const nativeSubHeader = useMemo<
    CollapsiblePagerNativeSubHeaderConfig | undefined
  >(
    () =>
      platformEnv.isNative &&
      isMarketStockCategoryById(
        filterBarProps.categories,
        activeSpotCategoryId,
      ) &&
      stockCategories.length > 0
        ? {
            items: stockCategories.map((category, index) => ({
              key: category.id,
              title: category.name,
              accessibilityLabel: category.name,
              testID: `market-native-stock-category-${index}`,
            })),
            selectedKey: selectedStockCategoryId,
            columns: {
              leading: `${intl.formatMessage({
                id: ETranslations.global_name,
              })} / ${intl.formatMessage({
                id: ETranslations.dexmarket_turnover,
              })}`,
              middle: intl.formatMessage({
                id: ETranslations.global_price,
              }),
              trailing: intl.formatMessage({
                id: ETranslations.dexmarket_token_change,
              }),
            },
            style: {
              height: getMarketMobileSecondaryHeaderHeight(),
              tabsHeight: 42,
              contentPaddingHorizontal: 20,
              itemSpacing: 8,
              fontSize: 14,
              columnFontSize: 12,
              trailingColumnWidth: 80,
              columnGap: 8,
              selectedBackgroundColor: theme.bgActive.val,
            },
          }
        : undefined,
    [
      activeSpotCategoryId,
      filterBarProps.categories,
      intl,
      selectedStockCategoryId,
      stockCategories,
      theme.bgActive.val,
    ],
  );

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
        const selectedIndex = tabNames.indexOf(selectedTabNameRef.current);
        const targetIndex =
          !isTabSelectionInFlight() && selectedIndex >= 0
            ? selectedIndex
            : activeIndexRef.current;
        updateActivePage(targetIndex);
        pagerRef.current?.setPageWithoutAnimation(targetIndex);
      },
    }),
    [isTabSelectionInFlight, setPagerIndex, tabNames, updateActivePage],
  );

  useEffect(() => {
    if (!isFocused || isTabSelectionInFlight()) return;
    const targetIndex = tabNames.indexOf(selectedTabName);
    if (targetIndex < 0) return;
    if (targetIndex !== activeIndexRef.current) {
      setPagerIndex(targetIndex, false);
    } else if (activeTabNameRef.current !== selectedTabName) {
      updateActivePage(targetIndex);
    }
  }, [
    isFocused,
    isTabSelectionInFlight,
    selectedTabName,
    setPagerIndex,
    tabNames,
    updateActivePage,
  ]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const index = tabNames.indexOf(tabName);
      if (index >= 0 && index !== activeIndexRef.current) {
        handleTabChange(tabName);
        setPagerIndex(index, true);
      }
    },
    [handleTabChange, setPagerIndex, tabNames],
  );

  const handleNativeTabPress = useCallback(
    (event: CollapsiblePagerViewOnNativeTabPressEvent) => {
      const { key } = event.nativeEvent;
      if (tabNames.includes(key)) handleTabPress(key);
    },
    [handleTabPress, tabNames],
  );

  const handleNativeSubHeaderPress = useCallback(
    (event: CollapsiblePagerViewOnNativeSubHeaderPressEvent) => {
      const { key, position } = event.nativeEvent;
      const category = stockCategories[position];
      if (category && category.id === key) {
        setSelectedStockCategoryId(category.id);
      }
    },
    [stockCategories],
  );

  const handlePageSelected = useCallback(
    (event: CollapsiblePagerViewOnPageSelectedEvent) => {
      if (
        !shouldHandleMarketPagerPageSelected(isPagerUserDraggingRef.current)
      ) {
        return;
      }
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

  const [pagerHeight, setPagerHeight] = useState(0);
  const scrollContentTabBarOffset = useScrollContentTabBarOffset();
  const contentPaddingBottom = platformEnv.isNativeIOS
    ? (scrollContentTabBarOffset ?? 0)
    : tabBarHeight + 40;

  const listContainerProps = useMemo(
    () => ({
      emptyContentPaddingTop:
        16 +
        (platformEnv.isNativeAndroid ? headerHeight + stickyHeaderHeight : 0),
      paddingBottom: contentPaddingBottom,
      emptyContentHeight: Math.max(
        0,
        pagerHeight - stickyHeaderHeight - contentPaddingBottom,
      ),
    }),
    [contentPaddingBottom, headerHeight, pagerHeight, stickyHeaderHeight],
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
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) setPagerHeight(height);
        }}
        initialPage={initialIndex}
        headerHeight={headerHeight}
        stickyHeaderHeight={stickyHeaderHeight}
        pageRetentionDistance={1}
        offscreenPageLimit={1}
        scrollEnabled
        nestedScrollEnabled={nestedPager}
        nativeSmoothHeaderScrollEnabled={platformEnv.isNative}
        testID="market-native-collapsible-pager"
        nativeTabBar={nativeTabBar}
        nativeSubHeader={nativeSubHeader}
        onNativeTabPress={handleNativeTabPress}
        onNativeSubHeaderPress={handleNativeSubHeaderPress}
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
              useNativeTabBar={Boolean(nativeTabBar)}
              useNativeStockSubHeader={Boolean(nativeSubHeader)}
            />
          </YStack>
        }
      >
        {showWatchlistTab ? (
          <YStack key={watchlistTabName} flex={1} bg="$bgApp">
            <MobileMarketNativeWatchlist
              dataCacheRef={watchlistDataCacheRef}
              selectedFilter={watchlistFilter}
              listContainerProps={listContainerProps}
              shouldSuppressItemPress={shouldSuppressItemPress}
            />
          </YStack>
        ) : null}
        {spotTabItems.map((item) => {
          const isStockCategory = isMarketStockCategoryById(
            filterBarProps.categories,
            item.categoryId,
          );
          let content;
          if (item.categoryId === MARKET_TOP_COINS_CATEGORY_ID) {
            content = (
              <MobileMarketNativeTopCoinsList
                dataCacheRef={topCoinsDataCacheRef}
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
              dataCacheRef={perpsDataCacheRef}
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
