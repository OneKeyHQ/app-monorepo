import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IDesktopLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
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

  const renderTabBar = useCallback((tabBarProps: TabBarProps<string>) => {
    const handleTabPress = (name: string) => {
      tabBarProps.onTabPress?.(name);
    };
    return (
      <Tabs.TabBar
        {...tabBarProps}
        onTabPress={handleTabPress}
        divider={false}
      />
    );
  }, []);

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
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

  if (!isFocused) {
    return null;
  }

  return (
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
              listContainerProps={listContainerProps}
            />
          </YStack>
        </Tabs.Tab>
        <Tabs.Tab name={spotTabName}>
          <YStack px="$4" flex={1}>
            <MarketFilterBar {...filterBarProps} />
            <MarketNormalTokenList
              networkId={selectedNetworkId}
              tabIntegrated
              listContainerProps={listContainerProps}
            />
          </YStack>
        </Tabs.Tab>
        {showPerpsTab ? (
          <Tabs.Tab name={perpsTabName}>
            <YStack px="$4" flex={1}>
              <MarketPerpsTokenList
                tabIntegrated
                listContainerProps={listContainerProps}
              />
            </YStack>
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    </YStack>
  );
}
