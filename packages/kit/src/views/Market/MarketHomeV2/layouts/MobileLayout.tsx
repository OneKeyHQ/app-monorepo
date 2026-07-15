import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import { IconButton, Tabs, XStack, YStack } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import { useSyncedMarketPerpsCategory } from '../components/MarketPerpsList/hooks/useSyncedMarketPerpsCategory';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import { MobileMarketPerpsFlatList } from '../components/MarketPerpsList/MobileMarketPerpsFlatList';
import { useIsWatchlistTokenCacheReady } from '../components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { MarketStockCategorySelector } from '../components/MarketTokenList/MarketStockCategorySelector';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MobileMarketWatchlistFlatList } from '../components/MarketTokenList/MobileMarketWatchlistFlatList';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';
import { isMarketStockCategoryById } from '../utils';

import { useMarketTabsLogic, useSyncedMarketTab } from './hooks';
import {
  getDefaultMarketStockCategoryId,
  getMarketStockCategoryRequestParam,
} from './marketStockCategoryUtils';
import { getMarketWebSecondaryHeaderHeight } from './mobileLayoutUtils';

import type {
  ILiquidityFilter,
  IMarketCategoryItem,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IMobileLayoutProps {
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
  tabsRef?: RefObject<ITabContainerRef | null>;
  isFocused?: boolean;
  nestedPager?: boolean;
}

// Context for dynamic tab bar values so renderTabBar stays stable.
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

interface IMarketHomeTabBarProps extends TabBarProps<string> {
  watchlistTabName: string;
  perpsTabName: string;
}

function MarketHomeTabBar({
  watchlistTabName,
  perpsTabName,
  ...tabBarProps
}: IMarketHomeTabBarProps) {
  const ctx = useContext(TabBarDynamicContext)!;
  const { activeTabName } = ctx;
  const currentFocusedTabName = activeTabName || tabBarProps.tabNames[0] || '';
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
    currentSpotCategoryId && !currentSpotCategoryHasStockData,
  );
  const showStockCategorySelector = Boolean(
    currentSpotCategoryId &&
    isMarketStockCategoryById(
      ctx.filterBarProps.categories,
      currentSpotCategoryId,
    ) &&
    ctx.stockCategories.length > 0,
  );
  const secondaryHeaderHeight = getMarketWebSecondaryHeaderHeight({
    isWatchlistEmpty: ctx.isWatchlistEmpty,
    showWatchlistSubHeader,
    showSpotSubHeader,
    hasSpotSecondaryControls: showSpotFilterBar || showStockCategorySelector,
  });

  // Watchlist sub-header: conditional rendering (hidden when empty).
  // Spot & Perps sub-headers: display toggling keeps both mounted across
  // tab switches — avoids remount flicker and loading re-trigger for the
  // network selector and perps category selector.

  return (
    <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
      <Tabs.TabBar
        {...tabBarProps}
        containerStyle={{ position: 'relative' as any }}
      />
      <YStack height={secondaryHeaderHeight} position="relative">
        <YStack
          display={
            currentFocusedTabName === watchlistTabName && !ctx.isWatchlistEmpty
              ? 'flex'
              : 'none'
          }
          position={
            currentFocusedTabName === watchlistTabName && !ctx.isWatchlistEmpty
              ? 'relative'
              : 'absolute'
          }
          height="100%"
          justifyContent="flex-end"
          top={0}
          left={0}
          right={0}
          pointerEvents={
            currentFocusedTabName === watchlistTabName ? 'auto' : 'none'
          }
        >
          <XStack alignItems="center" pr="$3">
            <XStack flex={1}>
              <MarketWatchlistCategorySelector
                selectedFilter={ctx.watchlistFilter}
                onSelectFilter={ctx.onSelectWatchlistFilter}
                containerStyle={{
                  px: '$5',
                  pt: '$3',
                  pb: '$1',
                }}
              />
            </XStack>
            {ctx.isTokenCacheReady ? (
              <IconButton
                testID="market-is-spot-or-perps-icon-btn"
                icon="PencilOutline"
                size="small"
                variant="tertiary"
                onPress={ctx.onEditWatchlist}
              />
            ) : null}
          </XStack>
          <MarketListColumnHeader />
        </YStack>
        <YStack
          display={showSpotSubHeader ? 'flex' : 'none'}
          position={showSpotSubHeader ? 'relative' : 'absolute'}
          height="100%"
          justifyContent="flex-end"
          top={0}
          left={0}
          right={0}
          opacity={showSpotSubHeader ? 1 : 0}
          pointerEvents={showSpotSubHeader ? 'auto' : 'none'}
        >
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
              containerStyle={{
                px: '$5',
                pt: '$3',
                pb: '$1',
              }}
            />
          ) : null}
          <MarketListColumnHeader />
        </YStack>
        <YStack
          display={currentFocusedTabName === perpsTabName ? 'flex' : 'none'}
          position={
            currentFocusedTabName === perpsTabName ? 'relative' : 'absolute'
          }
          height="100%"
          justifyContent="flex-end"
          top={0}
          left={0}
          right={0}
          opacity={currentFocusedTabName === perpsTabName ? 1 : 0}
          pointerEvents={
            currentFocusedTabName === perpsTabName ? 'auto' : 'none'
          }
        >
          <MarketPerpsCategorySelector
            categories={ctx.perpsCategories}
            selectedCategoryId={ctx.selectedCategoryId}
            onSelectCategory={ctx.onSelectCategory}
            containerStyle={{
              px: '$5',
              pt: '$3',
              pb: '$1',
            }}
          />
          <MarketListColumnHeader />
        </YStack>
      </YStack>
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
  } = useMarketTabsLogic(onTabChange, {
    spotCategories: filterBarProps.categories,
    selectedSpotCategory: filterBarProps.selectedCategory,
    onSpotCategoryChange: filterBarProps.onCategoryChange,
  });

  const tabBarHeight = useTabBarHeight();
  const tabContainerWidth = useTabContainerWidth() as number | undefined;

  // Watchlist state — used to hide category selector when empty
  const [watchlistState] = useMarketWatchListV2Atom();
  const isWatchlistEmpty =
    !watchlistState.data || watchlistState.data.length === 0;

  // Watchlist category filter state
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
      setStockDataCategoryMap((prev) => {
        if (prev[categoryId] === isStockData) {
          return prev;
        }
        return {
          ...prev,
          [categoryId]: isStockData,
        };
      });
    },
    [],
  );

  const { perpsCategories, selectedCategoryId, handleSelectCategory } =
    useSyncedMarketPerpsCategory();

  const {
    activeTabName,
    setActiveTabName,
    tabsRef: currentTabsRef,
  } = useSyncedMarketTab(selectedTabName, tabsRef, isFocused);

  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;

  const containerProps = useMemo(
    () => ({
      allowHeaderOverscroll: true,
      // NOTE: renderHeader must never return a 0-height tree after it had
      // a positive height, because react-native-collapsible-tab-view's
      // useLayoutHeight guard ignores 0-height re-layouts once a positive
      // height has been measured. Wrapping in a YStack with minHeight={1}
      // ensures the layout callback always fires with height >= 1 so the
      // library re-measures correctly when the banner disappears.
      renderHeader: () => (
        <YStack bg="$bgApp" pointerEvents="box-none" minHeight={1}>
          <MarketBannerList />
        </YStack>
      ),
    }),
    [],
  );

  const listContainerProps = useMemo(() => {
    const getPaddingBottom = () => {
      if (platformEnv.isNativeIOS) {
        return 125;
      }
      if (platformEnv.isNativeAndroid) {
        return tabBarHeight + 40;
      }
      return 0;
    };

    return {
      paddingBottom: getPaddingBottom(),
    };
  }, [tabBarHeight]);

  // Stable renderTabBar — reads dynamic values from context, not props.
  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        setActiveTabNameRef.current(name);
        tabBarProps.onTabPress?.(name);
      };

      return (
        <MarketHomeTabBar
          {...tabBarProps}
          onTabPress={handleTabPress}
          watchlistTabName={watchlistTabName}
          perpsTabName={perpsTabName}
        />
      );
    },
    [watchlistTabName, perpsTabName],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [handleTabChange, setActiveTabName],
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
      filterBarProps,
      watchlistFilter,
      isWatchlistEmpty,
      isTokenCacheReady,
      openMarketWatchlistEditDialog,
      getSpotCategoryIdByTabName,
      stockDataCategoryMap,
      stockCategories,
      selectedStockCategoryId,
      perpsCategories,
      selectedCategoryId,
      handleSelectCategory,
      activeTabName,
    ],
  );

  const tabElements = [
    <Tabs.Tab key={watchlistTabName} name={watchlistTabName}>
      <MobileMarketWatchlistFlatList
        selectedFilter={watchlistFilter}
        listContainerProps={listContainerProps}
      />
    </Tabs.Tab>,
    ...spotTabItems.map((item) => (
      <Tabs.Tab key={item.categoryId} name={item.tabName}>
        <MobileMarketTokenFlatList
          networkId={selectedNetworkId}
          selectedCategory={item.categoryId}
          stockCategory={
            isMarketStockCategoryById(
              filterBarProps.categories,
              item.categoryId,
            )
              ? getMarketStockCategoryRequestParam(selectedStockCategoryId)
              : undefined
          }
          timeRange={filterBarProps.timeRange}
          listContainerProps={listContainerProps}
          onStockDataChange={handleStockDataChange}
        />
      </Tabs.Tab>
    )),
    ...(showPerpsTab
      ? [
          <Tabs.Tab key={perpsTabName} name={perpsTabName}>
            <MobileMarketPerpsFlatList
              selectedCategoryId={selectedCategoryId}
              listContainerProps={listContainerProps}
            />
          </Tabs.Tab>,
        ]
      : []),
  ];

  return (
    <TabBarDynamicContext.Provider value={dynamicCtx}>
      <Tabs.Container
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={currentTabsRef as any}
        width={platformEnv.isNative ? tabContainerWidth : undefined}
        renderTabBar={renderTabBar}
        initialTabName={selectedTabName}
        onTabChange={onTabChangeHandler}
        useNativeHeaderAnimation={
          platformEnv.isNativeAndroid ? !nestedPager : false
        }
        pagerProps={
          nestedPager ? ({ nestedScrollEnabled: true } as any) : undefined
        }
        {...containerProps}
      >
        {tabElements}
      </Tabs.Container>
    </TabBarDynamicContext.Provider>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
