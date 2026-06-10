import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, XStack, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CompactNetworkSelector } from '../components/CompactNetworkSelector';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';
import { TimeRangeDropdown } from '../components/TimeRangeDropdown';
import {
  COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS,
  isMarketStockCategoryById,
  shouldHideSpotExtendedStats,
} from '../utils';

import { DesktopStickyHeaderContext } from './DesktopStickyHeaderContext';
import { useMarketTabsLogic, useSyncedMarketTab } from './hooks';

import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

const DESKTOP_STICKY_HEADER_TOP_GAP = 8;

interface IDesktopLayoutProps {
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

const useIsFirstFocus = () => {
  const isFirstFocusRef = useRef(false);
  const [isFirstFocus, setIsFirstFocus] = useState(false);
  const isFocused = useRouteIsFocused();
  useEffect(() => {
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
          <MarketBannerList />
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
  useEffect(() => {
    if (!everActiveTabsRef.current.has(activeTabName)) {
      everActiveTabsRef.current.add(activeTabName);
      bumpEverActive((n) => n + 1);
    }
  }, [activeTabName]);
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
        currentSpotCategoryId && !currentSpotCategoryHasStockData,
      );
      // Wrap TabBar + portal target in a single sticky container.
      // Override TabBar's own sticky with position: relative so
      // the outer wrapper controls stickiness for both.
      return (
        <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
          <XStack alignItems="center">
            <XStack flex={1}>
              <Tabs.TabBar
                {...tabBarProps}
                onTabPress={handleTabPress}
                divider={false}
                containerStyle={{ position: 'relative' as any }}
              />
            </XStack>
            {/* Right side controls - hidden when the active spot data is stock */}
            {showSpotControls ? (
              <XStack gap="$3" alignItems="center" pr="$5">
                <TimeRangeDropdown
                  value={currentFilterBarProps.timeRange}
                  onChange={currentFilterBarProps.onTimeRangeChange}
                />
                <CompactNetworkSelector
                  selectedNetworkId={currentFilterBarProps.selectedNetworkId}
                  onNetworkIdChange={currentFilterBarProps.onNetworkIdChange}
                />
              </XStack>
            ) : null}
          </XStack>
          <div
            ref={portalRefCallback}
            style={{ paddingTop: DESKTOP_STICKY_HEADER_TOP_GAP }}
          />
        </YStack>
      );
    },
    [getSpotCategoryIdByTabName, portalRefCallback],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [handleTabChange, setActiveTabName],
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
    return null;
  }

  const tabElements = [
    <Tabs.Tab key={watchlistTabName} name={watchlistTabName}>
      <YStack px="$4" flex={1}>
        {hasActivated(watchlistTabName) ? (
          <MarketWatchlistTokenList
            tabIntegrated
            tabName={watchlistTabName}
            listContainerProps={listContainerProps}
          />
        ) : null}
      </YStack>
    </Tabs.Tab>,
    ...spotTabItems.map((item) => (
      <Tabs.Tab key={item.categoryId} name={item.tabName}>
        <YStack px="$4" flex={1}>
          {hasActivated(item.tabName) ? (
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
            />
          ) : null}
        </YStack>
      </Tabs.Tab>
    )),
    ...(showPerpsTab
      ? [
          <Tabs.Tab key={perpsTabName} name={perpsTabName}>
            <YStack px="$4" flex={1}>
              {hasActivated(perpsTabName) ? (
                <MarketPerpsTokenList
                  tabIntegrated
                  tabName={perpsTabName}
                  listContainerProps={listContainerProps}
                />
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
