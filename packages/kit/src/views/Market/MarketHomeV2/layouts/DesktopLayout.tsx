import { useIntl } from 'react-intl';

import { Stack, Tabs } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useSelectedMarketTabAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
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

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  onTabChange,
}: IDesktopLayoutProps) {
  const intl = useIntl();
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = watchlistState.data || [];
  const [selectedTab, setSelectedTab] = useSelectedMarketTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_watchlist,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  return (
    <Stack flex={1} height="100%">
      <Tabs.Container
        initialTabName={
          selectedTab === 'watchlist' ? watchlistTabName : trendingTabName
        }
        headerContainerStyle={{
          borderBottomWidth: 0,
          width: '100%',
          shadowColor: 'transparent',
        }}
        onTabChange={(data: { tabName: string }) => {
          const tabValue =
            data.tabName === watchlistTabName ? 'watchlist' : 'trending';
          setSelectedTab(tabValue);
          onTabChange(tabValue);
        }}
      >
        <Tabs.Tab name={watchlistTabName}>
          <Tabs.ScrollView>
            <Stack px="$4" flex={1}>
              <MarketTokenList
                networkId={selectedNetworkId}
                liquidityFilter={liquidityFilter}
                showWatchlistOnly
                watchlist={watchlist}
              />
            </Stack>
          </Tabs.ScrollView>
        </Tabs.Tab>

        <Tabs.Tab name={trendingTabName}>
          <Tabs.ScrollView>
            <Stack px="$4">
              <MarketFilterBar {...filterBarProps} />
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
