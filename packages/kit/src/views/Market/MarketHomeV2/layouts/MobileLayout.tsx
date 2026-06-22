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

import { useMarketBasicConfig } from '../../hooks/useMarketBasicConfig';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import { MobileMarketPerpsFlatList } from '../components/MarketPerpsList';
import { MARKET_PERPS_DEFAULT_CATEGORY_ID } from '../components/MarketPerpsList/constants';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import { useIsWatchlistTokenCacheReady } from '../components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MobileMarketWatchlistFlatList } from '../components/MarketTokenList/MobileMarketWatchlistFlatList';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';
import { isMarketStockCategoryById } from '../utils';

import { useMarketTabsLogic, useSyncedMarketTab } from './hooks';

import type {
  ILiquidityFilter,
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
  perpsCategories: { tabId: string; name: string }[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  activeTabName: string;
}

const TabBarDynamicContext = createContext<ITabBarDynamicContext | null>(null);

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

  // Watchlist sub-header: conditional rendering (hidden when empty).
  // Spot & Perps sub-headers: display toggling keeps both mounted across
  // tab switches — avoids remount flicker and loading re-trigger for the
  // network selector and perps category selector.
  const isSpotOrPerps =
    showSpotSubHeader || currentFocusedTabName === perpsTabName;

  return (
    <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
      <Tabs.TabBar
        {...tabBarProps}
        containerStyle={{ position: 'relative' as any }}
      />
      {currentFocusedTabName === watchlistTabName && !ctx.isWatchlistEmpty ? (
        <>
          <XStack alignItems="center" pr="$3">
            <XStack flex={1}>
              <MarketWatchlistCategorySelector
                selectedFilter={ctx.watchlistFilter}
                onSelectFilter={ctx.onSelectWatchlistFilter}
                containerStyle={{
                  px: '$5',
                  pt: '$3',
                  pb: '$2',
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
        </>
      ) : null}
      <YStack display={isSpotOrPerps && showSpotSubHeader ? 'flex' : 'none'}>
        {showSpotFilterBar ? (
          <MarketFilterBarSmall
            selectedNetworkId={ctx.filterBarProps.selectedNetworkId}
            timeRange={ctx.filterBarProps.timeRange}
            onNetworkIdChange={ctx.filterBarProps.onNetworkIdChange}
            onTimeRangeChange={ctx.filterBarProps.onTimeRangeChange}
          />
        ) : null}
        <MarketListColumnHeader />
      </YStack>
      <YStack
        display={
          isSpotOrPerps && currentFocusedTabName === perpsTabName
            ? 'flex'
            : 'none'
        }
      >
        <MarketPerpsCategorySelector
          categories={ctx.perpsCategories}
          selectedCategoryId={ctx.selectedCategoryId}
          onSelectCategory={ctx.onSelectCategory}
          containerStyle={{
            px: '$5',
            pt: '$3',
            pb: '$2',
          }}
        />
        <MarketListColumnHeader />
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

  // Perps category state (lifted from MobileMarketPerpsFlatList)
  const { perpsCategories: rawPerpsCategories } = useMarketBasicConfig();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  const initialCategoryId = useMemo(
    () => perpsCategories[0]?.tabId ?? MARKET_PERPS_DEFAULT_CATEGORY_ID,
    [perpsCategories],
  );
  const [selectedCategoryId, setSelectedCategoryId] =
    useState(initialCategoryId);

  useEffect(() => {
    const shouldSyncSelectedCategory =
      !selectedCategoryId ||
      (perpsCategories.length > 0 &&
        !perpsCategories.some(
          (category) => category.tabId === selectedCategoryId,
        ));

    if (shouldSyncSelectedCategory && initialCategoryId) {
      setSelectedCategoryId(initialCategoryId);
    }
  }, [initialCategoryId, perpsCategories, selectedCategoryId]);

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
      perpsCategories,
      selectedCategoryId,
      onSelectCategory: setSelectedCategoryId,
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
      perpsCategories,
      selectedCategoryId,
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
