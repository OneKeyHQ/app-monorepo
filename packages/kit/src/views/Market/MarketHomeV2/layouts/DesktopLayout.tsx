import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Tabs, XStack, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../marketDesktopLayoutConstants';
import { MarketTestIDs } from '../../testIDs';
import { markMarketPerf } from '../../utils/marketPerf';
import { useMarketRenderCommitProbe } from '../../utils/marketReactPerf';
import { CompactNetworkSelector } from '../components/CompactNetworkSelector';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketListLoadingFallback } from '../components/MarketTokenList/MarketListLoadingFallback';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketTopCoinsList } from '../components/MarketTopCoinsList/MarketTopCoinsList';
import { TimeRangeDropdown } from '../components/TimeRangeDropdown';
import { TrendingDesktopToolbar } from '../components/TrendingDesktopToolbar';
import {
  COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS,
  isMarketStockCategoryById,
  shouldHideSpotExtendedStats,
  shouldShowSpotNetworkSelector,
} from '../utils';

import { DesktopStickyHeaderContext } from './DesktopStickyHeaderContext';
import { useMarketTabsLogic, useSyncedMarketTab } from './hooks';
import { getDefaultMarketStockCategoryId } from './marketStockCategoryUtils';

import type { IDesktopLayoutProps } from './DesktopLayout.types';
import type { IMarketCategoryItem } from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

const DESKTOP_STICKY_HEADER_TOP_GAP = 8;
const EMPTY_MARKET_STOCK_CATEGORIES: IMarketCategoryItem[] = [];

const LazyMarketWatchlistTokenList = lazy(async () => {
  const { MarketWatchlistTokenList } =
    await import('../components/MarketTokenList/MarketWatchlistTokenList');
  return { default: MarketWatchlistTokenList };
});

const LazyMarketPerpsTokenList = lazy(async () => {
  const { MarketPerpsTokenList } =
    await import('../components/MarketPerpsList');
  return { default: MarketPerpsTokenList };
});

const LazyMarketStockList = lazy(async () => {
  const { MarketStockList } =
    await import('../components/MarketStockList/MarketStockList');
  return { default: MarketStockList };
});

const useIsFirstFocus = () => {
  const isFirstFocusRef = useRef(false);
  const [isFirstFocus, setIsFirstFocus] = useState(platformEnv.isWeb);
  const isFocused = useRouteIsFocused();
  useEffect(() => {
    if (platformEnv.isWeb) {
      return;
    }
    if (isFirstFocusRef.current) {
      return;
    }
    if (isFocused) {
      isFirstFocusRef.current = true;
      setIsFirstFocus(true);
    }
  }, [isFocused]);
  return isFirstFocus;
};

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IDesktopLayoutProps) {
  markMarketPerf('market-home-desktop-layout-render', { selectedNetworkId });
  useMarketRenderCommitProbe('MarketHome.DesktopLayout', {
    selectedNetworkId,
  });
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

  const isFocused = useIsFirstFocus();

  const containerProps = useMemo(
    () => ({
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <YStack bg="$bgApp" pointerEvents="box-none">
          <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}>
            <MarketBannerList />
          </YStack>
        </YStack>
      ),
    }),
    [],
  );

  // Portal target for sticky column headers.
  // List components use createPortal to render their headers into this element.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const portalRefCallback = useCallback((el: HTMLDivElement | null) => {
    setPortalTarget(el);
  }, []);

  const { activeTabName, setActiveTabName, tabsRef } =
    useSyncedMarketTab(selectedTabName);
  const [stockDataCategoryMap, setStockDataCategoryMap] = useState<
    Record<string, boolean>
  >({});
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

  // Mount each sub-tab's heavy list only after the tab has been activated
  // once. The initial activeTabName comes in synchronously from
  // useSyncedMarketTab so the user's landing tab still mounts in the first
  // commit; the other two stay as empty placeholders until first press.
  const everActiveTabsRef = useRef<Set<string>>(new Set([activeTabName]));
  const [, bumpEverActive] = useState(0);
  const ensureTabActivated = useCallback((tabName: string) => {
    if (!everActiveTabsRef.current.has(tabName)) {
      everActiveTabsRef.current.add(tabName);
      bumpEverActive((version) => version + 1);
    }
  }, []);
  useEffect(() => {
    ensureTabActivated(activeTabName);
  }, [activeTabName, ensureTabActivated]);
  const hasActivated = (name: string) => everActiveTabsRef.current.has(name);

  // Ref so renderTabBar can update activeTabName immediately on press
  // without recreating the callback (which would break collapsible tab memoisation).
  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;

  // Use refs for filterBarProps and activeTabName to keep renderTabBar stable
  const filterBarPropsRef = useRef(filterBarProps);
  filterBarPropsRef.current = filterBarProps;

  const activeTabNameRef = useRef(activeTabName);
  activeTabNameRef.current = activeTabName;

  const stockDataCategoryMapRef = useRef(stockDataCategoryMap);
  stockDataCategoryMapRef.current = stockDataCategoryMap;

  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        // Update immediately on press so the portal clears before the
        // tab-switch animation completes (onTabChange fires after animation).
        ensureTabActivated(name);
        setActiveTabNameRef.current(name);
        tabBarProps.onTabPress?.(name);
      };
      const currentFilterBarProps = filterBarPropsRef.current;
      const currentActiveTabName = activeTabNameRef.current;
      const currentSpotCategoryId =
        getSpotCategoryIdByTabName(currentActiveTabName);
      const currentSpotCategoryHasStockData = Boolean(
        currentSpotCategoryId &&
        (isMarketStockCategoryById(
          currentFilterBarProps.categories,
          currentSpotCategoryId,
        ) ||
          stockDataCategoryMapRef.current[currentSpotCategoryId]),
      );
      const showSpotControls = Boolean(
        currentSpotCategoryId &&
        currentSpotCategoryId !== MARKET_TOP_COINS_CATEGORY_ID &&
        !currentSpotCategoryHasStockData,
      );
      const isTrendingCategory = currentSpotCategoryId === 'trending';
      const showNetworkSelector = shouldShowSpotNetworkSelector(
        currentSpotCategoryId,
      );
      // Wrap TabBar + portal target in a single sticky container.
      // Override TabBar's own sticky with position: relative so
      // the outer wrapper controls stickiness for both.
      return (
        <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
          <XStack
            {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}
            alignItems="center"
            testID={MarketTestIDs.marketTabs}
          >
            <XStack flex={1}>
              <Tabs.TabBar
                {...tabBarProps}
                onTabPress={handleTabPress}
                divider={false}
                containerStyle={{ position: 'relative' as any }}
              />
            </XStack>
            {/* Keep controls mounted so network data remains ready across tabs. */}
            <XStack
              display={showSpotControls ? 'flex' : 'none'}
              gap="$3"
              alignItems="center"
              pr="$5"
            >
              {isTrendingCategory ? null : (
                <TimeRangeDropdown
                  value={currentFilterBarProps.timeRange}
                  onChange={currentFilterBarProps.onTimeRangeChange}
                />
              )}
              <XStack display={showNetworkSelector ? 'flex' : 'none'}>
                <CompactNetworkSelector
                  selectedNetworkId={currentFilterBarProps.selectedNetworkId}
                  onNetworkIdChange={currentFilterBarProps.onNetworkIdChange}
                />
              </XStack>
            </XStack>
          </XStack>
          <div
            ref={portalRefCallback}
            style={{ paddingTop: DESKTOP_STICKY_HEADER_TOP_GAP }}
          />
        </YStack>
      );
    },
    [ensureTabActivated, getSpotCategoryIdByTabName, portalRefCallback],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      ensureTabActivated(tabName);
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [ensureTabActivated, handleTabChange, setActiveTabName],
  );

  const listContainerProps = useMemo(() => {
    if (platformEnv.isWebDappMode) {
      return { paddingBottom: 100 };
    }
    if (platformEnv.isDesktop) {
      return { paddingBottom: 50 };
    }
    return { paddingBottom: 0 };
  }, []);

  const getHiddenSpotDesktopColumns = useCallback(
    (categoryId: string) =>
      shouldHideSpotExtendedStats(categoryId)
        ? COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS
        : undefined,
    [],
  );

  const stickyHeaderCtx = useMemo(
    () => ({ portalTarget, activeTabName }),
    [portalTarget, activeTabName],
  );

  if (!isFocused) {
    markMarketPerf('market-home-desktop-layout-focus-gated');
    return null;
  }

  const tabElements = [
    <Tabs.Tab key={watchlistTabName} name={watchlistTabName}>
      <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS} px="$3" flex={1}>
        {hasActivated(watchlistTabName) ? (
          <Suspense fallback={<MarketListLoadingFallback />}>
            <LazyMarketWatchlistTokenList
              tabIntegrated
              tabName={watchlistTabName}
              listContainerProps={listContainerProps}
              enableWebSocket={activeTabName === watchlistTabName}
              centerDesktopPortalContent
            />
          </Suspense>
        ) : null}
      </YStack>
    </Tabs.Tab>,
    ...spotTabItems.map((item) => {
      const isStockCategory = isMarketStockCategoryById(
        filterBarProps.categories,
        item.categoryId,
      );
      let tabContent = null;
      if (hasActivated(item.tabName)) {
        if (isStockCategory) {
          tabContent = (
            <Suspense fallback={<MarketListLoadingFallback />}>
              <LazyMarketStockList
                categories={stockCategories}
                selectedCategoryId={selectedStockCategoryId}
                onSelectCategory={setSelectedStockCategoryId}
                tabIntegrated
                tabName={item.tabName}
                listContainerProps={listContainerProps}
              />
            </Suspense>
          );
        } else if (item.categoryId === MARKET_TOP_COINS_CATEGORY_ID) {
          tabContent = (
            <MarketTopCoinsList
              tabIntegrated
              tabName={item.tabName}
              listContainerProps={listContainerProps}
            />
          );
        } else {
          const isTrendingCategory = item.categoryId === 'trending';
          tabContent = (
            <MarketNormalTokenList
              networkId={selectedNetworkId}
              selectedCategory={item.categoryId}
              timeRange={filterBarProps.timeRange}
              tabIntegrated
              tabName={item.tabName}
              listContainerProps={listContainerProps}
              hiddenDesktopColumns={getHiddenSpotDesktopColumns(
                item.categoryId,
              )}
              onStockDataChange={handleStockDataChange}
              enableWebSocket={activeTabName === item.tabName}
              centerDesktopPortalContent
              desktopColumnVariant={isTrendingCategory ? 'trending' : 'default'}
              useApiDefaultSort={isTrendingCategory}
              toolbar={
                isTrendingCategory ? (
                  <TrendingDesktopToolbar
                    timeRange={filterBarProps.timeRange}
                    onTimeRangeChange={filterBarProps.onTimeRangeChange}
                  />
                ) : undefined
              }
            />
          );
        }
      }
      return (
        <Tabs.Tab key={item.categoryId} name={item.tabName}>
          <YStack
            // The stock list owns its own centered frame (it has to keep the
            // horizontal scroller full-bleed), so it opts out of this one.
            {...(isStockCategory
              ? { width: '100%' as const }
              : MARKET_DESKTOP_CONTENT_FRAME_PROPS)}
            px={isStockCategory ? '$0' : '$3'}
            flex={1}
          >
            {tabContent}
          </YStack>
        </Tabs.Tab>
      );
    }),
    ...(showPerpsTab
      ? [
          <Tabs.Tab key={perpsTabName} name={perpsTabName}>
            <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS} px="$3" flex={1}>
              {hasActivated(perpsTabName) ? (
                <Suspense fallback={null}>
                  <LazyMarketPerpsTokenList
                    tabIntegrated
                    tabName={perpsTabName}
                    listContainerProps={listContainerProps}
                  />
                </Suspense>
              ) : null}
            </YStack>
          </Tabs.Tab>,
        ]
      : []),
  ];

  return (
    <DesktopStickyHeaderContext.Provider value={stickyHeaderCtx}>
      <YStack flex={1}>
        <Tabs.Container
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={tabsRef as any}
          renderTabBar={renderTabBar}
          initialTabName={selectedTabName}
          onTabChange={onTabChangeHandler}
          {...containerProps}
        >
          {tabElements}
        </Tabs.Container>
      </YStack>
    </DesktopStickyHeaderContext.Provider>
  );
}
