import { memo, useCallback, useMemo } from 'react';

import { Tabs, YStack, useTabContainerWidth } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketBannerList } from '../components/MarketBanner';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

function MobileLayoutComponent({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IMobileLayoutProps) {
  const { watchlistTabName, trendingTabName, handleTabChange, selectedTab } =
    useMarketTabsLogic(onTabChange);

  const tabBarHeight = useTabBarHeight();
  const tabContainerWidth = useTabContainerWidth() as number | undefined;

  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    return trendingTabName;
  }, [selectedTab, watchlistTabName, trendingTabName]);

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

  const renderTabBar = useCallback((tabBarProps: TabBarProps<string>) => {
    const handleTabPress = (name: string) => {
      tabBarProps.onTabPress?.(name);
    };
    return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
  }, []);

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      handleTabChange(tabName);
    },
    [handleTabChange],
  );

  return (
    <Tabs.Container
      width={platformEnv.isNative ? tabContainerWidth : undefined}
      renderTabBar={renderTabBar}
      initialTabName={initialTabName}
      onTabChange={onTabChangeHandler}
      {...containerProps}
    >
      <Tabs.Tab name={watchlistTabName}>
        <Tabs.ScrollView>
          <YStack pt="$2" {...listContainerProps}>
            <MarketWatchlistTokenList />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
      <Tabs.Tab name={trendingTabName}>
        <MobileMarketTokenFlatList
          networkId={selectedNetworkId}
          filterBarProps={filterBarProps}
          listContainerProps={listContainerProps}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
