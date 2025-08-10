import { Dimensions } from 'react-native';

import { Stack, Tabs, useSafeAreaInsets } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function MobileLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
}: IMobileLayoutProps) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = watchlistState.data || [];
  const { top, bottom } = useSafeAreaInsets();

  const availableHeight = Dimensions.get('window').height - top - bottom - 220;

  return (
    <Stack flex={1}>
      <Tabs.Container
        initialTabName="trending"
        headerContainerStyle={{
          width: '100%',
          shadowColor: 'transparent',
        }}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
        pagerProps={{ scrollEnabled: true }}
      >
        <Tabs.Tab name="watchlist">
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            showWatchlistOnly
            watchlist={watchlist}
          />
        </Tabs.Tab>

        <Tabs.Tab name="trending">
          <Tabs.ScrollView>
            <MarketFilterBarSmall {...filterBarProps} />
            <Stack h={availableHeight}>
              <MarketTokenList
                networkId={selectedNetworkId}
                liquidityFilter={liquidityFilter}
                showWatchlistOnly={false}
                watchlist={watchlist}
              />
            </Stack>
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </Stack>
  );
}
