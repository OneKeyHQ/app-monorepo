import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, XStack, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CompactNetworkSelector } from '../components/CompactNetworkSelector';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';
import { TimeRangeDropdown } from '../components/TimeRangeDropdown';
import {
  COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS,
  shouldHideSpotExtendedStats,
} from '../utils';

import { DesktopStickyHeaderContext } from './DesktopStickyHeaderContext';
import { useMarketTabsLogic } from './hooks';

import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

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
    spotTabName,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    selectedTab,
  } = useMarketTabsLogic(onTabChange);

  const isFocused = useIsFirstFocus();

  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return spotTabName;
  }, [selectedTab, watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);

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

  const [activeTabName, setActiveTabName] = useState(initialTabName);

  // Ref so renderTabBar can update activeTabName immediately on press
  // without recreating the callback (which would break collapsible tab memoisation).
  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;

  // Use refs for filterBarProps and activeTabName to keep renderTabBar stable
  const filterBarPropsRef = useRef(filterBarProps);
  filterBarPropsRef.current = filterBarProps;

  const activeTabNameRef = useRef(activeTabName);
  activeTabNameRef.current = activeTabName;

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
            {/* Right side controls - only visible on Spot tab */}
            {currentActiveTabName === spotTabName ? (
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
          <div ref={portalRefCallback} />
        </YStack>
      );
    },
    [portalRefCallback, spotTabName],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [handleTabChange],
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

  const hiddenSpotDesktopColumns = useMemo(
    () =>
      shouldHideSpotExtendedStats(filterBarProps.selectedCategory)
        ? COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS
        : undefined,
    [filterBarProps.selectedCategory],
  );

  const stickyHeaderCtx = useMemo(
    () => ({ portalTarget, activeTabName }),
    [portalTarget, activeTabName],
  );

  if (!isFocused) {
    return null;
  }

  return (
    <DesktopStickyHeaderContext.Provider value={stickyHeaderCtx}>
      <YStack flex={1}>
        <Tabs.Container
          renderTabBar={renderTabBar}
          initialTabName={initialTabName}
          onTabChange={onTabChangeHandler}
          {...containerProps}
        >
          <Tabs.Tab name={watchlistTabName}>
            <YStack px="$4" flex={1}>
              <MarketWatchlistTokenList
                tabIntegrated
                tabName={watchlistTabName}
                listContainerProps={listContainerProps}
              />
            </YStack>
          </Tabs.Tab>
          <Tabs.Tab name={spotTabName}>
            <YStack px="$4" flex={1}>
              <MarketNormalTokenList
                networkId={selectedNetworkId}
                selectedCategory={filterBarProps.selectedCategory}
                timeRange={filterBarProps.timeRange}
                tabIntegrated
                tabName={spotTabName}
                listContainerProps={listContainerProps}
                toolbar={<MarketFilterBar {...filterBarProps} />}
                hiddenDesktopColumns={hiddenSpotDesktopColumns}
              />
            </YStack>
          </Tabs.Tab>
          {showPerpsTab ? (
            <Tabs.Tab name={perpsTabName}>
              <YStack px="$4" flex={1}>
                <MarketPerpsTokenList
                  tabIntegrated
                  tabName={perpsTabName}
                  listContainerProps={listContainerProps}
                />
              </YStack>
            </Tabs.Tab>
          ) : null}
        </Tabs.Container>
      </YStack>
    </DesktopStickyHeaderContext.Provider>
  );
}
