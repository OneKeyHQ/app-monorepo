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
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewOnPageSelectedEvent,
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

const MARKET_ANDROID_SECONDARY_HEADER_HEIGHT = 85;
const MARKET_ANDROID_COLUMN_HEADER_HEIGHT = 36;
const MARKET_TAB_CHANGE_TARGET_GUARD_MS = platformEnv.isNativeIOS ? 1000 : 350;
const MARKET_TAB_SYNC_JUMP_DEFER_MS = platformEnv.isNativeIOS ? 180 : 0;
const MARKET_TAB_USER_DRAG_ACCEPT_MS = platformEnv.isNativeIOS ? 700 : 350;
const MARKET_TAB_SYNC_USER_DRAG_DEFER_MS = platformEnv.isNativeIOS ? 1200 : 500;
const MARKET_TAB_ITEM_PRESS_GUARD_MS = MARKET_TAB_USER_DRAG_ACCEPT_MS;
const MARKET_TAB_ITEM_PRESS_IDLE_GUARD_MS = platformEnv.isNativeIOS ? 180 : 120;
const MARKET_TAB_PROGRAMMATIC_SETTLE_GUARD_MS = platformEnv.isNativeAndroid
  ? 500
  : 0;
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
  const showPerpsSubHeader = currentFocusedTabName === perpsTabName;
  const fixedSecondaryHeaderHeight = useMemo(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }

    if (showWatchlistSubHeader && ctx.isWatchlistEmpty) {
      return 0;
    }

    if (showSpotSubHeader && !showSpotFilterBar) {
      return MARKET_ANDROID_COLUMN_HEADER_HEIGHT;
    }

    if (showPerpsSubHeader && ctx.perpsCategories.length === 0) {
      return MARKET_ANDROID_COLUMN_HEADER_HEIGHT;
    }

    return MARKET_ANDROID_SECONDARY_HEADER_HEIGHT;
  }, [
    ctx.perpsCategories.length,
    ctx.isWatchlistEmpty,
    showSpotFilterBar,
    showPerpsSubHeader,
    showSpotSubHeader,
    showWatchlistSubHeader,
  ]);

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
        {showSpotFilterBar ? (
          <MarketFilterBarSmall
            selectedNetworkId={ctx.filterBarProps.selectedNetworkId}
            timeRange={ctx.filterBarProps.timeRange}
            onNetworkIdChange={ctx.filterBarProps.onNetworkIdChange}
            onTimeRangeChange={ctx.filterBarProps.onTimeRangeChange}
          />
        ) : null}
        <MarketListColumnHeader />
      </>
    ),
    [ctx.filterBarProps, showSpotFilterBar],
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
      <YStack>
        <Tabs.TabBar
          {...tabBarProps}
          directTabPressAnimation
          directTabPressAnimationMode="instant"
        />
      </YStack>
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

  const expectedTabChangeTargetRef = useRef<string | undefined>(undefined);
  const expectedTabChangeTargetStartedAtRef = useRef(0);
  const lastPagerDraggingAtRef = useRef(0);
  const isPagerUserDraggingRef = useRef(false);
  const lastPagerUserDragEndedAtRef = useRef(0);
  const lastAcceptedTabChangeNameRef = useRef<string | undefined>(undefined);
  const lastProgrammaticAcceptedTabRef = useRef<
    | {
        tabName: string;
        acceptedAt: number;
      }
    | undefined
  >(undefined);
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
      lastProgrammaticAcceptedTabRef.current = undefined;
      scheduleExpectedTabChangeTargetClear(
        tabName,
        MARKET_TAB_CHANGE_TARGET_GUARD_MS,
      );
    },
    [clearExpectedTabChangeTarget, scheduleExpectedTabChangeTargetClear],
  );
  const shouldDeferJumpToTab = useCallback(
    ({ targetTabName }: { targetTabName: string; currentTabName: string }) => {
      const now = Date.now();
      const lastPagerDraggingAt = lastPagerDraggingAtRef.current;
      const pagerDragElapsedMs =
        lastPagerDraggingAt > 0 ? now - lastPagerDraggingAt : undefined;
      const isRecentPagerDrag =
        pagerDragElapsedMs !== undefined &&
        pagerDragElapsedMs < MARKET_TAB_SYNC_USER_DRAG_DEFER_MS;
      const shouldDeferForUserPager =
        isPagerUserDraggingRef.current || isRecentPagerDrag;

      if (shouldDeferForUserPager) {
        return true;
      }

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
  });
  latestTabStateRef.current = {
    activeTabName,
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
      const expectedTabNameStartedAt =
        expectedTabChangeTargetStartedAtRef.current;
      const lastPagerDraggingAt = lastPagerDraggingAtRef.current;
      const pagerDragElapsedMs =
        lastPagerDraggingAt > 0 ? Date.now() - lastPagerDraggingAt : undefined;
      const isRecentPagerDrag =
        pagerDragElapsedMs !== undefined &&
        pagerDragElapsedMs < MARKET_TAB_USER_DRAG_ACCEPT_MS;
      const wasDraggedAfterExpectedTab =
        expectedTabNameStartedAt > 0 &&
        lastPagerDraggingAt > expectedTabNameStartedAt;

      const lastProgrammaticAcceptedTab =
        lastProgrammaticAcceptedTabRef.current;
      const programmaticAcceptedElapsedMs = lastProgrammaticAcceptedTab
        ? Date.now() - lastProgrammaticAcceptedTab.acceptedAt
        : undefined;
      const shouldIgnoreProgrammaticSettlingTab = Boolean(
        !expectedTabName &&
        MARKET_TAB_PROGRAMMATIC_SETTLE_GUARD_MS > 0 &&
        lastProgrammaticAcceptedTab &&
        tabName !== lastProgrammaticAcceptedTab.tabName &&
        programmaticAcceptedElapsedMs !== undefined &&
        programmaticAcceptedElapsedMs <
          MARKET_TAB_PROGRAMMATIC_SETTLE_GUARD_MS &&
        !isRecentPagerDrag &&
        !wasDraggedAfterExpectedTab,
      );

      if (shouldIgnoreProgrammaticSettlingTab && lastProgrammaticAcceptedTab) {
        const acceptedTabName = lastProgrammaticAcceptedTab.tabName;
        if (focusedTab !== acceptedTabName) {
          markExpectedTabChangeTarget(acceptedTabName);
          currentTabsRef.current?.jumpToTab(acceptedTabName);
        }
        return;
      }

      if (expectedTabName && tabName !== expectedTabName) {
        if (
          focusedTab === tabName &&
          (isRecentPagerDrag || wasDraggedAfterExpectedTab)
        ) {
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
        if (expectedTabName && tabName === expectedTabName) {
          clearExpectedTabChangeTarget();
        }
        return;
      }

      if (expectedTabName && tabName === expectedTabName) {
        lastProgrammaticAcceptedTabRef.current = {
          tabName,
          acceptedAt: Date.now(),
        };
        clearExpectedTabChangeTarget();
      }
      lastAcceptedTabChangeNameRef.current = tabName;
      setActiveTabNameRef.current(tabName);
      handleTabChangeRef.current(tabName);
    },
    [clearExpectedTabChangeTarget, currentTabsRef, markExpectedTabChangeTarget],
  );

  const handlePagerScrollStateChanged = useCallback(
    (event: PageScrollStateChangedNativeEvent) => {
      const { pageScrollState } = event.nativeEvent;
      if (pageScrollState !== 'dragging') {
        if (pageScrollState === 'idle' && isPagerUserDraggingRef.current) {
          isPagerUserDraggingRef.current = false;
          lastPagerUserDragEndedAtRef.current = Date.now();
        }
        return;
      }

      isPagerUserDraggingRef.current = true;
      lastProgrammaticAcceptedTabRef.current = undefined;
      lastPagerDraggingAtRef.current = Date.now();
    },
    [],
  );
  const tabNames = useMemo(
    () => [
      watchlistTabName,
      ...spotTabItems.map((item) => item.tabName),
      ...(showPerpsTab ? [perpsTabName] : []),
    ],
    [perpsTabName, showPerpsTab, spotTabItems, watchlistTabName],
  );

  const handlePagerPageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const { position } = event.nativeEvent;
      const positionTabName = tabNames[position];
      const focusedTab = currentTabsRef.current?.getFocusedTab();
      const expectedTabName = expectedTabChangeTargetRef.current;
      const expectedTabNameStartedAt =
        expectedTabChangeTargetStartedAtRef.current;
      const lastPagerDraggingAt = lastPagerDraggingAtRef.current;
      const wasDraggedAfterExpectedTab =
        expectedTabNameStartedAt > 0 &&
        lastPagerDraggingAt > expectedTabNameStartedAt;

      const selectedTabNameFromPage = positionTabName || focusedTab;
      if (
        expectedTabName &&
        selectedTabNameFromPage &&
        selectedTabNameFromPage !== expectedTabName &&
        wasDraggedAfterExpectedTab
      ) {
        clearExpectedTabChangeTarget();
      }
    },
    [clearExpectedTabChangeTarget, currentTabsRef, tabNames],
  );
  const shouldSuppressItemPress = useCallback(() => {
    const now = Date.now();
    const pagerDragElapsedMs =
      lastPagerDraggingAtRef.current > 0
        ? now - lastPagerDraggingAtRef.current
        : undefined;
    const pagerIdleElapsedMs =
      lastPagerUserDragEndedAtRef.current > 0
        ? now - lastPagerUserDragEndedAtRef.current
        : undefined;

    if (isPagerUserDraggingRef.current) {
      return true;
    }

    if (
      pagerIdleElapsedMs !== undefined &&
      pagerIdleElapsedMs < MARKET_TAB_ITEM_PRESS_IDLE_GUARD_MS
    ) {
      return true;
    }

    if (
      pagerDragElapsedMs !== undefined &&
      pagerDragElapsedMs < MARKET_TAB_ITEM_PRESS_GUARD_MS
    ) {
      return true;
    }

    return false;
  }, []);
  const pagerProps = useMemo<IMarketPagerProps>(
    () => ({
      ...(nestedPager ? { nestedScrollEnabled: true } : {}),
      onPageScrollStateChanged: handlePagerScrollStateChanged,
      onPageSelected: handlePagerPageSelected,
    }),
    [handlePagerPageSelected, handlePagerScrollStateChanged, nestedPager],
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
        shouldSuppressItemPress={shouldSuppressItemPress}
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
          shouldSuppressItemPress={shouldSuppressItemPress}
        />
      </Tabs.Tab>
    )),
    ...(showPerpsTab
      ? [
          <Tabs.Tab key={perpsTabName} name={perpsTabName}>
            <MobileMarketPerpsFlatList
              selectedCategoryId={selectedCategoryId}
              listContainerProps={listContainerProps}
              shouldSuppressItemPress={shouldSuppressItemPress}
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
