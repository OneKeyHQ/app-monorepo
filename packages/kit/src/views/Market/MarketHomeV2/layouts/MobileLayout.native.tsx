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
import { ChartPrewarm } from '@onekeyhq/kit/src/components/TradingView/ChartWebView/ChartPrewarm';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useChartPredictedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketBasicConfig } from '../../hooks/useMarketBasicConfig';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import { MobileMarketPerpsFlatList } from '../components/MarketPerpsList';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import { useIsWatchlistTokenCacheReady } from '../components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MobileMarketWatchlistFlatList } from '../components/MarketTokenList/MobileMarketWatchlistFlatList';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';

import { useMarketTabsLogic, useSyncedMarketTab } from './hooks';

import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewProps,
} from 'react-native-pager-view';

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
  isSpotTabName: (tabName: string) => boolean;
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

const MARKET_ANDROID_SECONDARY_HEADER_HEIGHT = 85;
const MARKET_TAB_CHANGE_TARGET_GUARD_MS = platformEnv.isNativeIOS ? 1000 : 350;
const MARKET_TAB_SYNC_JUMP_DEFER_MS = platformEnv.isNativeIOS ? 180 : 0;
const MARKET_TAB_USER_DRAG_ACCEPT_MS = platformEnv.isNativeIOS ? 700 : 350;
type IMarketPagerProps = Omit<PagerViewProps, 'onPageScroll' | 'initialPage'>;

function MarketHomeTabBar({
  watchlistTabName,
  perpsTabName,
  ...tabBarProps
}: IMarketHomeTabBarProps) {
  const ctx = useContext(TabBarDynamicContext)!;
  const { activeTabName } = ctx;
  const currentFocusedTabName = activeTabName || tabBarProps.tabNames[0] || '';
  const showWatchlistSubHeader = currentFocusedTabName === watchlistTabName;
  const showSpotSubHeader = ctx.isSpotTabName(currentFocusedTabName);
  const showPerpsSubHeader = currentFocusedTabName === perpsTabName;
  const fixedSecondaryHeaderHeight = useMemo(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }

    if (showWatchlistSubHeader && ctx.isWatchlistEmpty) {
      return 0;
    }

    return MARKET_ANDROID_SECONDARY_HEADER_HEIGHT;
  }, [ctx.isWatchlistEmpty, showWatchlistSubHeader]);

  const renderWatchlistSubHeaderContent = useCallback(
    () => (
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
        <MarketFilterBarSmall
          selectedNetworkId={ctx.filterBarProps.selectedNetworkId}
          timeRange={ctx.filterBarProps.timeRange}
          onNetworkIdChange={ctx.filterBarProps.onNetworkIdChange}
          onTimeRangeChange={ctx.filterBarProps.onTimeRangeChange}
        />
        <MarketListColumnHeader />
      </>
    ),
    [ctx.filterBarProps],
  );

  const renderPerpsSubHeaderContent = useCallback(
    () => (
      <>
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
      </>
    ),
    [ctx.onSelectCategory, ctx.perpsCategories, ctx.selectedCategoryId],
  );

  return (
    <YStack bg="$bgApp">
      <Tabs.TabBar
        {...tabBarProps}
        directTabPressAnimation={platformEnv.isNativeIOS}
      />
      <YStack
        height={fixedSecondaryHeaderHeight}
        overflow={platformEnv.isNativeAndroid ? 'hidden' : undefined}
        position="relative"
      >
        <YStack
          display={
            showWatchlistSubHeader && !ctx.isWatchlistEmpty ? 'flex' : 'none'
          }
          position={
            showWatchlistSubHeader && !ctx.isWatchlistEmpty
              ? 'relative'
              : 'absolute'
          }
          top={0}
          left={0}
          right={0}
          pointerEvents={showWatchlistSubHeader ? 'auto' : 'none'}
        >
          {renderWatchlistSubHeaderContent()}
        </YStack>
        <YStack
          display={showSpotSubHeader ? 'flex' : 'none'}
          position={showSpotSubHeader ? 'relative' : 'absolute'}
          top={0}
          left={0}
          right={0}
          opacity={showSpotSubHeader ? 1 : 0}
          pointerEvents={showSpotSubHeader ? 'auto' : 'none'}
        >
          {renderSpotSubHeaderContent()}
        </YStack>
        <YStack
          display={showPerpsSubHeader ? 'flex' : 'none'}
          position={showPerpsSubHeader ? 'relative' : 'absolute'}
          top={0}
          left={0}
          right={0}
          opacity={showPerpsSubHeader ? 1 : 0}
          pointerEvents={showPerpsSubHeader ? 'auto' : 'none'}
        >
          {renderPerpsSubHeaderContent()}
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
  // Drive the prewarm to the last-tapped market token (set on tap), so the shared
  // chart WebView is already on the right symbol (and its kline fetched) before
  // the detail page mounts. Falls back to the neutral reset when nothing tapped.
  const [chartPredicted] = useChartPredictedSymbolAtom();
  const {
    watchlistTabName,
    spotTabItems,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    isSpotTabName,
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
    () => perpsCategories[0]?.tabId ?? '',
    [perpsCategories],
  );
  const [selectedCategoryId, setSelectedCategoryId] =
    useState(initialCategoryId);

  useEffect(() => {
    if (!selectedCategoryId && initialCategoryId) {
      setSelectedCategoryId(initialCategoryId);
    }
  }, [initialCategoryId, selectedCategoryId]);

  const expectedTabChangeTargetRef = useRef<string | undefined>(undefined);
  const expectedTabChangeTargetStartedAtRef = useRef(0);
  const lastPagerDraggingAtRef = useRef(0);
  const lastAcceptedTabChangeNameRef = useRef<string | undefined>(undefined);
  const expectedTabChangeTargetTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const clearExpectedTabChangeTargetTimer = useCallback(() => {
    if (expectedTabChangeTargetTimerRef.current) {
      clearTimeout(expectedTabChangeTargetTimerRef.current);
      expectedTabChangeTargetTimerRef.current = undefined;
    }
  }, []);
  const clearExpectedTabChangeTarget = useCallback(() => {
    clearExpectedTabChangeTargetTimer();
    expectedTabChangeTargetRef.current = undefined;
    expectedTabChangeTargetStartedAtRef.current = 0;
  }, [clearExpectedTabChangeTargetTimer]);
  const scheduleExpectedTabChangeTargetClear = useCallback(
    (tabName: string, delayMs: number) => {
      clearExpectedTabChangeTargetTimer();
      expectedTabChangeTargetTimerRef.current = setTimeout(() => {
        if (expectedTabChangeTargetRef.current === tabName) {
          expectedTabChangeTargetRef.current = undefined;
          expectedTabChangeTargetStartedAtRef.current = 0;
        }
        expectedTabChangeTargetTimerRef.current = undefined;
      }, delayMs);
    },
    [clearExpectedTabChangeTargetTimer],
  );
  const markExpectedTabChangeTarget = useCallback(
    (tabName: string) => {
      clearExpectedTabChangeTarget();
      expectedTabChangeTargetRef.current = tabName;
      expectedTabChangeTargetStartedAtRef.current = Date.now();
      lastAcceptedTabChangeNameRef.current = undefined;
      scheduleExpectedTabChangeTargetClear(
        tabName,
        MARKET_TAB_CHANGE_TARGET_GUARD_MS,
      );
    },
    [clearExpectedTabChangeTarget, scheduleExpectedTabChangeTargetClear],
  );
  const shouldDeferJumpToTab = useCallback(
    ({ targetTabName }: { targetTabName: string; currentTabName: string }) => {
      if (expectedTabChangeTargetRef.current !== targetTabName) {
        return false;
      }

      const startedAt = expectedTabChangeTargetStartedAtRef.current;
      return (
        startedAt > 0 && Date.now() - startedAt < MARKET_TAB_SYNC_JUMP_DEFER_MS
      );
    },
    [],
  );

  useEffect(
    () => () => {
      clearExpectedTabChangeTarget();
    },
    [clearExpectedTabChangeTarget],
  );

  const {
    activeTabName,
    setActiveTabName,
    tabsRef: currentTabsRef,
  } = useSyncedMarketTab(selectedTabName, tabsRef, isFocused, {
    onBeforeJumpToTab: markExpectedTabChangeTarget,
    shouldDeferJumpToTab,
  });
  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;
  const handleTabChangeRef = useRef(handleTabChange);
  handleTabChangeRef.current = handleTabChange;
  const latestTabStateRef = useRef({
    activeTabName,
    selectedTabName,
  });
  latestTabStateRef.current = {
    activeTabName,
    selectedTabName,
  };
  const useNativeHeaderAnimation = platformEnv.isNativeAndroid
    ? !nestedPager
    : false;

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
        markExpectedTabChangeTarget(name);
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
    [markExpectedTabChangeTarget, perpsTabName, watchlistTabName],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      const latestTabState = latestTabStateRef.current;
      const focusedTab = currentTabsRef.current?.getFocusedTab();
      const expectedTabName = expectedTabChangeTargetRef.current;
      const lastPagerDraggingAt = lastPagerDraggingAtRef.current;
      const pagerDragElapsedMs =
        lastPagerDraggingAt > 0 ? Date.now() - lastPagerDraggingAt : undefined;
      const isRecentPagerDrag =
        pagerDragElapsedMs !== undefined &&
        pagerDragElapsedMs < MARKET_TAB_USER_DRAG_ACCEPT_MS;
      if (expectedTabName && tabName !== expectedTabName) {
        if (isRecentPagerDrag && focusedTab === tabName) {
          clearExpectedTabChangeTarget();
        } else {
          return;
        }
      }

      if (!expectedTabName && focusedTab && focusedTab !== tabName) {
        return;
      }

      if (
        tabName === lastAcceptedTabChangeNameRef.current &&
        latestTabState.activeTabName === tabName
      ) {
        return;
      }

      lastAcceptedTabChangeNameRef.current = tabName;
      setActiveTabNameRef.current(tabName);
      handleTabChangeRef.current(tabName);
    },
    [clearExpectedTabChangeTarget, currentTabsRef],
  );

  const handlePagerScrollStateChanged = useCallback(
    (event: PageScrollStateChangedNativeEvent) => {
      const { pageScrollState } = event.nativeEvent;
      if (pageScrollState !== 'dragging') {
        return;
      }

      lastPagerDraggingAtRef.current = Date.now();
    },
    [],
  );
  const pagerProps = useMemo<IMarketPagerProps>(
    () => ({
      ...(nestedPager ? { nestedScrollEnabled: true } : {}),
      onPageScrollStateChanged: handlePagerScrollStateChanged,
    }),
    [handlePagerScrollStateChanged, nestedPager],
  );
  const dynamicCtx = useMemo<ITabBarDynamicContext>(
    () => ({
      filterBarProps,
      watchlistFilter,
      onSelectWatchlistFilter: setWatchlistFilter,
      isWatchlistEmpty,
      isTokenCacheReady,
      onEditWatchlist: openMarketWatchlistEditDialog,
      isSpotTabName,
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
      isSpotTabName,
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
        useNativeHeaderAnimation={useNativeHeaderAnimation}
        pagerProps={pagerProps}
        {...containerProps}
      >
        {tabElements}
      </Tabs.Container>
      {/* Boot + pre-position the shared unified chart WebView while the user
          browses the list, so opening a token is instant. Hidden + offscreen. */}
      <ChartPrewarm
        symbol={chartPredicted?.symbol}
        source={chartPredicted?.source}
        networkId={chartPredicted?.networkId}
        address={chartPredicted?.address}
        decimal={chartPredicted?.decimal}
      />
    </TabBarDynamicContext.Provider>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
